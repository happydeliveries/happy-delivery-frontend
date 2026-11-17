import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { colors } from '../../../constants/colors';
import { driverService } from '../../../services/driver';
import { orderService } from '../../../services/order';
import { useSocket } from '../../../hooks/useSocket';
import { useDriverAlertStore } from '../../../store/driverAlertStore';
import {
  parseCoordinates,
  computeBearingDegrees,
  trimRouteFromDriver,
  pickNextTurnStep,
  getManeuverIconName,
  formatDistanceCompact,
  formatStepMeters,
  type LatLngCoord,
  type OrderRouteData,
} from '../../../utils/routing';

type OrderItem = {
  id: string;
  name: string;
  item_name?: string;
  quantity: number;
  unit_price?: number | null;
  total_price?: number | null;
  special_instructions?: string;
  selected_options?: any;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status?: string;
  payment_method?: string;
  subtotal?: number | null;
  delivery_fee?: number | null;
  tax_amount?: number | null;
  tip_amount?: number | null;
  total_amount?: number | null;
  driver_earnings?: number | null;
  pricing_hidden?: boolean;
  placed_at: string;
  special_instructions?: string;
  delivery_instructions?: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_phone: string;
  restaurant_location?: any;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | { street: string; city: string; zip: string };
  items: OrderItem[];
  driver_id: string;
  driver_location?: any;
  support_phone?: string | null;
  support_name?: string | null;
  failure_reason?: string | null;
};

