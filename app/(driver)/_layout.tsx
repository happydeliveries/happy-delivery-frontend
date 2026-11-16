import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { Tabs, router } from 'expo-router';

import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';
import { driverService } from '../../services/driver';
import { useDriverAlertStore } from '../../store/driverAlertStore';
import {
  startDriverOrderAlert,
  stopDriverOrderAlert,
  releaseDriverOrderAlertResources,
} from '../../services/driverAlertSound';

function formatDispatchAddress(address: any): string {
  if (!address) return 'Customer delivery address';
  if (typeof address === 'string') {
    const trimmed = address.trim();
    if (!trimmed) return 'Customer delivery address';
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return (
          [parsed.street || parsed.address, parsed.city]
            .filter(Boolean)
            .join(', ') || trimmed
        );
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }
  if (typeof address === 'object') {
    return (
      [address.street || address.address, address.city]
        .filter(Boolean)
        .join(', ') || 'Customer delivery address'
    );
  }
  return 'Customer delivery address';
}

export default function DriverLayout() {
  const socket = useSocket();
  const { user } = useAuth();
  const {
    isOnline,
    alertOrders,
    setOnlineStatus,
    enqueueOrderAlert,
    syncAvailableOrders,
    removeOrderAlert,
    pruneExpiredAlerts,
    reset: resetAlerts,
  } = useDriverAlertStore();

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize driver online status & pull any pending available orders on launch
  useEffect(() => {
    if (!user || user.role !== 'driver') {
      stopDriverOrderAlert();
      resetAlerts();
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const statsRes: any = await driverService.getStats();
        const statsData = statsRes?.data || statsRes;
        const available = Boolean(statsData?.isAvailable);
        if (!mounted) return;
        setOnlineStatus(available);

        if (available) {
          const ordersRes: any = await driverService.getAvailableOrders();
          const list = Array.isArray(ordersRes?.data)
            ? ordersRes.data
            : Array.isArray(ordersRes)
              ? ordersRes
              : [];
          if (mounted) syncAvailableOrders(list);
        }
      } catch {
        // ignore startup sync errors
      }
    })();

    return () => {
      mounted = false;
      releaseDriverOrderAlertResources();
      resetAlerts();
    };
  }, [user?.id, user?.role]);

  // Keep driver socket room synchronized with online status & listen for real-time order availability
  useEffect(() => {
    if (!socket || !user || user.role !== 'driver') return;

    const syncRoomsAndQueue = async () => {
      if (isOnline) {
        socket.emit('join_driver_room');
        try {
          const ordersRes: any = await driverService.getAvailableOrders();
          const list = Array.isArray(ordersRes?.data)
            ? ordersRes.data
            : Array.isArray(ordersRes)
              ? ordersRes
              : [];
          syncAvailableOrders(list);
        } catch {
          // ignore
        }
      } else {
        socket.emit('leave_driver_room');
      }
    };

    syncRoomsAndQueue();

    const handleNewOrder = (data: any) => {
      if (!useDriverAlertStore.getState().isOnline) return;
      enqueueOrderAlert(data);
    };

    const handleOrderUnavailable = (data: any) => {
      const targetId = String(data?.orderId || data?.order_id || '');
      if (!targetId) return;
      removeOrderAlert(targetId, data?.reason === 'declined');
    };

    const handleOrderUpdate = (data: any) => {
      const targetId = String(data?.orderId || data?.order_id || data?.order?.id || '');
      const status = data?.status || data?.new_status || data?.order?.status;
      if (
        targetId &&
        ['accepted_by_driver', 'cancelled', 'no_drivers_available', 'delivered'].includes(status)
      ) {
        removeOrderAlert(targetId);
      }
    };

    socket.on('connect', syncRoomsAndQueue);
    socket.on('new_order', handleNewOrder);
    socket.on('order_unavailable', handleOrderUnavailable);
    socket.on('order_update', handleOrderUpdate);

    return () => {
      socket.off('connect', syncRoomsAndQueue);
      socket.off('new_order', handleNewOrder);
      socket.off('order_unavailable', handleOrderUnavailable);
      socket.off('order_update', handleOrderUpdate);
    };
  }, [socket, user?.id, user?.role, isOnline]);

  // Drive continuous sound & vibration while at least one available order awaits response
  const activeAlert = isOnline && alertOrders.length > 0 ? alertOrders[0] : null;

  useEffect(() => {
    if (!activeAlert) {
      stopDriverOrderAlert();
      pulseAnim.setValue(1);
      return;
    }

    startDriverOrderAlert({
      title: `New Delivery • ${activeAlert.restaurant_name}`,
      body: `Order ${activeAlert.order_number} ready for pickup. Open app to accept or decline.`,
    });

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 450, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
      ])
    );
    anim.start();

    const ticker = setInterval(() => {
      setNowMs(Date.now());
      pruneExpiredAlerts();
    }, 1000);

    return () => {
      anim.stop();
      clearInterval(ticker);
    };
  }, [activeAlert?.id, Boolean(activeAlert)]);

  const handleAcceptIncoming = async () => {
    if (!activeAlert || submittingId) return;
    const orderId = activeAlert.id;
    setSubmittingId(orderId);
    try {
      await driverService.acceptOrder(orderId);
      removeOrderAlert(orderId, true);
      router.push(`/(driver)/orders/${orderId}`);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Order is no longer available.';
      removeOrderAlert(orderId, true);
      Alert.alert('Order Unavailable', msg);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDeclineIncoming = async () => {
    if (!activeAlert || submittingId) return;
    const orderId = activeAlert.id;
    setSubmittingId(orderId);
    try {
      await driverService.declineOrder(orderId).catch(() => {});
      removeOrderAlert(orderId, true);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleViewIncomingDetails = () => {
    if (!activeAlert || submittingId) return;
    const orderId = activeAlert.id;
    removeOrderAlert(orderId, true);
    router.push(`/(driver)/orders/${orderId}`);
  };

  const remainingSeconds = activeAlert?.expiresAt
    ? Math.max(0, Math.floor((activeAlert.expiresAt - nowMs) / 1000))
    : null;
  const remainingFormatted =
    remainingSeconds != null
      ? `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`
      : null;

  return (
    <>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.gray500,
          tabBarShowLabel: true,
          tabBarLabelStyle: styles.tabBarLabel,
        }}
      >
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <Ionicons name={focused ? 'speedometer' : 'speedometer-outline'} size={size} color={(color ?? colors.primary) as string} />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <MaterialIcons name={focused ? 'delivery-dining' : 'delivery-dining'} size={size} color={(color ?? colors.primary) as string} />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="earnings/index"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <FontAwesome5 name={focused ? 'money-bill-alt' : 'money-bill-alt'} size={size} color={color} />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={(color ?? colors.primary) as string} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile/vehicle"
        options={{ 
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />

    </Tabs>

      {/* Fullscreen Dispatch Alert Modal (plays continuous sound + vibration until resolved) */}
      <Modal
        visible={Boolean(activeAlert)}
        transparent
        animationType="slide"
        statusBarTranslucent
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertTopRow}>
              <Animated.View style={[styles.ringIconWrap, { transform: [{ scale: pulseAnim }] }]}>
                <Ionicons name="notifications" size={30} color="#fff" />
              </Animated.View>
              <View style={styles.alertTopMeta}>
                <Text style={styles.alertKicker}>INCOMING DELIVERY REQUEST</Text>
                <Text style={styles.alertOrderNumber}>
                  {activeAlert?.order_number}
                </Text>
              </View>
              {alertOrders.length > 1 && (
                <View style={styles.queueBadge}>
                  <Text style={styles.queueBadgeText}>+{alertOrders.length - 1} more</Text>
                </View>
              )}
            </View>

            {remainingFormatted != null && (
              <View style={styles.timerRow}>
                <Ionicons name="time-outline" size={16} color={colors.warning} />
                <Text style={styles.timerText}>Expires in {remainingFormatted}</Text>
              </View>
            )}

            <View style={styles.routeCard}>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                <View style={styles.routeTextWrap}>
                  <Text style={styles.routeLabel}>PICK UP</Text>
                  <Text style={styles.routeTitle} numberOfLines={1}>
                    {activeAlert?.restaurant_name}
                  </Text>
                  {!!activeAlert?.restaurant_address && (
                    <Text style={styles.routeSub} numberOfLines={2}>
                      {activeAlert.restaurant_address}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.routeDivider} />

              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
                <View style={styles.routeTextWrap}>
                  <Text style={styles.routeLabel}>DROP OFF</Text>
                  <Text style={styles.routeTitle} numberOfLines={2}>
                    {formatDispatchAddress(activeAlert?.delivery_address)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.privacyBanner}>
              <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
              <Text style={styles.privacyText}>
                Order price & tip are revealed once delivery is completed.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.acceptDispatchBtn, submittingId ? styles.disabledBtn : null]}
              onPress={handleAcceptIncoming}
              disabled={Boolean(submittingId)}
            >
              {submittingId === activeAlert?.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.acceptDispatchText}>Accept Order</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                style={styles.declineDispatchBtn}
                onPress={handleDeclineIncoming}
                disabled={Boolean(submittingId)}
              >
                <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                <Text style={styles.declineDispatchText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewDispatchBtn}
                onPress={handleViewIncomingDetails}
                disabled={Boolean(submittingId)}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                <Text style={styles.viewDispatchText}>View Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopColor: '#eee',
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  activeIcon: {
    color: colors.primary + '20',
    borderRadius: 20,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 28,
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  alertTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ringIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  alertTopMeta: {
    flex: 1,
  },
  alertKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.primary,
  },
  alertOrderNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  queueBadge: {
    backgroundColor: colors.warning + '25',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  queueBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginBottom: 14,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  routeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    marginTop: 5,
    marginRight: 12,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 0.5,
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  routeSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
    marginLeft: 23,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.gray100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
  },
  privacyText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  acceptDispatchBtn: {
    backgroundColor: colors.success,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  acceptDispatchText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  declineDispatchBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.error + '45',
    backgroundColor: '#FEF2F2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  declineDispatchText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
  viewDispatchBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.primary + '55',
    backgroundColor: colors.primary + '10',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  viewDispatchText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});