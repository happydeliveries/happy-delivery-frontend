import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  RefreshControl,
  Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { managerService } from '../../../services/manager';

// Define the shape of your restaurant data
type Restaurant = {
  id: string;
  name: string;
  cuisine_type: string[] | string; 
  address: string;
  logo_url: string;
  is_active: boolean;
  rating?: number;
};

export default function MyRestaurantsScreen() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchRestaurants();
    }, [])
  );

  const fetchRestaurants = async () => {
    try {
      if (!refreshing) setLoading(true);
      
      const response = await managerService.getMyRestaurants();
      
      // FIX: Robustly extract the array from nested API structures
      // 1. If response.data is the Axios payload { success: true, data: [...] }
      // 2. We need to access .data from THAT payload
      const payload = response.data || response;
      const actualData = payload.data || payload;

      // Ensure we actually have an array before setting state
      setRestaurants(Array.isArray(actualData) ? actualData : []);
      
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRestaurants();
  };

  const renderRestaurantItem = ({ item }: { item: Restaurant }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push(`/(manager)/restaurants/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoPlaceholder]}>
            <Ionicons name="restaurant" size={24} color={colors.primary} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.cuisine}>
            {Array.isArray(item.cuisine_type) 
              ? item.cuisine_type.join(', ') 
              : item.cuisine_type || 'General'}
          </Text>
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
      </View>

      <View style={styles.cardFooter}>
        <View style={[styles.statusBadge, item.is_active ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={[styles.statusText, item.is_active ? styles.activeText : styles.inactiveText]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.manageBtn}
          onPress={() => router.push(`/(manager)/restaurants/${item.id}/menus`)}
        >
          <MaterialIcons name="restaurant-menu" size={16} color={colors.primary} />
          <Text style={styles.manageBtnText}>Manage Menu</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Restaurants</Text>
        <TouchableOpacity 
          style={styles.addBtn} 
          onPress={() => router.push('/(manager)/restaurants/create')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={restaurants}
          renderItem={renderRestaurantItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={60} color={colors.gray300} />
              <Text style={styles.emptyTitle}>No Restaurants Yet</Text>
              <Text style={styles.emptyText}>Tap the + button to add your first restaurant.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  addBtn: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  listContent: { padding: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 60, height: 60, borderRadius: 8, backgroundColor: colors.gray100 },
  logoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, marginLeft: 16, marginRight: 8 },
  name: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
  cuisine: { fontSize: 14, color: colors.primary, marginBottom: 2 },
  address: { fontSize: 12, color: colors.textTertiary },
  
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 12, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: colors.gray100 
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  activeBadge: { backgroundColor: colors.success + '15' },
  inactiveBadge: { backgroundColor: colors.error + '15' },
  statusText: { fontSize: 12, fontWeight: '600' },
  activeText: { color: colors.success },
  inactiveText: { color: colors.error },
  
  manageBtn: { flexDirection: 'row', alignItems: 'center' },
  manageBtnText: { marginLeft: 6, color: colors.primary, fontWeight: '600', fontSize: 14 },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginTop: 16 },
  emptyText: { color: colors.textSecondary, marginTop: 8 },
});