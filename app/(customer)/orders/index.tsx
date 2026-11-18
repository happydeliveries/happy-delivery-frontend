import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OrderCard, {
  CustomerOrderSummary,
  resolveOrderMediaUrl,
} from '../../../components/customer/OrderCard';
import { orderService } from '../../../services/order';
import { useAuth } from '../../../hooks/useAuth';
import { useSocket } from '../../../hooks/useSocket';

const SWAP_DRIVER_AND_RESTAURANT_IMAGES = false;

const TRACKING_STATUSES = ['accepted_by_driver', 'picked_up', 'on_the_way', 'arrived'];
const ALL_ACTIVE_STATUSES = [
  'pending',
  'ordering_at_restaurant',
  'order_ready',
  ...TRACKING_STATUSES,
];
const CANCELLED_STATUSES = ['cancelled', 'no_drivers_available', 'delivery_failed'];

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const socket = useSocket();
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');
  const [spotlightLogoFailed, setSpotlightLogoFailed] = useState(false);

  const fetchOrders = useCallback(async (silent = false) => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      if (!silent) setLoading(true);
      const response = await orderService.getMyOrders();
      // API interceptor returns response.data directly; shape may be array or {orders:[...]}
      const orderList: CustomerOrderSummary[] = Array.isArray(response)
        ? response
        : (response as any)?.orders ?? (response as any)?.data ?? [];
      setOrders(orderList);
    } catch {
      // Quietly avoid scary LogBox overlay on transient order list fetch failure
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchOrders(orders.length > 0);
      } else {
        setLoading(false);
      }
    }, [user, fetchOrders, orders.length])
  );

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchOrders(true);
    socket.on('order_update', handleUpdate);
    return () => {
      socket.off('order_update', handleUpdate);
    };
  }, [socket, fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const counts = useMemo(() => {
    let active = 0;
    let delivered = 0;
    let cancelled = 0;
    for (const order of orders) {
      if (ALL_ACTIVE_STATUSES.includes(order.status)) active++;
      else if (order.status === 'delivered') delivered++;
      else if (CANCELLED_STATUSES.includes(order.status)) cancelled++;
    }
    return {
      all: orders.length,
      active,
      delivered,
      cancelled,
    };
  }, [orders]);

  const filters = useMemo(
    () => [
      { key: 'all' as const, label: 'All', count: counts.all },
      { key: 'active' as const, label: 'Active', count: counts.active },
      { key: 'delivered' as const, label: 'Delivered', count: counts.delivered },
      { key: 'cancelled' as const, label: 'Cancelled', count: counts.cancelled },
    ],
    [counts]
  );

  const trackingOrders = useMemo(
    () => orders.filter((order) => TRACKING_STATUSES.includes(order.status)),
    [orders]
  );

  const primaryTrackingOrder = useMemo(
    () =>
      trackingOrders.find((order) => order.status === 'picked_up') ||
      trackingOrders.find((order) => ['on_the_way', 'arrived'].includes(order.status)) ||
      trackingOrders[0],
    [trackingOrders]
  );

  const spotlightLogoUri = useMemo(
    () =>
      resolveOrderMediaUrl(primaryTrackingOrder?.restaurant_logo) ||
      resolveOrderMediaUrl(primaryTrackingOrder?.restaurant_cover),
    [primaryTrackingOrder?.restaurant_logo, primaryTrackingOrder?.restaurant_cover]
  );

  useEffect(() => {
    setSpotlightLogoFailed(false);
  }, [spotlightLogoUri]);

  const filteredOrders = useMemo(() => {
    if (selectedFilter === 'all') return orders;
    if (selectedFilter === 'active') {
      return orders.filter((order) => ALL_ACTIVE_STATUSES.includes(order.status));
    }
    if (selectedFilter === 'cancelled') {
      return orders.filter((order) => CANCELLED_STATUSES.includes(order.status));
    }
    return orders.filter((order) => order.status === selectedFilter);
  }, [orders, selectedFilter]);

  const subtitleText = useMemo(() => {
    if (!user) return 'Sign in to track deliveries & revisit favorites';
    if (orders.length === 0) return 'Your food journey starts here';
    const parts: string[] = [];
    if (counts.active > 0) parts.push(`${counts.active} active`);
    parts.push(`${orders.length} total ${orders.length === 1 ? 'order' : 'orders'}`);
    return parts.join(' • ');
  }, [user, orders.length, counts.active]);

  const renderSpotlightBanner = () => {
    if (!primaryTrackingOrder || selectedFilter === 'delivered' || selectedFilter === 'cancelled') {
      return null;
    }

    const isPickedUp = primaryTrackingOrder.status === 'picked_up';
    const isEnRoute = ['on_the_way', 'arrived'].includes(primaryTrackingOrder.status);
    const headline = isPickedUp
      ? 'Order picked up • Driver is on the way'
      : isEnRoute
      ? 'Your courier is heading to you'
      : 'Courier assigned • Watch live progress';

    return (
      <View style={styles.spotlightCard}>
        <View style={styles.spotlightTopRow}>
          <View style={styles.spotlightLogoBox}>
            {spotlightLogoUri && !spotlightLogoFailed ? (
              <Image
                source={{ uri: spotlightLogoUri }}
                style={styles.spotlightLogoImg}
                resizeMode="cover"
                onError={() => setSpotlightLogoFailed(true)}
              />
            ) : (
              <Ionicons name="restaurant" size={20} color="#FFFFFF" />
            )}
          </View>

          <View style={styles.spotlightTextCol}>
            <View style={styles.spotlightTagRow}>
              <View style={styles.spotlightLivePill}>
                <View style={styles.spotlightLiveDot} />
                <Text style={styles.spotlightLiveText}>LIVE DELIVERY</Text>
              </View>
              {!!primaryTrackingOrder.order_number && (
                <Text style={styles.spotlightOrderNum}>#{primaryTrackingOrder.order_number}</Text>
              )}
            </View>
            <Text style={styles.spotlightTitle} numberOfLines={1}>
              {primaryTrackingOrder.restaurant_name || 'Your Order'}
            </Text>
            <Text style={styles.spotlightSub}>{headline}</Text>
          </View>
        </View>

        <View style={styles.spotlightActions}>
          <TouchableOpacity
            style={styles.spotlightPrimaryBtn}
            onPress={() =>
              router.push(`/(customer)/orders/tracking?id=${primaryTrackingOrder.id}`)
            }
            activeOpacity={0.85}
          >
            <Ionicons name="navigate" size={15} color="#FFFFFF" />
            <Text style={styles.spotlightPrimaryBtnText}>Track Live on Map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.spotlightSecondaryBtn}
            onPress={() => router.push(`/(customer)/orders/${primaryTrackingOrder.id}`)}
            activeOpacity={0.85}
          >
            <Text style={styles.spotlightSecondaryBtnText}>Order Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    const isFilteredEmpty = Boolean(user) && orders.length > 0 && selectedFilter !== 'all';

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIllustration}>
          <Ionicons
            name={!user ? 'person-outline' : isFilteredEmpty ? 'filter-outline' : 'fast-food-outline'}
            size={38}
            color="#111827"
          />
        </View>

        <Text style={styles.emptyTitle}>
          {!user
            ? 'Sign in to see your orders'
            : isFilteredEmpty
            ? `No ${selectedFilter} orders`
            : 'No orders yet'}
        </Text>

        <Text style={styles.emptySubtitle}>
          {!user
            ? 'Track live deliveries, pay with Paystack, and quickly reorder your favorites.'
            : isFilteredEmpty
            ? `You do not have any ${selectedFilter} orders right now.`
            : 'Once you place your first order, live updates and receipts will appear right here.'}
        </Text>

        <TouchableOpacity
          style={styles.browseButton}
          activeOpacity={0.85}
          onPress={() => {
            if (!user) {
              router.push('/(auth)/login');
            } else if (isFilteredEmpty) {
              setSelectedFilter('all');
            } else {
              router.push('/(customer)/home');
            }
          }}
        >
          <Ionicons
            name={!user ? 'log-in-outline' : isFilteredEmpty ? 'layers-outline' : 'compass-outline'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.browseButtonText}>
            {!user ? 'Sign In' : isFilteredEmpty ? 'Show All Orders' : 'Browse Restaurants'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderLoadingState = () => (
    <View style={styles.loadingWrapper}>
      <View style={styles.loadingTop}>
        <ActivityIndicator size="small" color="#1C1C1E" />
        <Text style={styles.loadingText}>Fetching your orders...</Text>
      </View>
      {[0, 1, 2].map((idx) => (
        <View key={idx} style={styles.skeletonCard}>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonAvatar} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={styles.skeletonLineWide} />
              <View style={styles.skeletonLineShort} />
            </View>
          </View>
          <View style={styles.skeletonBodyRow}>
            <View style={{ flex: 1, gap: 14 }}>
              <View style={styles.skeletonTrack} />
              <View style={styles.skeletonLineWide} />
            </View>
            <View style={styles.skeletonBox} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Minimal Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>My Orders</Text>
          <Text style={styles.subtitle}>{subtitleText}</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshIconBtn}
          onPress={onRefresh}
          activeOpacity={0.8}
          accessibilityLabel="Refresh orders"
        >
          <Ionicons name="refresh-outline" size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={filters}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const active = selectedFilter === item.key;
            return (
              <TouchableOpacity
                style={[styles.filterButton, active && styles.filterButtonActive]}
                onPress={() => setSelectedFilter(item.key)}
                activeOpacity={0.82}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {item.label}
                </Text>
                {user && item.count > 0 && (
                  <View style={[styles.filterCountPill, active && styles.filterCountPillActive]}>
                    <Text
                      style={[
                        styles.filterCountText,
                        active && styles.filterCountTextActive,
                      ]}
                    >
                      {item.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Orders Feed */}
      {loading ? (
        renderLoadingState()
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderSpotlightBanner}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              swapImages={SWAP_DRIVER_AND_RESTAURANT_IMAGES}
              onPress={() => router.push(`/(customer)/orders/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1C1C1E"
              colors={['#1C1C1E', '#F97316']}
            />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#F6F7F9',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  refreshIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(17, 24, 39, 0.05)',
  },
  filterContainer: {
    paddingBottom: 12,
    backgroundColor: '#F6F7F9',
  },
  filterList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  filterButtonActive: {
    backgroundColor: '#1C1C1E',
    borderColor: '#1C1C1E',
  },
  filterText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#374151',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterCountPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
  },
  filterCountPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  filterCountText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4B5563',
    fontVariant: ['tabular-nums'],
  },
  filterCountTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 110,
    flexGrow: 1,
  },
  spotlightCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: 16,
    marginBottom: 14,
    boxShadow: '0 6px 16px rgba(17, 24, 39, 0.14)',
  },
  spotlightTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  spotlightLogoBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#2C2C2E',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightLogoImg: {
    width: '100%',
    height: '100%',
  },
  spotlightTextCol: {
    flex: 1,
    gap: 2,
  },
  spotlightTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  spotlightLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  spotlightLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316',
  },
  spotlightLiveText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FB923C',
    letterSpacing: 0.5,
  },
  spotlightOrderNum: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  spotlightTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  spotlightSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.78)',
  },
  spotlightActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  spotlightPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F97316',
    paddingVertical: 10,
    borderRadius: 999,
  },
  spotlightPrimaryBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  spotlightSecondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F5F5F5',
  },
  loadingWrapper: {
    padding: 18,
    gap: 14,
  },
  loadingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  loadingText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#6B7280',
  },
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF0F4',
    gap: 14,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
  },
  skeletonLineWide: {
    height: 13,
    width: '70%',
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  skeletonLineShort: {
    height: 11,
    width: '48%',
    borderRadius: 5,
    backgroundColor: '#F3F4F6',
  },
  skeletonBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  skeletonTrack: {
    height: 16,
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  skeletonBox: {
    width: 92,
    height: 92,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 32,
  },
  emptyIllustration: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    boxShadow: '0 4px 12px rgba(17, 24, 39, 0.05)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14.5,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 26,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 999,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
