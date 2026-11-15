import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { managerService } from '../../../services/manager';

type DashboardStats = {
  totalRestaurants: number;
  activeOrders: number;
  completedOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  averageRating: number;
};

type RecentOrder = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  customer_name: string;
  placed_at: string;
  items_count: number;
};

type RestaurantSummary = {
  id: string;
  name: string;
  active_orders: number;
  today_orders: number;
  today_revenue: number;
};

export default function ManagerDashboardScreen() {
  const router = useRouter();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // FIX: Safely extract the .data property from each response
      const statsRes = await managerService.getDashboardStats();
      setStats(statsRes?.data || statsRes);
      
      const ordersRes = await managerService.getRecentOrders(5);
      setRecentOrders(ordersRes?.data || (Array.isArray(ordersRes) ? ordersRes : []));
      
      const restaurantsRes = await managerService.getRestaurantsSummary();
      setRestaurants(restaurantsRes?.data || (Array.isArray(restaurantsRes) ? restaurantsRes : []));
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setRecentOrders([]);
      setRestaurants([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'accepted_by_driver':
        return colors.warning;
      case 'ordering_at_restaurant':
      case 'order_ready':
        return colors.info;
      case 'picked_up':
      case 'on_the_way':
        return colors.primary;
      case 'delivered':
        return colors.success;
      case 'cancelled':
        return colors.error;
      default:
        return colors.gray400;
    }
  };

  const getStatusText = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>Restaurant Manager</Text>
          </View>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
          contentContainerStyle={styles.statsScrollContent}
        >
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="restaurant" size={24} color={colors.primary} />
            </View>
            <Text style={styles.statValue}>{stats?.totalRestaurants || 0}</Text>
            <Text style={styles.statLabel}>Restaurants</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.warning + '20' }]}>
              <MaterialIcons name="pending-actions" size={24} color={colors.warning} />
            </View>
            <Text style={styles.statValue}>{stats?.activeOrders || 0}</Text>
            <Text style={styles.statLabel}>Active Orders</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.success + '20' }]}>
              <MaterialIcons name="attach-money" size={24} color={colors.success} />
            </View>
            <Text style={styles.statValue}>R {stats?.totalRevenue?.toFixed(0) || 0}</Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: colors.dessert + '20' }]}>
              <Ionicons name="star" size={24} color={colors.dessert} />
            </View>
            <Text style={styles.statValue}>{stats?.averageRating?.toFixed(1) || '4.5'}</Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
        </ScrollView>

        {/* Today's Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Overview</Text>
            <Text style={styles.sectionDate}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
          </View>
          
          <View style={styles.todayStats}>
            <View style={styles.todayStat}>
              <MaterialIcons name="receipt" size={28} color={colors.primary} />
              <Text style={styles.todayStatValue}>{stats?.completedOrders || 0}</Text>
              <Text style={styles.todayStatLabel}>Orders Completed</Text>
            </View>
            
            <View style={styles.todayDivider} />
            
            <View style={styles.todayStat}>
              <MaterialIcons name="payments" size={28} color={colors.success} />
              <Text style={styles.todayStatValue}>R {stats?.todayRevenue?.toFixed(2) || '0.00'}</Text>
              <Text style={styles.todayStatLabel}>Today's Revenue</Text>
            </View>
          </View>
        </View>

        {/* Restaurants Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Restaurants</Text>
            <TouchableOpacity onPress={() => router.push('/(manager)/restaurants')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {restaurants.map(restaurant => (
            <TouchableOpacity
              key={restaurant.id}
              style={styles.restaurantCard}
              onPress={() => router.push(`/(manager)/restaurants/${restaurant.id}`)}
            >
              <View style={styles.restaurantInfo}>
                <View style={styles.restaurantIcon}>
                  <Ionicons name="restaurant" size={20} color={colors.primary} />
                </View>
                <View style={styles.restaurantDetails}>
                  <Text style={styles.restaurantName}>{restaurant.name}</Text>
                  <Text style={styles.restaurantStats}>
                    {/* FIX: Add fallback values (|| 0) before calling .toFixed() */}
                    {(restaurant.active_orders || 0)} active orders • 
                    R{(restaurant.today_revenue || 0).toFixed(2)} today
                  </Text>
                </View>
              </View>
              
              <View style={styles.restaurantActions}>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </View>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity 
            style={styles.addRestaurantButton}
            onPress={() => router.push('/(manager)/restaurants/create')}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.addRestaurantText}>Add New Restaurant</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push('/(manager)/orders')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {recentOrders.length === 0 ? (
            <View style={styles.emptyOrders}>
              <Ionicons name="receipt-outline" size={60} color={colors.gray300} />
              <Text style={styles.emptyOrdersTitle}>No recent orders</Text>
              <Text style={styles.emptyOrdersText}>
                Orders will appear here as they come in
              </Text>
            </View>
          ) : (
            recentOrders.map(order => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => router.push(`/(manager)/orders/${order.id}`)}
              >
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderNumber}>{order.order_number}</Text>
                    <Text style={styles.orderCustomer}>{order.customer_name}</Text>
                  </View>
                  <View style={[styles.orderBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                    <Text style={[styles.orderBadgeText, { color: getStatusColor(order.status) }]}>
                      {getStatusText(order.status)}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.orderDetails}>
                  <View style={styles.orderDetail}>
                    <MaterialIcons name="receipt" size={16} color={colors.textTertiary} />
                    <Text style={styles.orderDetailText}>{order.items_count} items</Text>
                  </View>
                  
                  <View style={styles.orderDetail}>
                    <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
                    <Text style={styles.orderDetailText}>{formatTime(order.placed_at)}</Text>
                  </View>
                </View>
                
                <View style={styles.orderFooter}>
                  <Text style={styles.orderAmount}>R {Number(order.total_amount || 0).toFixed(2)}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(manager)/restaurants/create')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="add" size={24} color={colors.primary} />
              </View>
              <Text style={styles.actionText}>Add Restaurant</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(manager)/restaurants/menus')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="fast-food" size={24} color={colors.success} />
              </View>
              <Text style={styles.actionText}>Manage Menus</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(manager)/analytics')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.info + '20' }]}>
                <Feather name="bar-chart-2" size={24} color={colors.info} />
              </View>
              <Text style={styles.actionText}>Analytics</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(manager)/profile/settings')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="settings" size={24} color={colors.warning} />
              </View>
              <Text style={styles.actionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Add RefreshControl import
import { RefreshControl } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#fff',
  },
  greeting: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 4,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: colors.error,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  statsScroll: {
    marginTop: 1,
  },
  statsScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statCard: {
    width: 150,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginRight: 12,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  sectionDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  todayStats: {
    flexDirection: 'row',
    backgroundColor: colors.gray50,
    borderRadius: 12,
    padding: 20,
  },
  todayStat: {
    flex: 1,
    alignItems: 'center',
  },
  todayStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 4,
  },
  todayStatLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  todayDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
  restaurantCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  restaurantIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  restaurantDetails: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  restaurantStats: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  restaurantActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  restaurantAction: {
    marginRight: 12,
  },
  addRestaurantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  addRestaurantText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
  orderCard: {
    backgroundColor: colors.gray50,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  orderCustomer: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  orderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  orderDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderDetailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  emptyOrders: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyOrdersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyOrdersText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionButton: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    margin: '1%',
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
  },
});