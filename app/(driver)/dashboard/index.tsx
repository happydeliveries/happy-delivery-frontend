import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Button from '../../../components/common/Button';
import { colors } from '../../../constants/colors';
import { driverService } from '../../../services/driver';
import { useAuth } from '../../../hooks/useAuth';

type DriverStats = {
  totalDeliveries: number;
  totalEarnings: number;
  todayDeliveries: number;
  todayEarnings: number;
  averageRating: number;
  acceptanceRate: number;
};

type AvailableOrder = {
  id: string;
  order_number: string;
  restaurant_name: string;
  restaurant_address: string;
  customer_address: string;
  total_amount: number;
  distance_to_restaurant: number;
  time_left_seconds: number;
};

export default function DriverDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [isOnline, setIsOnline] = useState(false);
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  // const fetchDashboardData = async () => {
  //   try {
  //     setLoading(true);
  //     const statsData = await driverService.getStats();
  //     setStats(statsData);
      
  //     if (isOnline) {
  //       const ordersData = await driverService.getAvailableOrders();
  //       setAvailableOrders(ordersData);
  //     }
  //   } catch (error) {
  //     console.error('Error fetching dashboard data:', error);
  //   } finally {
  //     setLoading(false);
  //     setRefreshing(false);
  //   }
  // };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // 1. Handle Stats (Backend returns { success: true, data: stats })
      const statsResponse = await driverService.getStats();
      setStats(statsResponse?.data || statsResponse);
      
      if (isOnline) {
        // 2. Handle Available Orders (Backend returns { success: true, data: orders })
        const ordersResponse = await driverService.getAvailableOrders();
        
        // FIX: Extract the .data array
        const ordersArray = ordersResponse?.data || (Array.isArray(ordersResponse) ? ordersResponse : []);
        setAvailableOrders(ordersArray);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setAvailableOrders([]); // Safety fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleOnline = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    
    try {
      await driverService.updateStatus(newStatus ? 'available' : 'offline');
      if (newStatus) {
        fetchAvailableOrders();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setIsOnline(!newStatus); // Revert on error
    }
  };

  // const fetchAvailableOrders = async () => {
  //   try {
  //     const ordersData = await driverService.getAvailableOrders();
  //     setAvailableOrders(ordersData);
  //   } catch (error) {
  //     console.error('Error fetching available orders:', error);
  //   }
  // };

  const fetchAvailableOrders = async () => {
    try {
      const ordersResponse = await driverService.getAvailableOrders();
      
      // FIX: Extract the .data array
      const ordersArray = ordersResponse?.data || (Array.isArray(ordersResponse) ? ordersResponse : []);
      setAvailableOrders(ordersArray);
    } catch (error) {
      console.error('Error fetching available orders:', error);
      setAvailableOrders([]); // Safety fallback
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      await driverService.acceptOrder(orderId);
      router.push(`/(driver)/orders/${orderId}`);
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatTimeLeft = (seconds: number) => {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
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
      <ScrollView>
        {/* Online Status Toggle */}
        <View style={styles.statusContainer}>
          <View style={styles.statusHeader}>
            <View style={styles.statusInfo}>
              <View style={[styles.statusDot, isOnline ? styles.statusOnline : styles.statusOffline]} />
              <Text style={styles.statusText}>
                {isOnline ? 'Online - Ready for deliveries' : 'Offline'}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ false: colors.gray300, true: colors.success }}
              thumbColor="#fff"
            />
          </View>
          
          <Text style={styles.statusSubtext}>
            {isOnline 
              ? 'You will receive new order notifications'
              : 'Go online to start receiving delivery requests'
            }
          </Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialIcons name="delivery-dining" size={24} color={colors.primary} />
            <Text style={styles.statValue}>{stats?.totalDeliveries || 0}</Text>
            <Text style={styles.statLabel}>Total Deliveries</Text>
          </View>
          
          <View style={styles.statCard}>
            <MaterialIcons name="attach-money" size={24} color={colors.success} />
            <Text style={styles.statValue}>R {stats?.totalEarnings?.toFixed(0) || 0}</Text>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>
          
          <View style={styles.statCard}>
            <MaterialIcons name="star" size={24} color={colors.warning} />
            <Text style={styles.statValue}>{stats?.averageRating?.toFixed(1) || '4.8'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          
          <View style={styles.statCard}>
            <MaterialIcons name="check-circle" size={24} color={colors.info} />
            <Text style={styles.statValue}>{stats?.acceptanceRate || 95}%</Text>
            <Text style={styles.statLabel}>Acceptance Rate</Text>
          </View>
        </View>

        {/* Today's Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Summary</Text>
          <View style={styles.todayStats}>
            <View style={styles.todayStat}>
              <Text style={styles.todayStatValue}>{stats?.todayDeliveries || 0}</Text>
              <Text style={styles.todayStatLabel}>Deliveries</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.todayStat}>
              <Text style={styles.todayStatValue}>R {stats?.todayEarnings?.toFixed(2) || '0.00'}</Text>
              <Text style={styles.todayStatLabel}>Earnings</Text>
            </View>
          </View>
        </View>

        {/* Available Orders */}
        {isOnline && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available Orders</Text>
              <TouchableOpacity onPress={fetchAvailableOrders}>
                <Ionicons name="refresh" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            
            {(!availableOrders || availableOrders.length === 0) ? (
                <View style={styles.emptyOrders}>
                <Ionicons name="time-outline" size={60} color={colors.gray300} />
                <Text style={styles.emptyOrdersTitle}>No orders available</Text>
                <Text style={styles.emptyOrdersText}>
                  New orders will appear here when available
                </Text>
              </View>
            ) : (
              availableOrders?.map(order => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => router.push(`/(driver)/orders/${order.id}`)}
                >
                  <View style={styles.orderHeader}>
                    <View>
                      <Text style={styles.orderNumber}>{order.order_number}</Text>
                      <Text style={styles.restaurantName}>{order.restaurant_name}</Text>
                    </View>
                    <View style={styles.orderBadge}>
                      <Text style={styles.orderBadgeText}>
                        {formatTimeLeft(order.time_left_seconds)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.orderDetails}>
                    <View style={styles.orderDetail}>
                      <Ionicons name="restaurant" size={16} color={colors.textTertiary} />
                      <Text style={styles.orderDetailText} numberOfLines={1}>
                        {order.restaurant_address}
                      </Text>
                    </View>
                    
                    <View style={styles.orderDetail}>
                      <Ionicons name="home" size={16} color={colors.textTertiary} />
                      <Text style={styles.orderDetailText} numberOfLines={1}>
                        {order.customer_address}
                      </Text>
                    </View>
                    
                    <View style={styles.orderDetail}>
                      <Ionicons name="navigate" size={16} color={colors.textTertiary} />
                      <Text style={styles.orderDetailText}>
                        {formatDistance(order.distance_to_restaurant)} away
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.orderFooter}>
                    <Text style={styles.orderAmount}>R{Number(order.total_amount).toFixed(2)}</Text>
                    <Button
                      title="Accept"
                      onPress={() => handleAcceptOrder(order.id)}
                      size="small"
                      style={styles.acceptButton}
                    />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(driver)/orders')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
                <MaterialIcons name="history" size={24} color={colors.primary} />
              </View>
              <Text style={styles.actionText}>Order History</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(driver)/earnings')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.success + '20' }]}>
                <MaterialIcons name="show-chart" size={24} color={colors.success} />
              </View>
              <Text style={styles.actionText}>Earnings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(driver)/profile')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.info + '20' }]}>
                <Ionicons name="car-sport" size={24} color={colors.info} />
              </View>
              <Text style={styles.actionText}>Vehicle</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/support')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="help-circle" size={24} color={colors.warning} />
              </View>
              <Text style={styles.actionText}>Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  statusContainer: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusOnline: {
    backgroundColor: colors.success,
  },
  statusOffline: {
    backgroundColor: colors.error,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    backgroundColor: '#fff',
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.gray50,
    padding: 20,
    borderRadius: 12,
    margin: '1%',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
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
    color: colors.primary,
    marginBottom: 4,
  },
  todayStatLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
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
  restaurantName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  orderBadge: {
    backgroundColor: colors.warning,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  orderDetails: {
    gap: 8,
    marginBottom: 16,
  },
  orderDetail: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderDetailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  acceptButton: {
    paddingHorizontal: 24,
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