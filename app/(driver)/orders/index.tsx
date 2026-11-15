import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { driverService } from '../../../services/driver';
import { useAuth } from '../../../hooks/useAuth';

// FIX: Update type to reflect that address can be an object
type AddressObject = {
  street: string;
  city: string;
  zip: string;
};

type DriverOrder = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  restaurant_name: string;
  restaurant_address?: string;
  customer_name: string;
  placed_at: string;
  delivery_address: string | AddressObject; // Handles both text and JSON
  distance_to_restaurant?: number;
};

export default function DriverOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'requests' | 'active' | 'history'>('requests');
  const [availableOrders, setAvailableOrders] = useState<DriverOrder[]>([]);
  const [myOrders, setMyOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchAllData();
      }
    }, [user, activeTab])
  );

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const availableData = await driverService.getAvailableOrders();
      setAvailableOrders(Array.isArray(availableData.data) ? availableData.data : []);

      const myOrdersData = await driverService.getMyOrders();
      setMyOrders(Array.isArray(myOrdersData.data) ? myOrdersData.data : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    setAcceptingId(orderId);
    try {
      await driverService.acceptOrder(orderId);
      Alert.alert('Success', 'Order accepted! Head to the restaurant.');
      setActiveTab('active');
      fetchAllData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Could not accept order.');
    } finally {
      setAcceptingId(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  const getFilteredOrders = () => {
    if (activeTab === 'requests') return availableOrders;
    const activeStatuses = ['accepted_by_driver', 'ordering_at_restaurant', 'order_ready', 'picked_up', 'on_the_way', 'arrived'];
    if (activeTab === 'active') {
      return myOrders.filter(o => activeStatuses.includes(o.status));
    }
    return myOrders.filter(o => !activeStatuses.includes(o.status));
  };

  // FIX: Helper to safely render address
  const formatAddress = (address: string | AddressObject) => {
    if (!address) return 'Unknown Address';
    if (typeof address === 'string') return address;
    if (typeof address === 'object') {
      return `${address.street}, ${address.city}`; // Combine fields into a string
    }
    return 'Invalid Address';
  };

  const getStatusColor = (status: string) => {
    if (status === 'pending') return colors.warning;
    if (status === 'delivered') return colors.success;
    if (status === 'cancelled') return colors.error;
    return colors.primary;
  };

  const renderOrderItem = ({ item }: { item: DriverOrder }) => {
    const isRequest = activeTab === 'requests';

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => !isRequest && router.push(`/(driver)/orders/${item.id}`)}
        disabled={isRequest}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>{item.order_number || `#${item.id.slice(0,8)}`}</Text>
            <Text style={styles.orderDate}>
              {new Date(item.placed_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          
          {!isRequest && (
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.replace(/_/g, ' ')}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.orderDetails}>
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="restaurant" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.detailLabel}>Pick Up</Text>
              <Text style={styles.detailText}>{item.restaurant_name}</Text>
              {isRequest && <Text style={styles.detailSub}>{item.restaurant_address}</Text>}
            </View>
          </View>
          
          <View style={styles.connectorLine} />

          <View style={styles.detailRow}>
            <View style={[styles.iconContainer, { backgroundColor: colors.success + '15' }]}>
              <Ionicons name="location" size={16} color={colors.success} />
            </View>
            <View>
              <Text style={styles.detailLabel}>Drop Off</Text>
              {/* FIX: Use formatAddress here */}
              <Text style={styles.detailText} numberOfLines={1}>
                {formatAddress(item.delivery_address)}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.orderFooter}>
          <View>
             <Text style={styles.amountLabel}>Earnings</Text>
             <Text style={styles.orderAmount}>R{item.total_amount ? (item.total_amount * 0.7).toFixed(2) : '0.00'}</Text>
          </View>
          
          {isRequest ? (
            <TouchableOpacity 
              style={styles.acceptButton}
              onPress={() => handleAcceptOrder(item.id)}
              disabled={acceptingId === item.id}
            >
              {acceptingId === item.id ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.acceptButtonText}>Accept</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
                style={styles.viewButton}
                onPress={() => router.push(`/(driver)/orders/${item.id}`)}
            >
              <Text style={styles.viewButtonText}>View Status</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="delivery-dining" size={80} color={colors.gray300} />
      <Text style={styles.emptyTitle}>
        {activeTab === 'requests' ? 'No new requests' : 'No orders found'}
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'requests' 
          ? 'Stay online. New orders will appear here.'
          : 'Your active or past orders will show here.'
        }
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Driver Portal</Text>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]} 
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
            Requests ({availableOrders.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'active' && styles.activeTab]} 
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'history' && styles.activeTab]} 
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={getFilteredOrders()}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 6 },
  onlineText: { color: colors.success, fontWeight: '600', fontSize: 12 },
  
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10, backgroundColor: '#fff', paddingBottom: 15 },
  tab: { marginRight: 15, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.gray100 },
  activeTab: { backgroundColor: colors.primary },
  tabText: { color: colors.textSecondary, fontWeight: '600' },
  activeTabText: { color: '#fff' },

  listContent: { padding: 20 },
  orderCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  orderNumber: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary },
  orderDate: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

  orderDetails: { marginBottom: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start' },
  iconContainer: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  detailLabel: { fontSize: 12, color: colors.textTertiary, marginBottom: 2 },
  detailText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  detailSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  connectorLine: { width: 2, height: 20, backgroundColor: colors.gray200, marginLeft: 15, marginVertical: 4 },

  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  amountLabel: { fontSize: 12, color: colors.textTertiary },
  orderAmount: { fontSize: 18, fontWeight: 'bold', color: colors.success },
  
  acceptButton: { flexDirection: 'row', backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' },
  acceptButtonText: { color: '#fff', fontWeight: 'bold', marginRight: 8 },
  
  viewButton: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  viewButtonText: { color: colors.textSecondary, marginRight: 4, fontWeight: '500' },

  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginTop: 16 },
  emptyText: { color: colors.textSecondary, marginTop: 8 }
});