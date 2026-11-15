import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  Dimensions,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur'; // Ensure you have this or remove BlurView usage

// Services & Components
import { restaurantService } from '../../../services/restaurant';
import { useLocation } from '../../../hooks/useLocation';
import { colors } from '../../../constants/colors';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2; // 2 Columns for food

// --- Types ---
type Restaurant = {
  id: string;
  name: string;
  description: string;
  cuisine_type: string[];
  cover_image_url: string;
  average_rating: number;
  preparation_time_minutes: number;
  distance_meters: number;
};

type FoodItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  restaurant_name: string;
  restaurant_id: string;
  is_veg: boolean;
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
  const params = useLocalSearchParams<{ query?: string }>();
  const { location } = useLocation();
  
  // State
  const [query, setQuery] = useState(params.query || '');
  const [activeTab, setActiveTab] = useState<'all' | 'restaurants' | 'food'>('all');
  const [loading, setLoading] = useState(false);
  
  // Data
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  
  // Filters
  const [filters, setFilters] = useState({
    under100: false,
    veg: false,
    rating4Plus: false,
  });

  // Debounce Search
  useEffect(() => {
    if (params.query && params.query !== query) {
      setQuery(params.query);
    }
  }, [params.query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Use GPS if available, Johannesburg as fallback so the screen is never blank
      if (query.length >= 2) {
        performSearch();
      } else {
        fetchNearbyRestaurants();
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [query, filters, location]);

  const getEffectiveCoords = () => {
    let lat = location?.coords.latitude;
    let lng = location?.coords.longitude;
    if (lat == null || lng == null || lat > 0 || lng < 10 || lng > 40) {
      return { lat: -26.2041, lng: 28.0473 };
    }
    return { lat, lng };
  };

  const performSearch = async () => {
    setLoading(true);
    try {
      const { lat, lng } = getEffectiveCoords();

      // Parallel Fetch: restaurants and food matching query
      const [restRes, foodRes] = await Promise.all([
        restaurantService.searchRestaurants(lat, lng, {
          query: query,
          minRating: filters.rating4Plus ? 4.0 : undefined,
        }),
        restaurantService.searchFood(query, lat, lng),
      ]);

      // --- Process Restaurants ---
      let restData = Array.isArray(restRes) ? restRes : ((restRes as any)?.restaurants ?? (restRes as any)?.data ?? []);
      // Filter by delivery radius
      restData = restData.filter((r: any) => {
        if (r.distance_meters != null && r.delivery_radius_km != null) {
          return Number(r.distance_meters) <= (Number(r.delivery_radius_km) * 1000);
        }
        return true;
      });
      // Filter by Name match if API search was broad
      restData = restData.filter((r: Restaurant) => 
        r.name.toLowerCase().includes(query.toLowerCase()) || 
        (r.cuisine_type || []).some((c: string) => c.toLowerCase().includes(query.toLowerCase()))
      );

      // --- Process Food ---
      let foodData = Array.isArray(foodRes) ? foodRes : ((foodRes as any)?.items ?? (foodRes as any)?.data ?? []);
      
      // Apply Client-Side Filters
      if (filters.under100) {
        foodData = foodData.filter((i: FoodItem) => Number(i.price) <= 100);
      }
      if (filters.veg) {
        foodData = foodData.filter((i: FoodItem) => i.is_veg);
      }

      setRestaurants(restData);
      setFoodItems(foodData);

    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyRestaurants = async () => {
    setLoading(true);
    try {
      const { lat, lng } = getEffectiveCoords();

      // Use the general search endpoint without query to get nearby restaurants
      const resp = await restaurantService.searchRestaurants(lat, lng, { minRating: filters.rating4Plus ? 4.0 : undefined });
      let data = Array.isArray(resp) ? resp : ((resp as any)?.restaurants ?? (resp as any)?.data ?? []);
      // Filter by delivery radius
      data = data.filter((r: any) => {
        if (r.distance_meters != null && r.delivery_radius_km != null) {
          return Number(r.distance_meters) <= (Number(r.delivery_radius_km) * 1000);
        }
        return true;
      });

      // Optionally apply client-side cuisine/name filter when query exists (but here query is short)
      setRestaurants(data);
      setFoodItems([]);
    } catch (error) {
      console.error('Error fetching nearby restaurants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length >= 2) {
      router.replace(`/(customer)/search?query=${encodeURIComponent(trimmedQuery)}`);
      performSearch();
    }
  };

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- Render Helpers ---

  const renderFilterChip = (label: string, active: boolean, onPress: () => void) => (
    <TouchableOpacity
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
      {active && <Ionicons name="close" size={14} color="#fff" style={{marginLeft: 4}} />}
    </TouchableOpacity>
  );

  const renderRestaurantCard = ({ item }: { item: Restaurant }) => (
    <TouchableOpacity
      style={styles.restCard}
      activeOpacity={0.9}
      onPress={() => router.push(`/(customer)/home/restaurant-details?id=${item.id}`)}
    >
      <Image source={{ uri: item.cover_image_url }} style={styles.restImage} />
      <View style={styles.restContent}>
        <View style={styles.restHeader}>
          <Text style={styles.restName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>{Number(item.average_rating).toFixed(1)}</Text>
            <Ionicons name="star" size={10} color="#fff" />
          </View>
        </View>
        <Text style={styles.restMeta}>
          {item.preparation_time_minutes} min • {(item.distance_meters / 1000).toFixed(1)} km
        </Text>
        <Text style={styles.restCuisine} numberOfLines={1}>
          {Array.isArray(item.cuisine_type) ? item.cuisine_type.join(' • ') : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderFoodCard = ({ item }: { item: FoodItem }) => (
    <TouchableOpacity
      style={styles.foodCard}
      activeOpacity={0.9}
      onPress={() => router.push(`/(customer)/home/restaurant-details?id=${item.restaurant_id}`)}
    >
      <Image source={{ uri: item.image_url || 'https://via.placeholder.com/150' }} style={styles.foodImage} />
      <View style={styles.foodContent}>
        <Text style={styles.foodName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.foodRestaurant} numberOfLines={1}>@ {item.restaurant_name}</Text>
        <View style={styles.foodFooter}>
          <Text style={styles.foodPrice}>R{item.price}</Text>
          <View style={styles.addBtn}>
            <Ionicons name="add" size={16} color="#fff" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {renderFilterChip('Vegetarian', filters.veg, () => toggleFilter('veg'))}
          {renderFilterChip('Under R100', filters.under100, () => toggleFilter('under100'))}
          {renderFilterChip('Rating 4.0+', filters.rating4Plus, () => toggleFilter('rating4Plus'))}
        </ScrollView>
        
        <View style={styles.tabsContainer}>
          {['all', 'restaurants', 'food'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
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
              {restaurants.map(r => (
                <View key={r.id} style={{marginBottom: 16}}>
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
                {foodItems.map(f => (
                  <View key={f.id} style={styles.foodWrapper}>
                    {renderFoodCard({ item: f })}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Empty State */}
          {!loading && restaurants.length === 0 && foodItems.length === 0 && query.length > 1 && (
            <View style={styles.center}>
              <MaterialCommunityIcons name="food-off" size={48} color={THEME.subText} />
              <Text style={styles.emptyText}>No matches found for "{query}"</Text>
            </View>
          )}
          
          {/* Initial State (only show prompt when there are no results) */}
          {query.length < 2 && restaurants.length === 0 && foodItems.length === 0 && (
            <View style={styles.center}>
              <Ionicons name="search-outline" size={48} color={THEME.border} />
              <Text style={styles.emptyText}>Type to find delicious food...</Text>
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
  tabActive: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: {width:0, height:1} },
  tabText: { fontSize: 13, fontWeight: '600', color: THEME.subText },
  tabTextActive: { color: THEME.text },

  // Results
  resultsContent: { padding: 16, paddingBottom: 100 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: THEME.text, marginBottom: 12 },
  emptyText: { marginTop: 12, color: THEME.subText, fontSize: 16 },

  // Restaurant Card
  restCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: {width:0, height:4}
  },
  restImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#eee' },
  restContent: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  restHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  restName: { fontSize: 16, fontWeight: '700', color: THEME.text, flex: 1 },
  ratingBadge: { flexDirection: 'row', backgroundColor: THEME.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignItems: 'center' },
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
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: {width:0, height:4}
  },
  foodImage: { width: '100%', height: 120, resizeMode: 'cover' },
  foodContent: { padding: 12 },
  foodName: { fontSize: 14, fontWeight: '700', color: THEME.text, marginBottom: 4, height: 36 }, // Fixed height for 2 lines
  foodRestaurant: { fontSize: 11, color: THEME.subText, marginBottom: 8 },
  foodFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodPrice: { fontSize: 15, fontWeight: '800', color: THEME.success },
  addBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: THEME.primary, justifyContent: 'center', alignItems: 'center' },
});