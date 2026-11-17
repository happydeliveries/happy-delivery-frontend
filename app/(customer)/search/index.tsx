import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  Dimensions,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Services & Hooks
import { restaurantService } from '../../../services/restaurant';
import { useLocation } from '../../../hooks/useLocation';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

// --- Types ---
type Restaurant = {
  id: string;
  name: string;
  description: string;
  cuisine_type: string[] | string | null;
  food_categories?: string[] | null;
  cover_image_url: string;
  average_rating: number | string | null;
  preparation_time_minutes: number;
  distance_meters: number | string;
  is_accepting_orders?: boolean;
};

type FoodItem = {
  id: string;
  name: string;
  description: string;
  price: number | string;
  discounted_price?: number | string | null;
  image_url: string;
  restaurant_name: string;
  restaurant_id: string;
  is_veg: boolean;
  category?: string;
  categories?: string[];
};

const normalizeTags = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((c) => String(c).trim()).filter(Boolean);
  if (typeof raw === 'string') return raw.split(',').map((c) => c.trim()).filter(Boolean);
  return [];
};

// --- Theme ---
const THEME = {
  primary: '#FF6B35',
  secondary: '#2D3436',
  background: '#FAFAFA',
  card: '#FFFFFF',
  text: '#2D3436',
  subText: '#636E72',
  border: '#F0F0F0',
  success: '#00C896',
};

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string; category?: string }>();
  const { location } = useLocation();
  const reqIdRef = useRef(0);

  // State
  const [query, setQuery] = useState(params.query || params.category || '');
  const [activeTab, setActiveTab] = useState<'all' | 'restaurants' | 'food'>('all');
  const [loading, setLoading] = useState(false);

  // Data
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);

  // Filters
  const [filters, setFilters] = useState({
    openNow: false,
    under100: false,
    veg: false,
    rating4Plus: false,
  });

  useEffect(() => {
    const incoming = params.query ?? params.category;
    if (incoming && incoming !== query) {
      setQuery(incoming);
    }
  }, [params.query, params.category]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch();
      } else {
        fetchNearbyRestaurants();
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, filters, location]);

  const getEffectiveCoords = () => {
    const lat = location?.coords.latitude;
    const lng = location?.coords.longitude;
    if (lat == null || lng == null || lat > 0 || lng < 10 || lng > 40) {
      return { lat: -26.2041, lng: 28.0473 };
    }
    return { lat, lng };
  };

  const applyFoodFilters = (items: FoodItem[]) => {
    let filtered = Array.isArray(items) ? items : [];
    if (filters.under100) {
      filtered = filtered.filter((i: FoodItem) => {
        const eff =
          i.discounted_price != null &&
          Number(i.discounted_price) > 0 &&
          Number(i.discounted_price) < Number(i.price)
            ? Number(i.discounted_price)
            : Number(i.price);
        return eff <= 100;
      });
    }
    if (filters.veg) {
      filtered = filtered.filter((i: FoodItem) => i.is_veg);
    }
    return filtered;
  };

  const filterWithinRadius = (list: any[]) =>
    (Array.isArray(list) ? list : []).filter((r: any) => {
      if (r.distance_meters != null && r.delivery_radius_km != null) {
        return Number(r.distance_meters) <= Number(r.delivery_radius_km) * 1000;
      }
      return true;
    });

  const performSearch = async () => {
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const { lat, lng } = getEffectiveCoords();
      const trimmed = query.trim();

      const [restRes, foodRes] = await Promise.all([
        restaurantService.searchRestaurants(lat, lng, {
          query: trimmed,
          maxDistance: 90,
          minRating: filters.rating4Plus ? 4.0 : undefined,
          isOpen: filters.openNow ? 'true' : undefined,
        }),
        restaurantService.searchFood(trimmed, lat, lng),
      ]);

      if (reqIdRef.current !== myReqId) return;

      const rawRest = Array.isArray(restRes)
        ? restRes
        : (restRes as any)?.restaurants ?? (restRes as any)?.data ?? [];
      let restData = filterWithinRadius(rawRest);

      const qLower = trimmed.toLowerCase();
      restData = restData.filter((r: Restaurant) => {
        const tags = [
          ...normalizeTags(r.cuisine_type),
          ...normalizeTags(r.food_categories),
        ];
        return (
          r.name?.toLowerCase().includes(qLower) ||
          (r.description || '').toLowerCase().includes(qLower) ||
          tags.some((t) => t.toLowerCase().includes(qLower))
        );
      });

      const rawFood = Array.isArray(foodRes)
        ? foodRes
        : (foodRes as any)?.items ?? (foodRes as any)?.data ?? [];

      setRestaurants(restData);
      setFoodItems(applyFoodFilters(rawFood));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      if (reqIdRef.current === myReqId) {
        setLoading(false);
      }
    }
  };

  const fetchNearbyRestaurants = async () => {
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const { lat, lng } = getEffectiveCoords();

      const [resp, foodResp] = await Promise.all([
        restaurantService.searchRestaurants(lat, lng, {
          maxDistance: 90,
          minRating: filters.rating4Plus ? 4.0 : undefined,
          isOpen: filters.openNow ? 'true' : undefined,
        }),
        restaurantService.searchFood('', lat, lng),
      ]);

      if (reqIdRef.current !== myReqId) return;

      const rawData = Array.isArray(resp)
        ? resp
        : (resp as any)?.restaurants ?? (resp as any)?.data ?? [];
      const data = filterWithinRadius(rawData);

      const rawFood = Array.isArray(foodResp)
        ? foodResp
        : (foodResp as any)?.items ?? (foodResp as any)?.data ?? [];

      setRestaurants(data);
      setFoodItems(applyFoodFilters(rawFood));
    } catch (error) {
      console.error('Error fetching nearby restaurants:', error);
    } finally {
      if (reqIdRef.current === myReqId) {
        setLoading(false);
      }
    }
  };

  const handleSearchSubmit = () => {
    if (query.trim().length >= 2) {
      performSearch();
    } else {
      fetchNearbyRestaurants();
    }
  };

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderFilterChip = (label: string, active: boolean, onPress: () => void) => (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
      {active && <Ionicons name="close" size={14} color="#fff" style={{ marginLeft: 4 }} />}
    </TouchableOpacity>
  );

  const renderRestaurantCard = ({ item }: { item: Restaurant }) => {
    const tags = normalizeTags(item.cuisine_type);
    const numRating = Number(item.average_rating);
    const ratingText = Number.isFinite(numRating) && numRating > 0 ? numRating.toFixed(1) : 'New';
    const distKm = Number.isFinite(Number(item.distance_meters))
      ? `${(Number(item.distance_meters) / 1000).toFixed(1)} km`
      : null;

    return (
      <TouchableOpacity
        style={styles.restCard}
        activeOpacity={0.9}
        onPress={() => router.push(`/(customer)/home/restaurant-details?id=${item.id}`)}
      >
        <Image
          source={{
            uri:
              item.cover_image_url ||
              'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80&auto=format&fit=crop',
          }}
          style={styles.restImage}
        />
        <View style={styles.restContent}>
          <View style={styles.restHeader}>
            <Text style={styles.restName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>{ratingText}</Text>
              <Ionicons name="star" size={10} color="#fff" />
            </View>
          </View>
          <Text style={styles.restMeta}>
            {item.preparation_time_minutes || 25} min{distKm ? ` • ${distKm}` : ''}
            {item.is_accepting_orders === false ? ' • Closed' : ''}
          </Text>
          <Text style={styles.restCuisine} numberOfLines={1}>
            {tags.join(' • ') || 'Food'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFoodCard = ({ item }: { item: FoodItem }) => {
    const basePrice = Number(item.price || 0);
    const discPrice = item.discounted_price != null ? Number(item.discounted_price) : null;
    const displayPrice =
      discPrice !== null && Number.isFinite(discPrice) && discPrice > 0 && discPrice < basePrice
        ? discPrice
        : basePrice;

    return (
      <TouchableOpacity
        style={styles.foodCard}
        activeOpacity={0.9}
        onPress={() =>
          router.push(`/(customer)/menu/${item.id}?restaurantId=${item.restaurant_id}`)
        }
      >
        <Image
          source={{
            uri:
              item.image_url ||
              'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=500&q=80&auto=format&fit=crop',
          }}
          style={styles.foodImage}
        />
        <View style={styles.foodContent}>
          <Text style={styles.foodName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.foodRestaurant} numberOfLines={1}>
            @ {item.restaurant_name}
          </Text>
          <View style={styles.foodFooter}>
            <Text style={styles.foodPrice}>R{displayPrice.toFixed(2)}</Text>
            <View style={styles.addBtn}>
              <Ionicons name="add" size={16} color="#fff" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const showNoRestaurantsForTab = activeTab === 'restaurants' && restaurants.length === 0;
  const showNoFoodForTab = activeTab === 'food' && foodItems.length === 0;
  const showNoAllResults =
    activeTab === 'all' && restaurants.length === 0 && foodItems.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <RNStatusBar barStyle="dark-content" />

      {/* 1. Header Search Area */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={THEME.subText} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search food, restaurants..."
            value={query}
            onChangeText={setQuery}
            placeholderTextColor={THEME.subText}
            autoFocus={false}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={THEME.subText} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Filters & Tabs */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {renderFilterChip('Open Now', filters.openNow, () => toggleFilter('openNow'))}
          {renderFilterChip('Vegetarian', filters.veg, () => toggleFilter('veg'))}
          {renderFilterChip('Under R100', filters.under100, () => toggleFilter('under100'))}
          {renderFilterChip('Rating 4.0+', filters.rating4Plus, () => toggleFilter('rating4Plus'))}
        </ScrollView>

        <View style={styles.tabsContainer}>
          {(['all', 'restaurants', 'food'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'food' ? 'Dishes' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 3. Results Area */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={THEME.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.resultsContent}>
          {/* Restaurants Section */}
          {(activeTab === 'all' || activeTab === 'restaurants') && restaurants.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Restaurants</Text>
              {restaurants.map((r) => (
                <View key={r.id} style={{ marginBottom: 16 }}>
                  {renderRestaurantCard({ item: r })}
                </View>
              ))}
            </View>
          )}

          {/* Food Section (Grid) */}
          {(activeTab === 'all' || activeTab === 'food') && foodItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dishes</Text>
              <View style={styles.foodGrid}>
                {foodItems.map((f) => (
                  <View key={f.id} style={styles.foodWrapper}>
                    {renderFoodCard({ item: f })}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Empty State */}
          {!loading && (showNoRestaurantsForTab || showNoFoodForTab || showNoAllResults) && (
            <View style={styles.center}>
              <MaterialCommunityIcons name="food-off" size={48} color={THEME.subText} />
              <Text style={styles.emptyText}>
                {query.trim().length > 1
                  ? `No matches found for "${query.trim()}"`
                  : 'No matching items found'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },

  // Header
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: '#fff' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: THEME.text },

  // Filters
  filtersWrapper: { backgroundColor: '#fff', paddingBottom: 12 },
  filtersScroll: { paddingHorizontal: 16, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  filterChipActive: { backgroundColor: THEME.secondary, borderColor: THEME.secondary },
  filterChipText: { fontSize: 13, color: THEME.text, fontWeight: '500' },
  filterChipTextActive: { color: '#fff' },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6 },
  tabActive: {
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: { fontSize: 13, fontWeight: '600', color: THEME.subText },
  tabTextActive: { color: THEME.text },

  // Results
  resultsContent: { padding: 16, paddingBottom: 100 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: THEME.text, marginBottom: 12 },
  emptyText: { marginTop: 12, color: THEME.subText, fontSize: 16, textAlign: 'center' },

  // Restaurant Card
  restCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  restImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#eee' },
  restContent: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  restHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  restName: { fontSize: 16, fontWeight: '700', color: THEME.text, flex: 1, marginRight: 8 },
  ratingBadge: {
    flexDirection: 'row',
    backgroundColor: THEME.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
  },
  ratingText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginRight: 2 },
  restMeta: { fontSize: 13, color: THEME.subText, marginBottom: 4 },
  restCuisine: { fontSize: 12, color: THEME.primary, fontWeight: '600' },

  // Food Grid
  foodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  foodWrapper: { width: COLUMN_WIDTH, marginBottom: 16 },
  foodCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  foodImage: { width: '100%', height: 120, resizeMode: 'cover' },
  foodContent: { padding: 12 },
  foodName: { fontSize: 14, fontWeight: '700', color: THEME.text, marginBottom: 4, height: 36 },
  foodRestaurant: { fontSize: 11, color: THEME.subText, marginBottom: 8 },
  foodFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodPrice: { fontSize: 15, fontWeight: '800', color: THEME.success },
  addBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
