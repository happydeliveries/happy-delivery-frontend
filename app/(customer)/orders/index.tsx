import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import OrderCard from '../../../components/customer/OrderCard';
import { colors } from '../../../constants/colors';
import { orderService } from '../../../services/order';
import { useAuth } from '../../../hooks/useAuth';
import { useSocket } from '../../../hooks/useSocket';

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status?: string;
  total_amount: number;
  placed_at: string;
  restaurant_name: string;
  driver_first_name?: string;
  driver_last_name?: string;
};

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const socket = useSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');

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
      const orderList: Order[] = Array.isArray(response)
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return colors.success;
      case 'cancelled':
      case 'no_drivers_available':
      case 'delivery_failed':
        return colors.error;
      case 'pending':
      case 'accepted_by_driver':
        return colors.warning;
      default:
        return colors.info;
    }
  };

  const getStatusText = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const filters = [
    { key: 'all', label: 'All Orders' },
    { key: 'active', label: 'Active' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  const trackingStatuses = ['accepted_by_driver', 'picked_up', 'on_the_way', 'arrived'];
  const allActiveStatuses = ['pending', 'ordering_at_restaurant', 'order_ready', ...trackingStatuses];
  const activeOrders = orders.filter(order => trackingStatuses.includes(order.status));
  const primaryTrackingOrder =
    activeOrders.find(order => order.status === 'picked_up') ||
    activeOrders.find(order => ['on_the_way', 'arrived'].includes(order.status)) ||
    activeOrders[0];

  const filteredOrders = selectedFilter === 'all' 
    ? orders 
    : selectedFilter === 'active'
      ? orders.filter(order => allActiveStatuses.includes(order.status))
      : selectedFilter === 'cancelled'
        ? orders.filter(order => ['cancelled', 'no_drivers_available', 'delivery_failed'].includes(order.status))
        : orders.filter(order => order.status === selectedFilter);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="receipt-outline" size={80} color={colors.gray300} />
      <Text style={styles.emptyTitle}>
        {!user ? 'Sign in to see your orders' : 'No orders yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {!user
          ? 'Track deliveries, pay for orders, and reorder your favorites'
          : selectedFilter === 'all'
            ? 'Your order history will appear here'
            : `No ${selectedFilter} orders found`}
      </Text>
      <TouchableOpacity 
        style={styles.browseButton}
        onPress={() => router.push(!user ? '/(auth)/login' : '/(customer)/home')}
      >
        <Text style={styles.browseButtonText}>
          {!user ? 'Sign In' : 'Browse Restaurants'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const cycleFilter = () => {
    const idx = filters.findIndex(f => f.key === selectedFilter);
    const next = filters[(idx + 1) % filters.length];
    setSelectedFilter(next.key);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
        <TouchableOpacity onPress={cycleFilter} accessibilityLabel="Cycle order status filter">
          <Ionicons name="filter" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={filters}
          keyExtractor={item => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedFilter === item.key && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedFilter(item.key)}
            >
              <Text style={[
                styles.filterText,
                selectedFilter === item.key && styles.filterTextActive,
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {primaryTrackingOrder && selectedFilter !== 'delivered' && selectedFilter !== 'cancelled' ? (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerTitle}>
            {primaryTrackingOrder.status === 'picked_up'
              ? 'Order Picked Up • Driver Live on Map'
              : 'Active Delivery'}
          </Text>
          <Text style={styles.activeBannerText}>
            {primaryTrackingOrder.status === 'picked_up'
              ? `Your driver has picked up order ${primaryTrackingOrder.order_number || ''}. Watch your driver live on the map.`
              : 'Track your active order live from here.'}
          </Text>
          <TouchableOpacity
            style={styles.activeBannerButton}
            onPress={() => router.push(`/(customer)/orders/tracking?id=${primaryTrackingOrder.id}`)}
          >
            <Text style={styles.activeBannerButtonText}>Track Live on Map</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Orders List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text>Loading orders...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/(customer)/orders/${item.id}`)}
            >
              <OrderCard
                order={item}
                actionLabel={
                  item.status === 'ordering_at_restaurant' && item.payment_status !== 'completed'
                    ? 'Pay with Paystack'
                    : item.status === 'picked_up'
                      ? 'Track Driver Live'
                      : trackingStatuses.includes(item.status)
                        ? 'Track Order'
                        : 'View Details'
                }
                onActionPress={
                  item.status === 'ordering_at_restaurant' && item.payment_status !== 'completed'
                    ? () => router.push(`/(customer)/orders/${item.id}`)
                    : trackingStatuses.includes(item.status)
                      ? () => router.push(`/(customer)/orders/tracking?id=${item.id}`)
                      : () => router.push(`/(customer)/orders/${item.id}`)
                }
              />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterList: {
    paddingHorizontal: 20,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    marginRight: 12,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  browseButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  activeBanner: {
    backgroundColor: '#fff8f1',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  activeBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  activeBannerText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  activeBannerButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  activeBannerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});