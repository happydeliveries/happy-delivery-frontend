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
import { colors } from '../../../constants/colors';
import { orderService } from '../../../services/order';
import { useSocket, useSocketStatus } from '../../../hooks/useSocket';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');

type LatLng = {
  latitude: number;
  longitude: number;
};

// Helper to parse coordinates from any backend/Postgres/Socket format
const parseCoordinates = (location: any): LatLng | null => {
  if (!location) return null;

  let raw = location;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  let lat: number | null = null;
  let lng: number | null = null;

  if (Array.isArray(raw) && raw.length >= 2) {
    lng = Number(raw[0]);
    lat = Number(raw[1]);
  } else if (typeof raw === 'object') {
    if (raw.latitude !== undefined && raw.longitude !== undefined) {
      lat = Number(raw.latitude);
      lng = Number(raw.longitude);
    } else if (raw.lat !== undefined && raw.lng !== undefined) {
      lat = Number(raw.lat);
      lng = Number(raw.lng);
    } else if (raw.x !== undefined && raw.y !== undefined) {
      lng = Number(raw.x);
      lat = Number(raw.y);
    } else if (Array.isArray(raw.coordinates) && raw.coordinates.length >= 2) {
      lng = Number(raw.coordinates[0]);
      lat = Number(raw.coordinates[1]);
    }
  }

  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat === 0 && lng === 0) return null;

  // Auto-correct only if lat is out of valid [-90, 90] bounds or clearly reversed SA coordinates
  if ((Math.abs(lat) > 90 && Math.abs(lng) <= 90) || (lat >= 15 && lat <= 35 && lng <= -20 && lng >= -36)) {
    const tmp = lat;
    lat = lng;
    lng = tmp;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return { latitude: lat, longitude: lng };
};

// Haversine distance in km
const getDistanceKm = (a: LatLng | null, b: LatLng | null): number | null => {
  if (!a || !b) return null;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const hasInitialFit = useRef(false);

  const socket = useSocket();
  const isSocketConnected = useSocketStatus();

  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<LatLng | null>(null);
  const [restaurantLocation, setRestaurantLocation] = useState<LatLng | null>(null);
  const [userLocation, setUserLocation] = useState<LatLng>({
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

  // Get customer's real GPS location if permission is available
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos =
            (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null)) ||
            (await Location.getLastKnownPositionAsync().catch(() => null));
          if (mounted && pos?.coords) {
            setUserLocation((prev) => ({
              latitude: pos.coords.latitude || prev.latitude,
              longitude: pos.coords.longitude || prev.longitude,
            }));
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

  const fetchOrderData = useCallback(
    async (silent = false) => {
      if (!id) return;
      try {
        // Fetch order details + live tracking endpoint
        const response: any = await orderService.getOrder(id);
        const data = response?.data || response?.order || response;
        if (!data) return;

        setOrder(data);

        // Parse delivery address coordinates if present
        const addrCoords = parseCoordinates(data.delivery_address);
        if (addrCoords) {
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

        // Parse driver coordinates (only fallback to restaurant location when status === 'picked_up')
        let dCoords = parseCoordinates(data.driver_location);
        if (!dCoords && data.status === 'picked_up' && rCoords) {
          dCoords = rCoords;
        }

        if (dCoords) {
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
        setDriverLocation(coords);
        setLastUpdatedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    };

    const handleOrderUpdate = (data: any) => {
      const eventOrderId = String(data?.orderId || data?.order_id || data?.order?.id || id);
      if (eventOrderId !== String(id)) return;

      const nextStatus = data?.status || data?.new_status || data?.order?.status;
      const nextDriverLoc = parseCoordinates(data?.driver_location || data?.order?.driver_location);
      if (nextDriverLoc) {
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
        if (['accepted_by_driver', 'picked_up'].includes(nextStatus)) {
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
  }, [id, socket, fetchOrderData]);

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

  // Fit map to show Driver, Restaurant (when picked_up/accepted), and Customer
  const fitMapToRoute = useCallback(() => {
    if (!mapRef.current) return;
    const points: LatLng[] = [userLocation];
    if (driverLocation) points.push(driverLocation);
    if (restaurantLocation && ['accepted_by_driver', 'picked_up'].includes(order?.status)) {
      points.push(restaurantLocation);
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
  }, [driverLocation, restaurantLocation, userLocation, order?.status, showQR]);

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
        <ActivityIndicator size="large" color={colors.primary} />
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

  const effectiveDriverLocation: LatLng | null =
    driverLocation ||
    (order.status === 'picked_up' ? restaurantLocation : null);

  const distanceKm = getDistanceKm(effectiveDriverLocation, userLocation);
  const etaMinutes = distanceKm !== null ? Math.max(2, Math.round((distanceKm / 30) * 60 + 2)) : null;
  const isPickedUpOrEnRoute = ['picked_up', 'on_the_way', 'arrived'].includes(order.status);

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
              <Ionicons name="restaurant" size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Live Driver Marker (always rendered when driver is assigned / order is picked_up) */}
        {!!effectiveDriverLocation && (
          <Marker
            coordinate={effectiveDriverLocation}
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
            <View style={[styles.markerDriver, isPickedUpOrEnRoute && styles.markerDriverActive]}>
              <Ionicons name="bicycle" size={22} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Route Polyline between Driver and Customer */}
        {!!effectiveDriverLocation && (
          <Polyline
            coordinates={[effectiveDriverLocation, userLocation]}
            strokeColor={isPickedUpOrEnRoute ? colors.success : colors.primary}
            strokeWidth={4}
            lineDashPattern={[6, 6]}
          />
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
          <Ionicons name="locate" size={22} color={colors.primary} />
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
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={styles.etaText}>
                ~{etaMinutes} min ({distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)} km`})
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
            <ActivityIndicator color={colors.primary} size="small" />
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
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
    backgroundColor: '#FFF7ED',
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
    color: colors.primary,
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