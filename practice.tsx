import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar as RNStatusBar,
  Platform,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Searchbar, Surface, Avatar, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

// Hooks & Services
import { useLocation } from '../../../../hooks/useLocation';
import { useAuth } from '../../../../hooks/useAuth';
import { restaurantService } from '../../../../services/restaurant';

// Constants
import { colors } from '../../../constants/colors';
import { shadows, spacing } from '../../../constants/theme';

const { width } = Dimensions.get('window');

// --- Types ---
type Restaurant = {
  id: string;
  name: string;
  description: string;
  cuisine_type: string[];
  cover_image_url: string;
  preparation_time_minutes: number;
  average_rating?: number;
  total_ratings?: number;
};

type MenuItem = {
  id: string;
  name: string;
  restaurant_name: string;
  price: number;
  discounted_price: number;
  image_url: string;
  restaurant_id: string;
};

type MenuCategory = {
  id: string;
  name: string;
  restaurant_name: string;
};

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { location } = useLocation();
  const { user } = useAuth();
  
  // --- State ---
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [popularRestaurants, setPopularRestaurants] = useState<Restaurant[]>([]);
  const [menus, setMenus] = useState<MenuCategory[]>([]);
  const [discounts, setDiscounts] = useState<MenuItem[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- Effects ---
  useEffect(() => {
    if (location) {
      fetchAllData();
    }
  }, [location]);

  // --- Data Fetching ---
  const fetchAllData = async () => {
    if (!location) return;

    try {
      setLoading(true);
      
      // Parallel fetching for speed
      const [feedResponse, searchResponse] = await Promise.all([
        restaurantService.getHomeFeed().catch(err => ({ data: { success: false } })), // Fail gracefully if endpoint missing
        restaurantService.searchRestaurants(
          location.coords.latitude,
          location.coords.longitude,
          { maxDistance: 10 }
        )
      ]);

      // 1. Handle Home Feed (Menus & Discounts)
      if (feedResponse.data?.success) {
        setMenus(feedResponse.data.data.menus || []);
        setDiscounts(feedResponse.data.data.discounts || []);
      }

      // 2. Handle Restaurants (Robust Data Handling)
      let restaurantData: Restaurant[] = [];

      // Check for nested data structure (common in Axios + API wrappers)
      if (Array.isArray(searchResponse?.data?.data)) {
        restaurantData = searchResponse.data.data;
      } else if (Array.isArray(searchResponse?.data)) {
        restaurantData = searchResponse.data;
      } else if (Array.isArray(searchResponse)) {
        restaurantData = searchResponse;
      }

      setRestaurants(restaurantData);
      
      // Filter for "Popular" section (Simple logic: has ratings)
      // In a real app, you might want to filter by rating > 4.0
      setPopularRestaurants(
        restaurantData.filter((r: any) => (r.total_ratings || 0) > 0).slice(0, 5)
      );

    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
  };

  // --- Render Helpers ---

  const renderCategory = ({ item }: { item: MenuCategory }) => (
    <TouchableOpacity style={styles.categoryCard}>
      <View style={[styles.categoryIcon, { backgroundColor: colors.gray100 }]}>
         <MaterialCommunityIcons name="silverware-fork-knife" size={24} color={colors.primary} />
      </View>
      <Text style={styles.categoryTitle} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderRestaurantCard = ({ item }: { item: Restaurant }) => (
    <TouchableOpacity 
      activeOpacity={0.9}
      // FIX: Use query param ?id=... so it matches your file "restaurant-details.tsx"
      onPress={() => router.push(`/(customer)/home/restaurant-details?id=${item.id}`)}
      style={styles.cardContainer}
    >
      <Surface style={styles.card}>
        <Image 
          source={{ uri: item.cover_image_url || 'https://via.placeholder.com/300' }} 
          style={styles.cardImage} 
        />
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={12} color={colors.black} />
          <Text style={styles.ratingText}>{item.average_rating || 'New'}</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.metaText}>
              <Text style={{ color: colors.success }}>●</Text> {item.preparation_time_minutes || 20}-{ (item.preparation_time_minutes || 20) + 10} min
            </Text>
            <Text style={[styles.metaText, { marginLeft: 8 }]}>
              • {item.cuisine_type?.[0] || 'Food'}
            </Text>
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );

  const renderDealCard = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity 
      activeOpacity={0.9}
      // FIX: Use query param here too
      onPress={() => router.push(`/(customer)/home/restaurant-details?id=${item.restaurant_id}`)}
      style={styles.dealContainer}
    >
      <Surface style={styles.dealCard}>
        <Image 
          source={{ uri: item.image_url || 'https://via.placeholder.com/150' }} 
          style={styles.dealImage} 
        />
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>
            -{Math.round(((item.price - item.discounted_price) / item.price) * 100)}%
          </Text>
        </View>
        <Text style={styles.dealTitle} numberOfLines={1}>{item.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.newPrice}>${item.discounted_price}</Text>
          <Text style={styles.oldPrice}>${item.price}</Text>
        </View>
      </Surface>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 10, color: colors.gray500 }}>Finding food near you...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Header */}
      <View style={styles.header}>
        <View style={styles.locationBlock}>
          <Text style={styles.deliveryLabel}>Delivering to</Text>
          <TouchableOpacity style={styles.addressRow}>
             <Text style={styles.addressText} numberOfLines={1}>
               Current Location
             </Text>
             <Ionicons name="chevron-down" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => router.push('/(customer)/profile')}>
          <Avatar.Text 
            size={40} 
            label={user?.first_name ? user.first_name[0].toUpperCase() : 'U'} 
            style={{ backgroundColor: colors.primaryLight }}
            color={colors.white}
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* 2. Search Bar */}
        <View style={styles.searchSection}>
          <Searchbar
            placeholder="Search food, restaurants..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchBar}
            inputStyle={styles.searchInput}
            iconColor={colors.gray500}
            elevation={0}
          />
        </View>

        {/* 3. Categories (Dynamic Menus) */}
        {menus.length > 0 && (
          <View style={styles.section}>
            <FlatList
              horizontal
              data={menus}
              renderItem={renderCategory}
              keyExtractor={item => `cat-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* 4. Promo Banner */}
        <View style={styles.bannerSection}>
          <Surface style={styles.banner}>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>30% Discount</Text>
              <Text style={styles.bannerSubtitle}>Order fast food today!</Text>
              <Button mode="contained" buttonColor={colors.white} textColor={colors.primary} style={styles.bannerBtn}>
                Order Now
              </Button>
            </View>
            <Image 
              source={{ uri: 'https://img.freepik.com/free-photo/burger-with-fries_103362-1.jpg' }} 
              style={styles.bannerImage} 
            />
          </Surface>
        </View>

        {/* 5. Stores Nearby */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Stores Nearby</Text>
          <TouchableOpacity><Ionicons name="arrow-forward" size={20} color={colors.gray400} /></TouchableOpacity>
        </View>
        {restaurants.length > 0 ? (
          <FlatList
            horizontal
            data={restaurants}
            renderItem={renderRestaurantCard}
            keyExtractor={item => `near-${item.id}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={{color: colors.gray500}}>No restaurants nearby</Text>
          </View>
        )}

        {/* 6. Discounts & Deals */}
        {discounts.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Discounts & Deals</Text>
              <TouchableOpacity><Ionicons name="arrow-forward" size={20} color={colors.gray400} /></TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={discounts}
              renderItem={renderDealCard}
              keyExtractor={item => `deal-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* 7. Popular Restaurants */}
        {popularRestaurants.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Restaurants</Text>
              <TouchableOpacity><Ionicons name="arrow-forward" size={20} color={colors.gray400} /></TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={popularRestaurants}
              renderItem={renderRestaurantCard}
              keyExtractor={item => `pop-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}
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
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  locationBlock: { flex: 1 },
  deliveryLabel: { fontSize: 12, color: colors.gray500 },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  addressText: { fontWeight: 'bold', fontSize: 16, marginRight: 4, color: colors.black },

  // Search
  searchSection: { paddingHorizontal: spacing.md, marginVertical: spacing.md },
  searchBar: { backgroundColor: colors.gray100, borderRadius: 12, height: 50 },
  searchInput: { minHeight: 0 },

  // Sections
  section: { marginBottom: spacing.lg },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: spacing.md, 
    marginBottom: spacing.sm,
    marginTop: spacing.md
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.black },
  horizontalList: { paddingHorizontal: spacing.md, gap: spacing.md },
  emptyState: { padding: spacing.md, alignItems: 'center' },

  // Categories
  categoryCard: { 
    alignItems: 'center', 
    marginRight: spacing.md, 
    width: 70 
  },
  categoryIcon: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8
  },
  categoryTitle: { fontSize: 12, color: colors.gray700, textAlign: 'center' },

  // Banner
  bannerSection: { paddingHorizontal: spacing.md, marginBottom: spacing.lg },
  banner: {
    height: 150,
    backgroundColor: '#4285F4', // Blue accent from design
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 4
  },
  bannerContent: { flex: 1, padding: spacing.md, justifyContent: 'center', zIndex: 2 },
  bannerTitle: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  bannerSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginBottom: 12 },
  bannerBtn: { alignSelf: 'flex-start', height: 32 },
  bannerImage: { width: '50%', height: '100%', resizeMode: 'cover' },

  // Restaurant Card
  cardContainer: { marginRight: spacing.md, marginBottom: spacing.xs },
  card: {
    width: 220,
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.small
  },
  cardImage: { width: '100%', height: 130, resizeMode: 'cover' },
  ratingBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'white', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
    flexDirection: 'row', alignItems: 'center',
    ...shadows.small
  },
  ratingText: { fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  cardContent: { padding: spacing.sm },
  cardTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, color: colors.gray500 },

  // Deal Card
  dealContainer: { marginRight: spacing.md, marginBottom: spacing.xs },
  dealCard: {
    width: 150,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: spacing.sm,
    ...shadows.small
  },
  dealImage: { width: '100%', height: 100, borderRadius: 8, marginBottom: 8 },
  discountBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.error,
    borderBottomLeftRadius: 12, borderTopRightRadius: 16,
    paddingHorizontal: 8, paddingVertical: 2
  },
  discountText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  dealTitle: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newPrice: { fontSize: 14, fontWeight: 'bold', color: colors.primary },
  oldPrice: { fontSize: 12, textDecorationLine: 'line-through', color: colors.gray400 },
});