import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../../../constants/colors';
import { managerService } from '../../../../services/manager';
import api from '../../../../services/api';

export default function RestaurantDashboardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchDetails();
    }, [id])
  );

  const fetchDetails = async () => {
    try {
      // Assuming you have a getRestaurant endpoint or reusing getMyRestaurants
      // Ideally, add getRestaurantById to managerService.
      // For now, we filter from myRestaurants or fetch specific if endpoint exists
      const response = await api.get(`/restaurants/${id}`);
      setRestaurant(response.data.data || response.data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not load restaurant details');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (value: boolean) => {
    setToggling(true);
    try {
      // Assuming a PUT endpoint exists to update status
      // If not, you'll need to add it to your backend
      await api.put(`/restaurants/${id}`, { is_active: value });
      setRestaurant((prev: any) => ({ ...prev, is_active: value }));
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!restaurant) return <View style={styles.center}><Text>Restaurant not found</Text></View>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Cover & Header */}
        <View style={styles.coverContainer}>
          <Image 
            source={{ uri: restaurant.cover_url || 'https://via.placeholder.com/500x200' }} 
            style={styles.coverImage} 
          />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.name}>{restaurant.name}</Text>
              <Text style={styles.subtitle}>{restaurant.address}</Text>
            </View>
            <View style={styles.logoContainer}>
              <Image source={{ uri: restaurant.logo_url }} style={styles.logo} />
            </View>
          </View>

          {/* Status Toggle */}
          <View style={styles.statusCard}>
            <View>
              <Text style={styles.statusLabel}>Accepting Orders</Text>
              <Text style={styles.statusSub}>Turn off to pause incoming orders</Text>
            </View>
            <Switch
              value={restaurant.is_active}
              onValueChange={toggleStatus}
              trackColor={{ false: colors.gray300, true: colors.success }}
              disabled={toggling}
            />
          </View>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.grid}>
          <TouchableOpacity 
            style={styles.card} 
            onPress={() => router.push(`/(manager)/restaurants/${id}/menus`)}
          >
            <View style={[styles.iconBox, { backgroundColor: '#E3F2FD' }]}>
              <MaterialIcons name="restaurant-menu" size={24} color="#1565C0" />
            </View>
            <Text style={styles.cardTitle}>Manage Menu</Text>
            <Text style={styles.cardDesc}>Add items, categories & prices</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => Alert.alert('Coming Soon', 'Order history')}>
            <View style={[styles.iconBox, { backgroundColor: '#E8F5E9' }]}>
              <FontAwesome5 name="receipt" size={20} color="#2E7D32" />
            </View>
            <Text style={styles.cardTitle}>Orders</Text>
            <Text style={styles.cardDesc}>View past & current orders</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => Alert.alert('Coming Soon', 'Edit details')}>
            <View style={[styles.iconBox, { backgroundColor: '#FFF3E0' }]}>
              <MaterialIcons name="edit" size={24} color="#EF6C00" />
            </View>
            <Text style={styles.cardTitle}>Edit Info</Text>
            <Text style={styles.cardDesc}>Update photos & hours</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  coverContainer: { height: 180, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  backBtn: { position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 20 },
  headerContent: { padding: 20, backgroundColor: '#fff', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, marginTop: -20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  name: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  logoContainer: { elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, borderRadius: 40, backgroundColor: '#fff' },
  logo: { width: 60, height: 60, borderRadius: 30 },
  statusCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.gray100, padding: 15, borderRadius: 12 },
  statusLabel: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  statusSub: { fontSize: 12, color: colors.textSecondary },
  grid: { padding: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 16, elevation: 2 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
  cardDesc: { fontSize: 12, color: colors.textSecondary }
});