export default function DriverOrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const socket = useSocket();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [alertingDispatch, setAlertingDispatch] = useState(false);
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

  // Scan modal state
  const [showScanModal, setShowScanModal] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanAttempts, setScanAttempts] = useState(0);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [driverCoordsState, setDriverCoordsState] = useState<LatLngCoord | null>(null);
  const [driverHeading, setDriverHeading] = useState<number>(0);
  const [routeData, setRouteData] = useState<OrderRouteData | null>(null);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastRestPersistRef = useRef<number>(0);
  const lastSocketLocationRef = useRef<number>(0);
  const lastRouteFetchAtRef = useRef<number>(0);
  const lastDriverPointRef = useRef<LatLngCoord | null>(null);
  const navMapRef = useRef<MapView | null>(null);
  const hasFittedNavMapRef = useRef<boolean>(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const ACTIVE_NAV_STATUSES = ['accepted_by_driver', 'order_ready', 'picked_up', 'on_the_way', 'arrived'];

  const fetchOrderRoute = async (coords?: LatLngCoord | null, force = false) => {
    if (!id) return;
    lastRouteFetchAtRef.current = Date.now();
    try {
      const response: any = await orderService.getOrderRoute(
        id,
        coords ? { lat: coords.latitude, lng: coords.longitude, force } : { force }
      );
      const payload: OrderRouteData | undefined = response?.data || response;
      if (payload && Array.isArray(payload.reactNativeCoords)) {
        setRouteData(payload);
      }
    } catch {
      // Keep existing route/fallback quietly without LogBox noise
    }
  };

  // --- 1. Fetch Data ---
  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  // Listen for real-time order status changes and backend-pushed OSRM route updates
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('join_order', id);
    const handleOrderUpdate = (payload: any) => {
      const nextStatus = payload?.status || payload?.new_status || payload?.order?.status;
      if (nextStatus) {
        if (['accepted_by_driver', 'cancelled', 'no_drivers_available', 'delivered', 'delivery_failed'].includes(nextStatus)) {
          useDriverAlertStore.getState().removeOrderAlert(id);
        }
        hasFittedNavMapRef.current = false;
        fetchOrderDetails();
      }
    };
    const handleOrderUnavailable = (payload: any) => {
      const targetId = String(payload?.orderId || payload?.order_id || '');
      if (targetId === String(id)) {
        useDriverAlertStore.getState().removeOrderAlert(id);
        Alert.alert(
          'Order Assignment Updated',
          'Dispatch updated or reassigned this delivery. Returning to your orders list.'
        );
        fetchOrderDetails();
      }
    };
    const handleDriverLocationEcho = (payload: any) => {
      const eventOrderId = String(payload?.orderId || payload?.order_id || id);
      if (eventOrderId !== String(id)) return;
      if (payload?.route && Array.isArray(payload.route.reactNativeCoords)) {
        setRouteData((prev) => ({
          ...(prev || {}),
          ...payload.route,
          previewRoute: payload.route.previewRoute ?? prev?.previewRoute ?? null,
        }));
      }
    };
    socket.on('order_update', handleOrderUpdate);
    socket.on('order_unavailable', handleOrderUnavailable);
    socket.on('driver_location', handleDriverLocationEcho);
    return () => {
      socket.off('order_update', handleOrderUpdate);
      socket.off('order_unavailable', handleOrderUnavailable);
      socket.off('driver_location', handleDriverLocationEcho);
    };
  }, [socket, id]);

  // Refresh OSRM route when order enters or switches between pickup/drop-off transit legs
  useEffect(() => {
    if (!order || !ACTIVE_NAV_STATUSES.includes(order.status)) {
      setRouteData(null);
      return;
    }
    hasFittedNavMapRef.current = false;
    fetchOrderRoute(driverCoordsState || parseCoordinates(order.driver_location), true);
  }, [order?.status, order?.id]);

  const fetchOrderDetails = async () => {
    try {
      const response: any = await driverService.getOrder(id);
      const data = response.data || response;
      setOrder(data);
      const initialDriverPos = parseCoordinates(data?.driver_location);
      if (initialDriverPos && !driverCoordsState) {
        setDriverCoordsState(initialDriverPos);
      }
    } catch (error) {
      const { showFriendlyError } = (await import('../../../store/feedbackStore')).useFeedbackStore.getState();
      showFriendlyError(error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get current GPS coordinates (with fallback to last known or restaurant location)
  const getCurrentDriverCoords = async (): Promise<{ lat: number; lng: number } | undefined> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos =
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null)) ||
          (await Location.getLastKnownPositionAsync().catch(() => null));
        if (pos?.coords) {
          return {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
        }
      }
    } catch {
      // ignore and try fallback
    }

    // Fallback to restaurant coordinates if GPS is unavailable on simulator/device
    const rLoc = order?.restaurant_location;
    if (rLoc && typeof rLoc === 'object') {
      const lat = Number(rLoc.latitude ?? rLoc.y);
      const lng = Number(rLoc.longitude ?? rLoc.x);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
    return undefined;
  };

  const broadcastDriverPosition = (
    lat: number,
    lng: number,
    accuracy?: number | null,
    speed?: number | null,
    forceRest = false,
    heading?: number | null
  ) => {
    const now = Date.now();
    lastSocketLocationRef.current = now;

    const nextCoord: LatLngCoord = { latitude: lat, longitude: lng };
    const resolvedHeading =
      heading !== null && heading !== undefined && Number.isFinite(heading) && heading >= 0
        ? heading
        : computeBearingDegrees(lastDriverPointRef.current, nextCoord) ?? 0;

    lastDriverPointRef.current = nextCoord;
    setDriverCoordsState(nextCoord);
    setDriverHeading(resolvedHeading);

    // Trim local route geometry smoothly behind the driver between OSRM refreshes
    setRouteData((prev) => {
      if (!prev || !Array.isArray(prev.reactNativeCoords) || prev.reactNativeCoords.length < 2) {
        return prev;
      }
      return {
        ...prev,
        reactNativeCoords: trimRouteFromDriver(prev.reactNativeCoords, nextCoord),
      };
    });

    if (order && ACTIVE_NAV_STATUSES.includes(order.status) && now - lastRouteFetchAtRef.current >= 35000) {
      fetchOrderRoute(nextCoord);
    }

    if (socket?.connected && order) {
      socket.emit('driver_location_update', {
        driverId: order.driver_id,
        orderId: id,
        location: [lng, lat],
        latitude: lat,
        longitude: lng,
        heading: resolvedHeading,
        accuracy: accuracy ?? null,
        speed: speed ?? null,
      });
      if (!forceRest) return;
    }

    // Only hit REST PUT /drivers/location when socket is disconnected or explicitly forced
    if (forceRest || now - lastRestPersistRef.current >= 15000) {
      lastRestPersistRef.current = now;
      driverService
        .updateLocation(lat, lng, id, {
          accuracy: accuracy ?? null,
          speed: speed ?? null,
          heading: resolvedHeading,
        })
        .catch(() => {});
    }
  };

  // --- 2. Live GPS Socket Stream (REST only when socket is disconnected) ---
  useEffect(() => {
    let isMounted = true;
    let staleWatchdogTimer: ReturnType<typeof setInterval> | null = null;

    const startTracking = async () => {
      const activeStatuses = ['accepted_by_driver', 'order_ready', 'picked_up', 'on_the_way', 'arrived'];
      
      // If the order is complete or not in an active transit state, KILL the tracker
      if (!order || !order.driver_id || !activeStatuses.includes(order.status)) {
        stopTracking();
        return;
      }

      if (socket && id) {
        socket.emit('join_order', id);
      }

      // Prevent duplicate watchers if one is already running
      if (locationSubscription.current) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Still broadcast fallback restaurant location when picked_up so customer map works on emulators without GPS
        const fallback = await getCurrentDriverCoords();
        if (fallback && isMounted) {
          broadcastDriverPosition(fallback.lat, fallback.lng, null, null, !socket?.connected, 0);
        }
        return;
      }

      setIsLiveTracking(true);
      
      // Start pulsing animation for the "LIVE" badge
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      ).start();

      // Send an immediate GPS ping as soon as tracking starts
      const initialCoords = await getCurrentDriverCoords();
      if (initialCoords && isMounted) {
        broadcastDriverPosition(initialCoords.lat, initialCoords.lng, null, null, false, 0);
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000,     // Stream every 4 seconds when moving
          distanceInterval: 10,   // Avoid redundant socket emissions when stationary
        },
        (location) => {
          if (isMounted) {
            broadcastDriverPosition(
              location.coords.latitude,
              location.coords.longitude,
              location.coords.accuracy,
              location.coords.speed,
              false,
              location.coords.heading ?? 0
            );
          }
        }
      );

      // Stationary/emulator watchdog: only check every 15s if watchPositionAsync hasn't fired recently
      staleWatchdogTimer = setInterval(async () => {
        if (!isMounted) return;
        if (Date.now() - lastSocketLocationRef.current < 12000) return;
        const coords = await getCurrentDriverCoords();
        if (coords && isMounted) {
          broadcastDriverPosition(coords.lat, coords.lng);
        }
      }, 15000);
    };

    const stopTracking = () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
      if (staleWatchdogTimer) {
        clearInterval(staleWatchdogTimer);
        staleWatchdogTimer = null;
      }
      setIsLiveTracking(false);
      pulseAnim.setValue(1);
    };

    startTracking();

    // Cleanup: When screen unmounts or status changes, kill the tracker
    return () => {
      isMounted = false;
      stopTracking();
    };
  }, [order?.status, socket, id]);


  // --- 3. Order Actions ---
  const handleAcceptAvailableOrder = async () => {
    setUpdating(true);
    try {
      await driverService.acceptOrder(id);
      useDriverAlertStore.getState().removeOrderAlert(id, true);
      const coords = await getCurrentDriverCoords();
      if (coords) {
        broadcastDriverPosition(coords.lat, coords.lng);
      }
      await fetchOrderDetails();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to accept order');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const coords = await getCurrentDriverCoords();
      await driverService.updateOrderStatus(id, newStatus, coords);
      if (coords) {
        broadcastDriverPosition(coords.lat, coords.lng);
      }
      await fetchOrderDetails(); // Refresh to see changes and trigger/kill GPS
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleScanDeliveryCode = () => {
    // Reset scan state each time the modal opens
    setScanned(false);
    setScanAttempts(0);
    setManualMode(false);
    setManualCode('');
    setScanMessage(null);
    setScanLoading(false);
    // Request camera permission if not already granted
    if (cameraPermission && !cameraPermission.granted && cameraPermission.canAskAgain) {
      requestCameraPermission();
    }
    setShowScanModal(true);
  };

  const verifyScanCode = async (code: string) => {
    if (!id) {
      setScanMessage('Missing order ID.');
      return;
    }
    setScanLoading(true);
    setScanMessage(null);
    let successful = false;

    try {
      const verifyRes: any = await driverService.verifyDeliveryCode(id, code.trim());
      const completedOrder = verifyRes?.data ?? verifyRes;
      successful = true;
      setShowScanModal(false);
      await fetchOrderDetails();
      const orderTotal = Number(completedOrder?.total_amount ?? 0).toFixed(2);
      const tipAmount = Number(completedOrder?.tip_amount ?? 0).toFixed(2);
      const earned = Number(
        completedOrder?.driver_earnings ??
          ((Number(completedOrder?.delivery_fee || 0) > 0
            ? Number(completedOrder?.delivery_fee || 0) * 0.7
            : Number(completedOrder?.total_amount || 0) * 0.15) +
            Number(completedOrder?.tip_amount || 0))
      ).toFixed(2);
      Alert.alert(
        'Delivery Completed!',
        `Order Price: R${orderTotal}\nCustomer Tip: R${tipAmount}\nYour Earnings: R${earned}`
      );
    } catch (error: any) {
      const errorText =
        error.response?.data?.error ||
        error.message ||
        'Delivery code verification failed';
      setScanMessage(errorText);
      setScanAttempts((prev) => {
        const next = prev + 1;
        if (next >= 3) {
          setManualMode(true);
        }
        return next;
      });
    } finally {
      setScanLoading(false);
      if (!successful) {
        setScanned(false);
      }
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || scanLoading) return;
    setScanned(true);
    await verifyScanCode(data);
  };

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      setScanMessage('Please enter the fallback delivery code.');
      return;
    }
    await verifyScanCode(manualCode);
  };

  const openMaps = (address: string | any) => {
    const addrString = typeof address === 'object' ? `${address.street}, ${address.city}` : address;
    const url = Platform.select({
      ios: `maps:0,0?q=${addrString}`,
      android: `geo:0,0?q=${addrString}`,
    });
    Linking.openURL(url || '');
  };

  const callNumber = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleReportCustomerUnreachable = async () => {
    if (!order || alertingDispatch) return;
    Alert.alert(
      'Customer Not Answering?',
      'This will alert Happy Dispatch immediately with the customer’s phone number so Happy can call the customer before closing this order.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Alert & Call Happy',
          onPress: async () => {
            setAlertingDispatch(true);
            try {
              const res: any = await driverService.reportCustomerUnreachable(
                order.id,
                `Driver at drop-off (${order.status}) cannot reach customer`
              );
              const hotPhone =
                res?.data?.support_contact?.support_phone ||
                order.support_phone ||
                supportPhoneFallback;
              if (hotPhone) {
                Alert.alert(
                  'Happy Dispatch Alerted',
                  'Happy now sees your unreachable alert and the customer phone number. Call Happy Dispatch now to coordinate next steps.',
                  [
                    { text: 'Later', style: 'cancel' },
                    { text: 'Call Happy Now', onPress: () => Linking.openURL(`tel:${hotPhone}`) },
                  ]
                );
              } else {
                Alert.alert(
                  'Happy Dispatch Alerted',
                  'Happy Dispatch has been notified that the customer is unreachable.'
                );
              }
            } catch (err: any) {
              Alert.alert('Alert Error', err?.response?.data?.error || err?.message || 'Could not reach Dispatch');
            } finally {
              setAlertingDispatch(false);
            }
          },
        },
      ]
    );
  };

  const getNextAction = () => {
    if (!order) return null;
    if (!order.driver_id && ['ordering_at_restaurant', 'order_ready'].includes(order.status) && order.payment_status === 'completed') {
      return { label: 'Accept Order', actionType: 'accept', icon: 'checkmark-circle' };
    }
    switch (order.status) {
      case 'accepted_by_driver':
      case 'order_ready':
        return { label: 'Confirm Pick Up', status: 'picked_up', icon: 'cube' };
      case 'picked_up':
        return { label: 'Start Delivery', status: 'on_the_way', icon: 'navigate' };
      case 'on_the_way':
        return { label: 'Arrived at Customer', status: 'arrived', icon: 'location' };
      case 'arrived':
        return { label: 'Scan Delivery Code', actionType: 'scan', icon: 'scan' };
      default:
        return null;
    }
  };

  const formatAddress = (address: any) => {
    if (typeof address === 'object' && address !== null) {
      return `${address.street}, ${address.city}`;
    }
    return address || 'Unknown Address';
  };

  const goBackToOrders = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(driver)/orders');
    }
  };

  const isNavActiveOrder = Boolean(order && ACTIVE_NAV_STATUSES.includes(order.status));
  const isDropoffLeg = Boolean(order && ['picked_up', 'on_the_way', 'arrived'].includes(order.status));
  const navDriverCoords = driverCoordsState || routeData?.driverCoords || null;
  const navRestaurantCoords = routeData?.restaurantCoords || parseCoordinates(order?.restaurant_location);
  const navCustomerCoords = routeData?.customerCoords || parseCoordinates(order?.delivery_address);
  const targetStopCoords = isDropoffLeg ? navCustomerCoords : navRestaurantCoords;

  const activeRouteCoords: LatLngCoord[] =
    routeData?.reactNativeCoords && routeData.reactNativeCoords.length >= 2
      ? routeData.reactNativeCoords
      : navDriverCoords && targetStopCoords
      ? [navDriverCoords, targetStopCoords]
      : [];

  const fitNavMap = (force = false) => {
    if (!navMapRef.current) return;
    if (!force && hasFittedNavMapRef.current) return;

    const coordsToFit: LatLngCoord[] = [];
    if (activeRouteCoords.length >= 2) {
      coordsToFit.push(...activeRouteCoords);
    } else {
      if (navDriverCoords) coordsToFit.push(navDriverCoords);
      if (navRestaurantCoords) coordsToFit.push(navRestaurantCoords);
      if (navCustomerCoords && isDropoffLeg) coordsToFit.push(navCustomerCoords);
    }

    if (coordsToFit.length >= 2) {
      hasFittedNavMapRef.current = true;
      navMapRef.current.fitToCoordinates(coordsToFit, {
        edgePadding: { top: 88, right: 32, bottom: 32, left: 32 },
        animated: true,
      });
    } else if (coordsToFit.length === 1) {
      hasFittedNavMapRef.current = true;
      navMapRef.current.animateToRegion(
        {
          latitude: coordsToFit[0].latitude,
          longitude: coordsToFit[0].longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        350
      );
    }
  };

  useEffect(() => {
    if (!isNavActiveOrder || activeRouteCoords.length < 2) return;
    fitNavMap(false);
  }, [isNavActiveOrder, routeData?.leg, routeData?.reactNativeCoords?.length]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text>Order not found</Text>
        <TouchableOpacity style={[styles.retryButton, { marginTop: 16 }]} onPress={goBackToOrders}>
          <Text style={styles.retryText}>Back to Orders</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nextAction = getNextAction();
  const nextTurnStep = pickNextTurnStep(routeData?.steps, navDriverCoords);
  const initialNavFocus = navDriverCoords || targetStopCoords || navRestaurantCoords || navCustomerCoords;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackToOrders} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{order.order_number || order.id.slice(0, 6)}</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Status Banner with Live Indicator */}
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{order.status.replace(/_/g, ' ').toUpperCase()}</Text>
          {isLiveTracking && (
            <Animated.View style={[styles.liveBadge, { opacity: pulseAnim }]}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE GPS</Text>
            </Animated.View>
          )}
        </View>

        {/* Live Road-Following Turn-by-Turn Route Card */}
        {isNavActiveOrder && initialNavFocus && (
          <View style={styles.navCard}>
            <MapView
              ref={navMapRef}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              style={styles.navMap}
              initialRegion={{
                latitude: initialNavFocus.latitude,
                longitude: initialNavFocus.longitude,
                latitudeDelta: 0.025,
                longitudeDelta: 0.025,
              }}
              onMapReady={() => fitNavMap(false)}
            >
              {/* Pre-pickup secondary preview route: Restaurant -> Customer */}
              {!isDropoffLeg &&
                routeData?.previewRoute?.reactNativeCoords &&
                routeData.previewRoute.reactNativeCoords.length >= 2 && (
                  <Polyline
                    coordinates={routeData.previewRoute.reactNativeCoords}
                    strokeColor="rgba(107, 114, 128, 0.55)"
                    strokeWidth={3}
                    lineDashPattern={[6, 6]}
                  />
                )}

              {/* Active leg casing + highlighted road route */}
              {activeRouteCoords.length >= 2 && (
                <>
                  <Polyline
                    coordinates={activeRouteCoords}
                    strokeColor={isDropoffLeg ? '#065F46' : '#1E3A8A'}
                    strokeWidth={7}
                    lineCap="round"
                    lineJoin="round"
                  />
                  <Polyline
                    coordinates={activeRouteCoords}
                    strokeColor={isDropoffLeg ? '#10B981' : '#3B82F6'}
                    strokeWidth={4}
                    lineCap="round"
                    lineJoin="round"
                  />
                </>
              )}

              {!!navRestaurantCoords && (
                <Marker coordinate={navRestaurantCoords} title={order.restaurant_name || 'Pickup'}>
                  <View style={[styles.stopPin, { backgroundColor: '#F59E0B' }]}>
                    <Ionicons name="restaurant" size={13} color="#fff" />
                  </View>
                </Marker>
              )}

              {!!navCustomerCoords && (
                <Marker coordinate={navCustomerCoords} title={order.customer_name || 'Drop-off'}>
                  <View style={[styles.stopPin, { backgroundColor: '#18181B' }]}>
                    <Ionicons name="home" size={13} color="#fff" />
                  </View>
                </Marker>
              )}

              {!!navDriverCoords && (
                <Marker
                  coordinate={navDriverCoords}
                  title="Your Location"
                  flat
                  anchor={{ x: 0.5, y: 0.5 }}
                  rotation={Platform.OS === 'android' ? driverHeading : 0}
                >
                  <View
                    style={[
                      styles.driverPin,
                      Platform.OS === 'ios'
                        ? { transform: [{ rotate: `${driverHeading}deg` }] }
                        : null,
                    ]}
                  >
                    <Ionicons name="navigate" size={16} color="#fff" />
                  </View>
                </Marker>
              )}
            </MapView>

            {/* Floating Turn-by-Turn Navigation Header */}
            <View style={styles.navOverlayCard}>
              <View style={styles.navManeuverIconBox}>
                <Ionicons
                  name={getManeuverIconName(nextTurnStep?.maneuverType, nextTurnStep?.modifier)}
                  size={20}
                  color="#FACC15"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.navInstructionText} numberOfLines={2}>
                  {nextTurnStep?.instruction ||
                    (isDropoffLeg ? 'Continue toward customer drop-off' : 'Head toward restaurant pickup')}
                </Text>
                <Text style={styles.navSubMetaText} numberOfLines={1}>
                  {isDropoffLeg ? 'TO CUSTOMER' : 'TO PICKUP'}
                  {nextTurnStep?.distanceMeters ? ` • ${formatStepMeters(nextTurnStep.distanceMeters)}` : ''}
                </Text>
              </View>
              <View style={styles.navMetricsCol}>
                <Text style={styles.navEtaValue}>
                  {routeData?.durationMinutes ? `${routeData.durationMinutes}m` : '--'}
                </Text>
                <Text style={styles.navDistValue}>
                  {formatDistanceCompact(routeData?.distanceKm)}
                </Text>
              </View>
            </View>

            {/* Recenter Map Control */}
            <TouchableOpacity
              style={styles.navRecenterBtn}
              onPress={() => fitNavMap(true)}
              accessibilityLabel="Fit active route"
            >
              <Ionicons name="expand-outline" size={16} color="#18181B" />
            </TouchableOpacity>
          </View>
        )}

        {/* 1. Pick Up Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Pick Up</Text>
            <TouchableOpacity onPress={() => callNumber(order.restaurant_phone)}>
              <Ionicons name="call" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{order.restaurant_name}</Text>
          <Text style={styles.address}>{order.restaurant_address}</Text>
          <TouchableOpacity 
            style={styles.mapBtn} 
            onPress={() => openMaps(order.restaurant_address)}
          >
            <Ionicons name="map" size={16} color={colors.primary} />
            <Text style={styles.mapBtnText}>Navigate to Restaurant</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Delivery Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Drop Off</Text>
            <TouchableOpacity onPress={() => callNumber(order.customer_phone)}>
              <Ionicons name="call" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{order.customer_name}</Text>
          <Text style={styles.address}>{formatAddress(order.delivery_address)}</Text>
          
          {order.delivery_instructions ? (
            <View style={styles.noteContainer}>
              <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
              <Text style={styles.noteText}>{order.delivery_instructions}</Text>
            </View>
          ) : null}

          <TouchableOpacity 
            style={styles.mapBtn}
            onPress={() => openMaps(order.delivery_address)}
          >
            <Ionicons name="navigate" size={16} color={colors.primary} />
            <Text style={styles.mapBtnText}>Navigate to Customer</Text>
          </TouchableOpacity>
        </View>

        {order.status === 'delivery_failed' && (
          <View style={[styles.card, { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5' }]}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#991B1B', marginBottom: 4 }}>
              Delivery Closed · Customer Unreachable
            </Text>
            <Text style={{ fontSize: 13, color: '#B91C1C', lineHeight: 19 }}>
              {order.failure_reason ||
                'Happy Dispatch closed this delivery because the customer could not be reached. Your delivery fee has been credited to your earnings.'}
            </Text>
          </View>
        )}

        {['accepted_by_driver', 'order_ready', 'picked_up', 'on_the_way', 'arrived'].includes(order.status) && (
          <View style={[styles.card, { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D' }]}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E', textTransform: 'uppercase', marginBottom: 6 }}>
              Dispatch Support &amp; Emergencies
            </Text>
            <Text style={{ fontSize: 12.5, color: '#78350F', marginBottom: 10, lineHeight: 18 }}>
              Cannot cancel an accepted delivery on your own. Call Happy Dispatch immediately for emergencies or if the customer refuses to answer.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {!!(order.support_phone || supportPhoneFallback) && (
                <TouchableOpacity
                  style={{
                    flex: 1,
                    minWidth: 135,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#F59E0B',
                  }}
                  onPress={() => callNumber((order.support_phone || supportPhoneFallback) as string)}
                >
                  <Ionicons name="headset" size={17} color="#B45309" />
                  <Text style={{ color: '#92400E', fontWeight: '700', fontSize: 13 }}>
                    Call Happy Dispatch
                  </Text>
                </TouchableOpacity>
              )}
              {['picked_up', 'on_the_way', 'arrived'].includes(order.status) && (
                <TouchableOpacity
                  style={{
                    flex: 1,
                    minWidth: 165,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: '#DC2626',
                  }}
                  onPress={handleReportCustomerUnreachable}
                  disabled={alertingDispatch}
                >
                  <Ionicons name="alert-circle" size={17} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    {alertingDispatch ? 'Alerting Happy...' : 'Customer Not Answering'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* 3. Order Items */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {(order.items || []).map((item, index) => {
            const rawOpts = item.selected_options;
            let parsedOpts: Record<string, any> | null = null;
            if (rawOpts && typeof rawOpts === 'object') {
              parsedOpts = rawOpts;
            } else if (typeof rawOpts === 'string' && rawOpts.trim()) {
              try {
                parsedOpts = JSON.parse(rawOpts);
              } catch {
                parsedOpts = null;
              }
            }
            const optionSummary = parsedOpts
              ? Object.entries(parsedOpts)
                  .map(([grp, val]) => {
                    if (val == null || val === '') return '';
                    if (Array.isArray(val)) {
                      const list = val
                        .map((v) =>
                          typeof v === 'object' && v !== null
                            ? v.name || v.label || ''
                            : String(v)
                        )
                        .filter(Boolean)
                        .join(', ');
                      return list ? `${grp}: ${list}` : '';
                    }
                    if (typeof val === 'object') {
                      return val.name || val.label ? `${grp}: ${val.name || val.label}` : '';
                    }
                    return `${grp}: ${val}`;
                  })
                  .filter(Boolean)
                  .join(' • ')
              : '';

            return (
              <View key={item.id || index} style={styles.itemRow}>
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyText}>{item.quantity}x</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name || item.item_name}</Text>
                  {!!optionSummary && (
                    <Text style={[styles.itemNote, { fontStyle: 'normal', color: colors.textSecondary }]}>
                      {optionSummary}
                    </Text>
                  )}
                  {item.special_instructions ? (
                    <Text style={styles.itemNote}>Note: {item.special_instructions}</Text>
                  ) : null}
                </View>
                {(order.status === 'delivered' || order.status === 'delivery_failed') && (
                  <Text style={styles.itemPrice}>
                    R{Number(item.total_price ?? Number(item.unit_price || 0) * item.quantity).toFixed(2)}
                  </Text>
                )}
              </View>
            );
          })}
          
          <View style={styles.divider} />
          {(order.status === 'delivered' || order.status === 'delivery_failed') ? (
            <View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>R{Number(order.subtotal || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>R{Number(order.delivery_fee || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>R{Number(order.tax_amount || 0).toFixed(2)}</Text>
              </View>
              <View style={[styles.totalRow, { marginTop: 6 }]}>
                <Text style={styles.totalLabel}>
                  {order.payment_status === 'completed' ? 'Order Price (Paid)' : 'Order Price'}
                </Text>
                <Text style={styles.totalValue}>R{Number(order.total_amount || 0).toFixed(2)}</Text>
              </View>

              <View style={styles.payoutCard}>
                <Text style={styles.payoutCardTitle}>Your Completed Payout</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Customer Tip</Text>
                  <Text style={[styles.summaryValue, { color: colors.success, fontWeight: '700' }]}>
                    +R{Number(order.tip_amount || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={[styles.totalRow, { marginTop: 4 }]}>
                  <Text style={styles.payoutTotalLabel}>Total Earned</Text>
                  <Text style={styles.payoutTotalValue}>
                    R{Number(
                      order.driver_earnings ??
                        ((Number(order.delivery_fee || 0) > 0
                          ? Number(order.delivery_fee || 0) * 0.7
                          : Number(order.total_amount || 0) * 0.15) +
                          Number(order.tip_amount || 0))
                    ).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.hiddenBreakdownBox}>
              <Ionicons name="lock-closed" size={18} color={colors.textSecondary} />
              <Text style={styles.hiddenBreakdownText}>
                Order price, customer tip, and delivery payout will be shown once you complete this delivery.
              </Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Footer Action Button */}
      {nextAction && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => {
              if (nextAction.actionType === 'scan') handleScanDeliveryCode();
              else if (nextAction.actionType === 'accept') handleAcceptAvailableOrder();
              else if (nextAction.status) handleUpdateStatus(nextAction.status);
            }}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.actionBtnText}>{nextAction.label}</Text>
                <Ionicons name={nextAction.icon as any} size={20} color="#fff" style={{marginLeft: 8}} />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Embedded Delivery Code Scanner Modal */}
      <Modal
        visible={showScanModal}
        animationType="slide"
        onRequestClose={() => setShowScanModal(false)}
      >
        <SafeAreaView style={styles.scanModalContainer}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.scanHeader}>
              <TouchableOpacity
                onPress={() => setShowScanModal(false)}
                style={styles.scanHeaderBtn}
                accessibilityLabel="Close scanner"
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.scanTitle}>Verify Delivery Code</Text>
              <TouchableOpacity
                onPress={() => {
                  setScanMessage(null);
                  setScanned(false);
                  setManualMode((v) => !v);
                }}
                style={styles.scanHeaderBtn}
                accessibilityLabel="Toggle manual entry"
              >
                <Ionicons
                  name={manualMode ? 'qr-code-outline' : 'keypad-outline'}
                  size={22}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.scanContent}>
              <Text style={styles.scanSubtitle}>
                Scan the customer's delivery QR code or enter the code shown on their tracking screen.
              </Text>

              {!manualMode ? (
                !cameraPermission ? (
                  <View style={styles.permissionCard}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.permissionText}>Requesting camera permission...</Text>
                  </View>
                ) : !cameraPermission.granted ? (
                  <View style={styles.permissionCard}>
                    <Ionicons name="camera-outline" size={48} color={colors.textSecondary} />
                    <Text style={styles.permissionText}>
                      Camera access is needed to scan the delivery QR code.
                    </Text>
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={requestCameraPermission}
                    >
                      <Text style={styles.retryText}>Allow Camera Access</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.retryButton, { backgroundColor: colors.gray600, marginTop: 12 }]}
                      onPress={() => setManualMode(true)}
                    >
                      <Text style={styles.retryText}>Enter Code Manually</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.scannerWrapper}>
                    {showScanModal && (
                      <CameraView
                        style={styles.scanner}
                        onBarcodeScanned={scanned || scanLoading ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{
                          barcodeTypes: ['qr'],
                        }}
                      />
                    )}
                    <View style={styles.scannerOverlay}>
                      {scanLoading ? (
                        <View style={styles.scanHintBox}>
                          <ActivityIndicator color="#fff" size="small" />
                          <Text style={styles.scanHint}>Verifying code...</Text>
                        </View>
                      ) : (
                        <Text style={styles.scanHint}>Hold the QR code inside the frame</Text>
                      )}
                    </View>
                  </View>
                )
              ) : (
                <View style={styles.manualContainer}>
                  <Text style={styles.manualLabel}>Enter customer delivery code</Text>
                  <TextInput
                    value={manualCode}
                    onChangeText={setManualCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder="e.g. ABCD-1234"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.manualInput}
                    editable={!scanLoading}
                  />
                  <TouchableOpacity
                    style={styles.verifyCodeBtn}
                    onPress={handleManualSubmit}
                    disabled={scanLoading}
                  >
                    {scanLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.verifyCodeBtnText}>Verify & Complete Order</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.modeSwitchBtn}
                onPress={() => {
                  setScanMessage(null);
                  setScanned(false);
                  setManualMode((v) => !v);
                }}
              >
                <Ionicons
                  name={manualMode ? 'qr-code-outline' : 'keypad-outline'}
                  size={18}
                  color={colors.primary}
                />
                <Text style={styles.modeSwitchText}>
                  {manualMode ? 'Use Camera QR Scanner Instead' : 'Enter Code Manually Instead'}
                </Text>
              </TouchableOpacity>

              <View style={styles.hintBox}>
                <Text style={styles.hintTitle}>Verification tips</Text>
                <Text style={styles.hintText}>
                  Failed scan attempts: {scanAttempts} of 3. Ask the customer to open "Show Delivery Code" on their tracking screen.
                </Text>
              </View>

              {scanMessage ? <Text style={styles.scanErrorText}>{scanMessage}</Text> : null}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 120 },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  
  statusBanner: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusText: { color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },
  
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 4,
  },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 14, color: colors.textSecondary, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  
  name: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
  address: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  
  mapBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: colors.primary + '10', padding: 10, borderRadius: 8, alignSelf: 'flex-start' },
  mapBtnText: { color: colors.primary, fontWeight: '600', fontSize: 13, marginLeft: 6 },

  noteContainer: { flexDirection: 'row', marginTop: 8, backgroundColor: '#FFF3E0', padding: 8, borderRadius: 6 },
  noteText: { marginLeft: 6, color: '#E65100', fontSize: 13, flex: 1 },

  itemRow: { flexDirection: 'row', marginBottom: 12 },
  qtyBadge: { backgroundColor: colors.gray100, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginRight: 10, height: 24, justifyContent: 'center' },
  qtyText: { fontWeight: 'bold', fontSize: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  itemNote: { fontSize: 12, color: colors.textTertiary, marginTop: 2, fontStyle: 'italic' },
  itemPrice: { fontSize: 14, fontWeight: '600' },

  divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: 'bold' },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: colors.primary },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  actionBtn: {
    backgroundColor: colors.success,
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  scanModalContainer: { flex: 1, backgroundColor: '#fff' },
  scanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  scanHeaderBtn: { padding: 6 },
  scanTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  scanContent: { flex: 1, padding: 20 },
  scanSubtitle: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 16,
    lineHeight: 20,
  },
  permissionCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.gray50,
    borderRadius: 20,
  },
  permissionText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  scannerWrapper: {
    flex: 1,
    minHeight: 300,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  scanner: { flex: 1 },
  scannerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: 'center',
  },
  scanHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  scanHint: {
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  manualContainer: { marginTop: 10 },
  manualLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 16,
    color: colors.textPrimary,
  },
  verifyCodeBtn: {
    backgroundColor: colors.success,
    paddingVertical: 15,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyCodeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modeSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 10,
    gap: 8,
  },
  modeSwitchText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  hintBox: {
    marginTop: 12,
    padding: 16,
    backgroundColor: colors.gray50,
    borderRadius: 16,
  },
  hintTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  hintText: {
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 18,
  },
  scanErrorText: {
    marginTop: 14,
    color: colors.error,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 13.5,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13.5,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  payoutCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  payoutCardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#065F46',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  payoutTotalLabel: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#065F46',
  },
  payoutTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669',
  },
  hiddenBreakdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.gray50,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hiddenBreakdownText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  navCard: {
    height: 290,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navMap: {
    width: '100%',
    height: '100%',
  },
  navOverlayCard: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 24, 27, 0.94)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
  navManeuverIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(250, 204, 21, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navInstructionText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 18,
  },
  navSubMetaText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#D4D4D8',
    marginTop: 2,
  },
  navMetricsCol: {
    alignItems: 'flex-end',
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.16)',
  },
  navEtaValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FACC15',
  },
  navDistValue: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#E4E4E7',
  },
  navRecenterBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },
  stopPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  driverPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
});