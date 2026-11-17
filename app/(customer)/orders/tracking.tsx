import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  LayoutAnimation,
  UIManager,
  AppState,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, Feather } from '@expo/vector-icons';
import { customerColors as colors } from '../../../constants/customerTheme';
import { orderService } from '../../../services/order';
import { useSocket, useSocketStatus } from '../../../hooks/useSocket';
import {
  parseCoordinates,
  getDistanceKm,
  computeBearingDegrees,
  interpolateHeading,
  trimRouteFromDriver,
  formatDistanceCompact,
  type LatLngCoord,
  type OrderRouteData,
} from '../../../utils/routing';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const hasInitialFit = useRef(false);
  const hasOrderDropoffCoordsRef = useRef(false);
  const lastRouteSyncRef = useRef<number>(0);
  const prevRawDriverLocRef = useRef<LatLngCoord | null>(null);
  const animatedDriverCoordRef = useRef<LatLngCoord | null>(null);
  const animatedHeadingRef = useRef<number>(0);
  const markerAnimFrameRef = useRef<number | null>(null);

  const socket = useSocket();
  const isSocketConnected = useSocketStatus();

  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<LatLngCoord | null>(null);
  const [driverHeading, setDriverHeading] = useState<number>(0);
  const [displayDriverLocation, setDisplayDriverLocation] = useState<LatLngCoord | null>(null);
  const [displayDriverHeading, setDisplayDriverHeading] = useState<number>(0);
  const [isMarkerAnimating, setIsMarkerAnimating] = useState(false);
  const [restaurantLocation, setRestaurantLocation] = useState<LatLngCoord | null>(null);
  const [routeData, setRouteData] = useState<OrderRouteData | null>(null);
  const [userLocation, setUserLocation] = useState<LatLngCoord>({
    latitude: -26.2041,
    longitude: 28.0473,
  });
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [supportPhoneFallback, setSupportPhoneFallback] = useState<string | null>(null);

  useEffect(() => {
    orderService
      .getSupportContact()
      .then((res: any) => {
        const phone = res?.data?.support_phone || res?.support_phone || null;
        if (phone) setSupportPhoneFallback(phone);
      })
      .catch(() => {});
  }, []);

  // Fallback GPS only if order delivery_address lacks coordinates (never overwrite order's actual drop-off pin)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos =
            (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null)) ||
            (await Location.getLastKnownPositionAsync().catch(() => null));
          if (mounted && pos?.coords && !hasOrderDropoffCoordsRef.current) {
            setUserLocation((prev) => {
              if (hasOrderDropoffCoordsRef.current) return prev;
              return {
                latitude: pos.coords.latitude || prev.latitude,
                longitude: pos.coords.longitude || prev.longitude,
              };
            });
          }
        }
      } catch {
        // Keep default or address coordinates
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const syncOrderRoute = useCallback(
    async (coords?: LatLngCoord | null, force = false) => {
      if (!id) return null;
      lastRouteSyncRef.current = Date.now();
      try {
        const res: any = await orderService.getOrderRoute(
          id,
          coords ? { lat: coords.latitude, lng: coords.longitude, force } : { force }
        );
        const routePayload: OrderRouteData | undefined = res?.data || res;
        if (routePayload && Array.isArray(routePayload.reactNativeCoords)) {
          setRouteData(routePayload);
          if (routePayload.customerCoords) {
            hasOrderDropoffCoordsRef.current = true;
            setUserLocation(routePayload.customerCoords);
          }
          if (routePayload.restaurantCoords) {
            setRestaurantLocation(routePayload.restaurantCoords);
          }
          return routePayload;
        }
      } catch {
        // Quiet fallback to Haversine/straight line if offline or timed out
      }
      return null;
    },
    [id]
  );

  const fetchOrderData = useCallback(
    async (silent = false) => {
      if (!id) return;
      try {
        const [orderRes, routeRes]: [any, any] = await Promise.all([
          orderService.getOrder(id),
          orderService.getOrderRoute(id).catch(() => null),
        ]);
        const data = orderRes?.data || orderRes?.order || orderRes;
        if (!data) return;

        setOrder(data);

        // Order's real delivery_address coordinates ALWAYS take priority over device GPS
        const addrCoords = parseCoordinates(data.delivery_address);
        if (addrCoords) {
          hasOrderDropoffCoordsRef.current = true;
          setUserLocation(addrCoords);
        }

        // Parse restaurant coordinates
        let rCoords = parseCoordinates(data.restaurant_location);
        if (!rCoords && data.restaurant_lat && data.restaurant_lng) {
          rCoords = parseCoordinates({
            latitude: Number(data.restaurant_lat),
            longitude: Number(data.restaurant_lng),
          });
        }
        if (rCoords) {
          setRestaurantLocation(rCoords);
        }

        // Apply OSRM route payload if retrieved
        const routePayload: OrderRouteData | undefined = routeRes?.data || routeRes;
        if (routePayload && Array.isArray(routePayload.reactNativeCoords)) {
          lastRouteSyncRef.current = Date.now();
          setRouteData(routePayload);
          if (!addrCoords && routePayload.customerCoords) {
            hasOrderDropoffCoordsRef.current = true;
            setUserLocation(routePayload.customerCoords);
          }
          if (!rCoords && routePayload.restaurantCoords) {
            setRestaurantLocation(routePayload.restaurantCoords);
          }
        }

        // Parse driver coordinates (only fallback to restaurant location when status === 'picked_up')
        let dCoords = parseCoordinates(data.driver_location) || routePayload?.driverCoords || null;
        if (!dCoords && data.status === 'picked_up' && (rCoords || routePayload?.restaurantCoords)) {
          dCoords = rCoords || routePayload?.restaurantCoords || null;
        }

        if (dCoords) {
          prevRawDriverLocRef.current = dCoords;
          setDriverLocation(dCoords);
          setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      } catch {
        // Avoid triggering scary LogBox banners during live location polling
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      fetchOrderData(false);
      return () => setIsScreenFocused(false);
    }, [fetchOrderData])
  );

  // Live Socket.IO streaming (replaces unconditional 4s polling)
  useEffect(() => {
    if (!socket || !id) return;

    const joinOrderRoom = () => {
      socket.emit('join_order', id);
      fetchOrderData(true);
    };
    socket.emit('join_order', id);

    const handleDriverLocation = (data: any) => {
      const coords = parseCoordinates(data?.location || data);
      if (coords) {
        const incomingHeading = Number(data?.heading);
        const computedHeading =
          Number.isFinite(incomingHeading) && incomingHeading >= 0
            ? incomingHeading
            : computeBearingDegrees(prevRawDriverLocRef.current, coords);
        if (computedHeading !== null) {
          setDriverHeading(computedHeading);
        }
        prevRawDriverLocRef.current = coords;
        setDriverLocation(coords);
        setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

        if (data?.route && Array.isArray(data.route.reactNativeCoords)) {
          lastRouteSyncRef.current = Date.now();
          setRouteData((prev) => ({
            ...(prev || {}),
            ...data.route,
            previewRoute: data.route.previewRoute ?? prev?.previewRoute ?? null,
          }));
        } else {
          setRouteData((prev) => {
            if (!prev || !Array.isArray(prev.reactNativeCoords) || prev.reactNativeCoords.length < 2) {
              return prev;
            }
            return {
              ...prev,
              reactNativeCoords: trimRouteFromDriver(prev.reactNativeCoords, coords),
            };
          });
          if (Date.now() - lastRouteSyncRef.current > 40000) {
            syncOrderRoute(coords);
          }
        }
      }
    };

    const handleOrderUpdate = (data: any) => {
      const eventOrderId = String(data?.orderId || data?.order_id || data?.order?.id || id);
      if (eventOrderId !== String(id)) return;

      const nextStatus = data?.status || data?.new_status || data?.order?.status;
      const nextDriverLoc = parseCoordinates(data?.driver_location || data?.order?.driver_location);
      if (nextDriverLoc) {
        const bearing = computeBearingDegrees(prevRawDriverLocRef.current, nextDriverLoc);
        if (bearing !== null) setDriverHeading(bearing);
        prevRawDriverLocRef.current = nextDriverLoc;
        setDriverLocation(nextDriverLoc);
        setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
      if (nextStatus) {
        setOrder((prev: any) =>
          prev
            ? {
                ...prev,
                ...(data?.order || {}),
                verification_code: data?.order?.verification_code || prev.verification_code,
                code_expires_at: data?.order?.code_expires_at || prev.code_expires_at,
                status: nextStatus,
              }
            : data?.order || prev
        );
        if (['accepted_by_driver', 'order_ready', 'picked_up', 'on_the_way', 'arrived'].includes(nextStatus)) {
          fetchOrderData(true);
        }
      } else {
        fetchOrderData(true);
      }
    };

    const handleVerificationCode = (payload: any) => {
      if (payload?.order_id === id && payload?.verification_code) {
        setOrder((prev: any) =>
          prev
            ? {
                ...prev,
                verification_code: payload.verification_code,
                code_expires_at: payload.code_expires_at || prev.code_expires_at,
              }
            : prev
        );
      }
    };

    socket.on('connect', joinOrderRoom);
    socket.on('driver_location', handleDriverLocation);
    socket.on('order_update', handleOrderUpdate);
    socket.on('verification_code_generated', handleVerificationCode);

    return () => {
      socket.off('connect', joinOrderRoom);
      socket.off('driver_location', handleDriverLocation);
      socket.off('order_update', handleOrderUpdate);
      socket.off('verification_code_generated', handleVerificationCode);
    };
  }, [id, socket, fetchOrderData, syncOrderRoute]);

  const targetDriverCoord: LatLngCoord | null =
    driverLocation || (order?.status === 'picked_up' ? restaurantLocation : null);

  // Smoothly interpolate driver marker position & heading over ~1.25s between GPS pings
  useEffect(() => {
    if (!targetDriverCoord) {
      animatedDriverCoordRef.current = null;
      setDisplayDriverLocation(null);
      setIsMarkerAnimating(false);
      return;
    }

    const fromCoord = animatedDriverCoordRef.current;
    const fromHeading = animatedHeadingRef.current;

    if (!fromCoord) {
      animatedDriverCoordRef.current = targetDriverCoord;
      animatedHeadingRef.current = driverHeading;
      setDisplayDriverLocation(targetDriverCoord);
      setDisplayDriverHeading(driverHeading);
      setIsMarkerAnimating(false);
      return;
    }

    if (markerAnimFrameRef.current !== null) {
      cancelAnimationFrame(markerAnimFrameRef.current);
      markerAnimFrameRef.current = null;
    }

    const durationMs = 1250;
    const startTime = Date.now();
    setIsMarkerAnimating(true);

    const step = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);

      const nextCoord: LatLngCoord = {
        latitude: fromCoord.latitude + (targetDriverCoord.latitude - fromCoord.latitude) * eased,
        longitude: fromCoord.longitude + (targetDriverCoord.longitude - fromCoord.longitude) * eased,
      };
      const nextHeading = interpolateHeading(fromHeading, driverHeading, eased);

      animatedDriverCoordRef.current = nextCoord;
      animatedHeadingRef.current = nextHeading;
      setDisplayDriverLocation(nextCoord);
      setDisplayDriverHeading(nextHeading);

      if (t < 1) {
        markerAnimFrameRef.current = requestAnimationFrame(step);
      } else {
        markerAnimFrameRef.current = null;
        setIsMarkerAnimating(false);
      }
    };

    markerAnimFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (markerAnimFrameRef.current !== null) {
        cancelAnimationFrame(markerAnimFrameRef.current);
        markerAnimFrameRef.current = null;
      }
    };
  }, [targetDriverCoord?.latitude, targetDriverCoord?.longitude, driverHeading]);

  const isTerminalTracking = Boolean(
    order?.status && ['delivered', 'cancelled', 'no_drivers_available', 'delivery_failed'].includes(order.status)
  );

  // Conditional fallback poll ONLY when focused, active, and Socket.IO is disconnected
  useEffect(() => {
    if (!isScreenFocused || isTerminalTracking || isSocketConnected) return;
    const fallbackInterval = setInterval(() => {
      fetchOrderData(true);
    }, 15000);
    return () => clearInterval(fallbackInterval);
  }, [isScreenFocused, isTerminalTracking, isSocketConnected, fetchOrderData]);

  // Refresh once when returning to foreground on an active order
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !isTerminalTracking) {
        fetchOrderData(true);
      }
    });
    return () => sub.remove();
  }, [isTerminalTracking, fetchOrderData]);

  // Fit map to show Driver, Restaurant (when pre-pickup or active), route polyline, and Customer
  const fitMapToRoute = useCallback(() => {
    if (!mapRef.current) return;
    const points: LatLngCoord[] = [userLocation];
    if (driverLocation) points.push(driverLocation);
    if (restaurantLocation && ['accepted_by_driver', 'order_ready', 'picked_up'].includes(order?.status)) {
      points.push(restaurantLocation);
    }
    if (routeData?.reactNativeCoords && routeData.reactNativeCoords.length >= 2) {
      points.push(routeData.reactNativeCoords[0], routeData.reactNativeCoords[routeData.reactNativeCoords.length - 1]);
    }
    if (points.length >= 2) {
      mapRef.current.fitToCoordinates(points, {
        edgePadding: { top: 130, right: 60, bottom: showQR ? 460 : 320, left: 60 },
        animated: true,
      });
    } else if (driverLocation) {
      mapRef.current.animateToRegion(
        {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        600
      );
    }
  }, [driverLocation, restaurantLocation, userLocation, order?.status, showQR, routeData?.reactNativeCoords?.length]);

  useEffect(() => {
    if (driverLocation && !hasInitialFit.current) {
      hasInitialFit.current = true;
      setTimeout(fitMapToRoute, 300);
    }
  }, [driverLocation, fitMapToRoute]);

  useEffect(() => {
    if (driverLocation) {
      fitMapToRoute();
    }
  }, [order?.status, showQR]);

  const centerOnDriver = () => {
    if (!mapRef.current || !driverLocation) return;
    mapRef.current.animateToRegion(
      {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      500
    );
  };

  const handleCallDriver = () => {
    if (order?.driver_phone) Linking.openURL(`tel:${order.driver_phone}`);
  };

  const toggleQR = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowQR(!showQR);
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Waiting for restaurant approval...';
      case 'ordering_at_restaurant':
        return 'Restaurant is preparing your order';
      case 'order_ready':
        return 'Order ready for driver pickup';
      case 'accepted_by_driver':
        return 'Driver is heading to the restaurant';
      case 'picked_up':
        return 'Order picked up! Driver is live on map';
      case 'on_the_way':
        return 'Driver is on the way to you!';
      case 'arrived':
        return 'Driver has arrived at your location!';
      case 'delivered':
        return 'Order Delivered';
      case 'delivery_failed':
        return 'Delivery Failed (Customer Unreachable)';
      case 'cancelled':
        return 'Order Cancelled';
      default:
        return 'Tracking Order';
    }
  };

  const getStatusSubtitle = (status: string) => {
    switch (status) {
      case 'picked_up':
        return order?.rescue_courier?.name
          ? `Rescue courier ${order.rescue_courier.name} is bringing your order to you.`
          : 'Your driver has collected your order from the restaurant and is heading to your delivery address.';
      case 'on_the_way':
        return order?.rescue_courier?.name
          ? `Happy Dispatch rescue courier (${order.rescue_courier.name}) is on the way.`
          : 'Watch your driver move in real time on the map above.';
      case 'arrived':
        return 'Meet your courier and show the delivery verification code below.';
      case 'delivery_failed':
        return order?.failure_reason || 'Courier and Dispatch could not reach you at drop-off. Payment forfeited per policy.';
      case 'accepted_by_driver':
        return `Your driver is on the way to ${order?.restaurant_name || 'the restaurant'}.`;
      default:
        return null;
    }
  };

  const getExpiryText = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return 'Active for delivery';
    const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryText} />
        <Text style={styles.loadingText}>Establishing live map connection...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.loadingContainer}>
        <Feather name="alert-circle" size={40} color={colors.gray500} />
        <Text style={styles.loadingText}>Tracking session not found</Text>
      </View>
    );
  }

  const effectiveDriverLocation: LatLngCoord | null =
    displayDriverLocation ||
    driverLocation ||
    (order.status === 'picked_up' ? restaurantLocation : null);

  const isPrePickupStage = ['accepted_by_driver', 'order_ready'].includes(order.status);
  const isPickedUpOrEnRoute = ['picked_up', 'on_the_way', 'arrived'].includes(order.status);

  // Two-stage journey polylines using OSRM road geometry (+ straight-line fallback only if OSRM unavailable)
  const primaryRouteCoords: LatLngCoord[] = (() => {
    if (isPrePickupStage) {
      if (routeData?.leg === 'to_restaurant' && routeData.reactNativeCoords.length >= 2) {
        return effectiveDriverLocation
          ? trimRouteFromDriver(routeData.reactNativeCoords, effectiveDriverLocation)
          : routeData.reactNativeCoords;
      }
      if (effectiveDriverLocation && restaurantLocation) {
        return [effectiveDriverLocation, restaurantLocation];
      }
      return [];
    }

    if (isPickedUpOrEnRoute) {
      if (
        (routeData?.leg === 'to_customer' || routeData?.leg === 'preview_to_customer') &&
        routeData.reactNativeCoords.length >= 2
      ) {
        return effectiveDriverLocation
          ? trimRouteFromDriver(routeData.reactNativeCoords, effectiveDriverLocation)
          : routeData.reactNativeCoords;
      }
      if (effectiveDriverLocation) {
        return [effectiveDriverLocation, userLocation];
      }
      return [];
    }

    return [];
  })();

  const previewRouteCoords: LatLngCoord[] = (() => {
    if (isPrePickupStage) {
      if (routeData?.previewRoute?.reactNativeCoords && routeData.previewRoute.reactNativeCoords.length >= 2) {
        return routeData.previewRoute.reactNativeCoords;
      }
      if (restaurantLocation) {
        return [restaurantLocation, userLocation];
      }
      return [];
    }
    if (!isPickedUpOrEnRoute && routeData?.leg === 'preview_to_customer' && routeData.reactNativeCoords.length >= 2) {
      return routeData.reactNativeCoords;
    }
    return [];
  })();

  // Real OSRM road distance & ETA (keep Haversine strictly as offline/timeout fallback)
  const targetStopForFallback = isPrePickupStage && restaurantLocation ? restaurantLocation : userLocation;
  const fallbackDistanceKm = getDistanceKm(effectiveDriverLocation, targetStopForFallback);
  const hasOsrmMetrics =
    routeData &&
    routeData.distanceKm !== null &&
    routeData.durationMinutes !== null &&
    ((isPrePickupStage && routeData.leg === 'to_restaurant') ||
      (isPickedUpOrEnRoute && (routeData.leg === 'to_customer' || routeData.leg === 'preview_to_customer')));

  const distanceKm = hasOsrmMetrics ? routeData!.distanceKm : fallbackDistanceKm;
  const etaMinutes = hasOsrmMetrics
    ? routeData!.durationMinutes
    : fallbackDistanceKm !== null
    ? Math.max(2, Math.round((fallbackDistanceKm / 28) * 60 + 2))
    : null;

  return (
    <View style={styles.container}>
      {/* FULL SCREEN LIVE IN-APP MAP */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFill}
        mapPadding={{ top: insets.top + 60, right: 20, bottom: showQR ? 420 : 280, left: 20 }}
        initialRegion={{
          latitude: effectiveDriverLocation?.latitude || userLocation.latitude,
          longitude: effectiveDriverLocation?.longitude || userLocation.longitude,
          latitudeDelta: 0.035,
          longitudeDelta: 0.035,
        }}
      >
        {/* Customer Delivery Location Marker */}
        <Marker coordinate={userLocation} title="Delivery Address" description="Your drop-off location">
          <View style={styles.markerUser}>
            <View style={styles.markerUserInner}>
              <Ionicons name="home" size={16} color="#fff" />
            </View>
          </View>
        </Marker>

        {/* Restaurant Pickup Marker */}
        {!!restaurantLocation && (
          <Marker coordinate={restaurantLocation} title={order.restaurant_name || 'Restaurant'} description="Pickup Location">
            <View style={styles.markerRestaurant}>
              <Ionicons name="restaurant" size={16} color={colors.onPrimary} />
            </View>
          </Marker>
        )}

        {/* Secondary Dashed Preview Route (Restaurant -> Customer before pickup / pre-driver) */}
        {previewRouteCoords.length >= 2 && (
          <Polyline
            coordinates={previewRouteCoords}
            strokeColor="rgba(82, 82, 91, 0.65)"
            strokeWidth={3.5}
            lineDashPattern={[8, 6]}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Primary Highlighted Road Route Polyline (Casing + Inner Stroke) */}
        {primaryRouteCoords.length >= 2 && (
          <>
            <Polyline
              coordinates={primaryRouteCoords}
              strokeColor={isPickedUpOrEnRoute ? '#064E3B' : '#18181B'}
              strokeWidth={7.5}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={primaryRouteCoords}
              strokeColor={isPickedUpOrEnRoute ? colors.success : colors.primary}
              strokeWidth={4.5}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}

        {/* Smooth Animated & Rotated Live Driver Marker */}
        {!!effectiveDriverLocation && (
          <Marker
            coordinate={effectiveDriverLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={Platform.OS === 'android' ? displayDriverHeading : 0}
            tracksViewChanges={Platform.OS === 'ios' || isMarkerAnimating}
            title={
              order.driver_first_name
                ? `${order.driver_first_name} (${order.status === 'picked_up' ? 'Order Picked Up' : 'Driver'})`
                : 'Your Driver'
            }
            description={
              order.driver_vehicle_model
                ? `${order.driver_vehicle_color || ''} ${order.driver_vehicle_model} • ${order.driver_vehicle_plate || ''}`.trim()
                : 'Live GPS Location'
            }
          >
            <View style={styles.driverMarkerWrap}>
              <View
                style={[
                  styles.driverHeadingRing,
                  Platform.OS === 'ios'
                    ? { transform: [{ rotate: `${displayDriverHeading}deg` }] }
                    : null,
                ]}
              >
                <View
                  style={[
                    styles.driverHeadingTip,
                    isPickedUpOrEnRoute && styles.driverHeadingTipActive,
                  ]}
                />
              </View>
              <View style={[styles.markerDriver, isPickedUpOrEnRoute && styles.markerDriverActive]}>
                <Ionicons
                  name={
                    String(order.driver_vehicle_type || '').toLowerCase().includes('car')
                      ? 'car'
                      : 'bicycle'
                  }
                  size={19}
                  color="#fff"
                />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* FLOATING HEADER */}
      <View style={[styles.headerFloating, { top: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerPill}>
          <View style={[styles.liveDot, isPickedUpOrEnRoute && { backgroundColor: colors.success }]} />
          <Text style={styles.headerTitle}>
            {order.status === 'picked_up' ? 'Order Picked Up • Live Map' : 'Live Tracking'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.backButton}
          onPress={centerOnDriver}
          accessibilityLabel="Center on Driver"
        >
          <Ionicons name="locate" size={22} color={colors.primaryText} />
        </TouchableOpacity>
      </View>

      {/* FLOATING MAP CONTROLS (Fit Route + Center Driver) */}
      {!!effectiveDriverLocation && (
        <View style={[styles.mapControlsFloating, { top: insets.top + 66 }]}>
          <TouchableOpacity style={styles.mapChipBtn} onPress={centerOnDriver}>
            <Ionicons name="navigate-circle" size={16} color="#fff" />
            <Text style={styles.mapChipBtnText}>Follow Driver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.mapChipBtn, styles.mapChipBtnSecondary]} onPress={fitMapToRoute}>
            <Ionicons name="expand-outline" size={15} color="#1A1A1A" />
            <Text style={[styles.mapChipBtnText, { color: '#1A1A1A' }]}>Full Route</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FLOATING BOTTOM SHEET */}
      <View style={[styles.bottomSheetFloating, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.grabber} />

        {/* Status Pill + ETA Row */}
        <View style={styles.statusHeaderRow}>
          <View
            style={[
              styles.statusPillBadge,
              isPickedUpOrEnRoute ? styles.statusPillPickedUp : styles.statusPillDefault,
            ]}
          >
            <View style={styles.statusPillDot} />
            <Text style={styles.statusPillText}>
              {order.status.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>

          {etaMinutes !== null && distanceKm !== null && (
            <View style={styles.etaBadge}>
              <Ionicons name="time-outline" size={14} color={colors.primaryText} />
              <Text style={styles.etaText}>
                ~{etaMinutes} min ({formatDistanceCompact(distanceKm)})
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.statusText}>{getStatusMessage(order.status)}</Text>
        {getStatusSubtitle(order.status) && (
          <Text style={styles.statusSubText}>{getStatusSubtitle(order.status)}</Text>
        )}

        {/* Mini Progress Bar: Accepted -> Picked Up -> On the Way -> Arrived */}
        <View style={styles.progressStepsRow}>
          {[
            { key: 'accepted_by_driver', label: 'Assigned' },
            { key: 'picked_up', label: 'Picked Up' },
            { key: 'on_the_way', label: 'En Route' },
            { key: 'arrived', label: 'Arrived' },
          ].map((st, idx) => {
            const orderRank: Record<string, number> = {
              accepted_by_driver: 0,
              picked_up: 1,
              on_the_way: 2,
              arrived: 3,
              delivered: 4,
            };
            const currentRank = orderRank[order.status] ?? -1;
            const active = currentRank >= idx;
            return (
              <View key={st.key} style={styles.progressStepItem}>
                <View style={[styles.progressBarSegment, active && styles.progressBarSegmentActive]} />
                <Text style={[styles.progressStepLabel, active && styles.progressStepLabelActive]}>
                  {st.label}
                </Text>
              </View>
            );
          })}
        </View>

        {order.rescue_courier?.name ? (
          <View style={styles.driverSection}>
            <View style={styles.driverRow}>
              <View style={[styles.avatar, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="shield-checkmark" size={24} color="#059669" />
              </View>
              <View style={styles.driverInfoBlock}>
                <Text style={[styles.driverName, { color: '#065F46' }]}>
                  {order.rescue_courier.name}
                </Text>
                <View style={styles.vehicleRow}>
                  <Text style={styles.vehicleText}>
                    {order.rescue_courier.courier_type_label || 'Happy Dispatch Rescue'}
                    {order.rescue_courier.vehicle ? ` · ${order.rescue_courier.vehicle}` : ''}
                  </Text>
                  {order.rescue_courier.plate && (
                    <View style={styles.plateBadge}>
                      <Text style={styles.plateText}>{order.rescue_courier.plate}</Text>
                    </View>
                  )}
                </View>
              </View>
              {order.rescue_courier.phone && (
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${order.rescue_courier.phone}`)}
                >
                  <Ionicons name="call" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : order.driver_id ? (
          <View style={styles.driverSection}>
            <View style={styles.driverRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(order.driver_first_name || 'D').charAt(0)}
                  {(order.driver_last_name || 'R').charAt(0)}
                </Text>
              </View>
              <View style={styles.driverInfoBlock}>
                <Text style={styles.driverName}>
                  {order.driver_first_name || 'Assigned'} {order.driver_last_name || 'Driver'}
                </Text>
                <View style={styles.vehicleRow}>
                  <Text style={styles.vehicleText}>
                    {[order.driver_vehicle_color, order.driver_vehicle_model || order.driver_vehicle_type || 'Delivery Vehicle']
                      .filter(Boolean)
                      .join(' ')}
                  </Text>
                  {order.driver_vehicle_plate && (
                    <View style={styles.plateBadge}>
                      <Text style={styles.plateText}>{order.driver_vehicle_plate}</Text>
                    </View>
                  )}
                </View>
                {lastUpdatedAt && (
                  <Text style={styles.gpsTimestampText}>Live GPS updated at {lastUpdatedAt}</Text>
                )}
              </View>
              {order.driver_phone && (
                <TouchableOpacity style={styles.callBtn} onPress={handleCallDriver}>
                  <Ionicons name="call" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.waitingState}>
            <ActivityIndicator color={colors.primaryText} size="small" />
            <Text style={styles.waitingText}>
              {order.reassigned_at
                ? 'Dispatch is assigning a new driver to your order...'
                : 'Assigning an optimal driver...'}
            </Text>
          </View>
        )}

        {(order.support_phone || supportPhoneFallback) && (
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: '#FFFBEB',
              borderWidth: 1,
              borderColor: '#FCD34D',
              marginBottom: 12,
            }}
            onPress={() => Linking.openURL(`tel:${order.support_phone || supportPhoneFallback}`)}
          >
            <Ionicons name="headset" size={16} color="#B45309" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>
              Late or need help? Call Happy Dispatch ({order.support_phone || supportPhoneFallback})
            </Text>
          </TouchableOpacity>
        )}

        {['picked_up', 'on_the_way', 'arrived'].includes(order.status) && !!order.verification_code && (
          <View style={styles.verificationContainer}>
            <TouchableOpacity style={styles.toggleCodeBtn} onPress={toggleQR} activeOpacity={0.8}>
              <Feather name="shield" size={18} color="#fff" />
              <Text style={styles.toggleCodeText}>
                {showQR ? 'Hide Verification Code' : 'Show Delivery Code'}
              </Text>
              <Feather name={showQR ? 'chevron-up' : 'chevron-down'} size={20} color="#fff" />
            </TouchableOpacity>

            {showQR && (
              <View style={styles.qrCard}>
                <Text style={styles.qrInstruction}>Show this to the driver upon arrival</Text>
                <View style={styles.qrWrapper}>
                  <QRCode value={String(order.verification_code)} size={160} backgroundColor="#fff" color="#1A1A1A" />
                </View>
                <Text style={styles.verificationCode}>{order.verification_code}</Text>
                <Text style={styles.expiresText}>Expires in {getExpiryText(order.code_expires_at)}</Text>
              </View>
            )}
          </View>
        )}

        {['delivered', 'cancelled', 'no_drivers_available', 'delivery_failed'].includes(order.status) && (
          <TouchableOpacity
            style={styles.terminalCtaBtn}
            activeOpacity={0.85}
            onPress={() => router.replace(`/(customer)/orders/${order.id}`)}
          >
            <Ionicons
              name={order.status === 'delivered' ? 'star-outline' : 'receipt-outline'}
              size={18}
              color="#fff"
            />
            <Text style={styles.terminalCtaText}>
              {order.status === 'delivered'
                ? 'Rate Your Order / View Receipt'
                : 'View Order Details'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#E8EAED' 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#fff',
    gap: 12
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray500,
  },

  /* --- Map Markers --- */
  markerUser: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerUserInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerRestaurant: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  markerDriver: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  markerDriverActive: {
    backgroundColor: colors.success,
  },
  driverMarkerWrap: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverHeadingRing: {
    position: 'absolute',
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  driverHeadingTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#1A1A1A',
  },
  driverHeadingTipActive: {
    borderBottomColor: colors.success,
  },

  /* --- Floating Header --- */
  headerFloating: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  mapControlsFloating: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  mapChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  mapChipBtnSecondary: {
    backgroundColor: '#fff',
  },
  mapChipBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  /* --- Floating Bottom Sheet --- */
  bottomSheetFloating: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 15,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  statusPillPickedUp: {
    backgroundColor: '#ECFDF5',
  },
  statusPillDefault: {
    backgroundColor: colors.primarySoft,
  },
  statusPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.6,
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  etaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  statusText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  statusSubText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 14,
  },
  progressStepsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 18,
  },
  progressStepItem: {
    flex: 1,
  },
  progressBarSegment: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 4,
  },
  progressBarSegmentActive: {
    backgroundColor: colors.success,
  },
  progressStepLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  progressStepLabelActive: {
    color: '#111827',
    fontWeight: '700',
  },
  gpsTimestampText: {
    fontSize: 11,
    color: colors.success,
    fontWeight: '600',
    marginTop: 4,
  },
  
  /* --- Driver Section --- */
  driverSection: {
    marginBottom: 20,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  driverInfoBlock: {
    flex: 1,
    marginLeft: 16,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vehicleText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  plateBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  plateText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  /* --- Waiting State --- */
  waitingState: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  waitingText: {
    marginLeft: 12,
    color: colors.gray500,
    fontWeight: '600',
  },

  /* --- Verification Section --- */
  verificationContainer: {
    marginTop: 8,
  },
  toggleCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  toggleCodeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  qrCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    padding: 24,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  qrInstruction: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    marginBottom: 16,
  },
  qrWrapper: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  verificationCode: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  expiresText: {
    fontSize: 13,
    color: colors.primaryText,
    fontWeight: '600',
  },
  terminalCtaBtn: {
    marginTop: 14,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  terminalCtaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});