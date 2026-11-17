import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  StatusBar as RNStatusBar,
  Dimensions,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

// Hooks & Services
import { useLocation } from '../../../hooks/useLocation';
import { useAuth } from '../../../hooks/useAuth';
import { useSocket } from '../../../hooks/useSocket';
import { restaurantService } from '../../../services/restaurant';
import { orderService } from '../../../services/order';
import { APP_CONFIG } from '../../../constants/config';

// --- THEME ---
const THEME = {
  primary: '#FFCC00',
  primaryLight: 'rgba(255, 107, 53, 0.1)',
  primaryAccent: '#FF6B35',
  secondary: '#1A1A1A',
  success: '#00C896',
  warning: '#FFD166',
  danger: '#FF4757',
  background: '#FFFBF2',
  card: '#FFFFFF',
  textLight: '#8E8E93',
  border: '#E5E5E5',
  shadow: 'rgba(0, 0, 0, 0.08)',
  accent: '#5E35B1',
  gradientStart: '#FF6B35',
  gradientEnd: '#FF3366',
};

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.72;
const CUBE_SIZE = 136;
const RESTAURANT_CARD_HEIGHT = 320;

// --- FIXED HEADER CONSTANTS ---
const HEADER_EXPANDED_HEIGHT = Platform.OS === 'ios' ? 120 : 140;
const HEADER_COLLAPSED_HEIGHT = Platform.OS === 'ios' ? 90 : 110;

const ACTIVE_ORDER_STATUSES = [
  'pending',
  'ordering_at_restaurant',
  'order_ready',
  'accepted_by_driver',
  'picked_up',
  'on_the_way',
  'arrived',
];

// --- Types ---
type Restaurant = {
  id: string;
  name: string;
  description: string;
  cuisine_type: string[] | string | null;
  food_categories?: string[] | null;
  cover_image_url: string;
  preparation_time_minutes: number;
  average_rating?: number | string | null;
  total_ratings?: number | string | null;
  is_accepting_orders?: boolean;
  distance_meters?: number | string | null;
};

type MenuItem = {
  id: string;
  name: string;
  restaurant_name: string;
  price: number | string;
  discounted_price?: number | string | null;
  image_url: string;
  restaurant_id: string;
  category?: string | null;
  categories?: string[] | null;
  is_popular?: boolean;
  restaurant_rating?: number | string | null;
};

type FoodCategory = {
  name: string;
  slug: string;
  item_count: number;
  restaurant_count: number;
  restaurant_ids?: string[];
  image_url?: string | null;
};

const normalizeStringArray = (raw: any, fallback: string[] = []): string[] => {
  if (!raw) return fallback;
  if (Array.isArray(raw)) {
    const cleaned = raw.map((item) => String(item).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : fallback;
  }
  if (typeof raw === 'string') {
    const cleaned = raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : fallback;
  }
  return fallback;
};

const formatRating = (value: any): string => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num.toFixed(1) : 'New';
};

const formatDistanceKm = (meters: any): string | null => {
  const num = Number(meters);
  if (!Number.isFinite(num) || num < 0) return null;
  if (num < 1000) return `${Math.round(num)} m`;
  return `${(num / 1000).toFixed(1)} km`;
};

const getFoodCategoryIcon = (name: string): keyof typeof MaterialCommunityIcons.glyphMap => {
  const lower = name.toLowerCase();
  if (lower.includes('kota') || lower.includes('burger') || lower.includes('fatcake')) return 'hamburger';
  if (lower.includes('drink') || lower.includes('beverage') || lower.includes('juice') || lower.includes('soda')) return 'cup-water';
  if (lower.includes('chicken') || lower.includes('wing')) return 'food-drumstick';
  if (lower.includes('pizza')) return 'pizza';
  if (lower.includes('chip') || lower.includes('side') || lower.includes('fry') || lower.includes('dip')) return 'french-fries';
  if (lower.includes('dessert') || lower.includes('cake') || lower.includes('sweet')) return 'cupcake';
  if (lower.includes('breakfast') || lower.includes('bakery')) return 'food-croissant';
  if (lower.includes('grill') || lower.includes('meat') || lower.includes('braai') || lower.includes('steak')) return 'grill';
  if (lower.includes('salad') || lower.includes('veg')) return 'food-apple';
  return 'silverware-fork-knife';
};

const restaurantMatchesCategory = (
  restaurant: Restaurant,
  categoryName: string,
  categoryIds?: Set<string>
): boolean => {
  if (categoryIds && categoryIds.has(restaurant.id)) return true;
  const target = categoryName.trim().toLowerCase();
  const foodCats = normalizeStringArray(restaurant.food_categories);
  const cuisines = normalizeStringArray(restaurant.cuisine_type);
  return [...foodCats, ...cuisines].some(
    (entry) => entry.toLowerCase() === target || entry.toLowerCase().includes(target)
  );
};

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { location } = useLocation();
  const { user } = useAuth();
  const socket = useSocket();

  // --- State ---
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [popularRestaurants, setPopularRestaurants] = useState<Restaurant[]>([]);
  const [foodCategories, setFoodCategories] = useState<FoodCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryRestaurants, setCategoryRestaurants] = useState<Restaurant[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [popularItems, setPopularItems] = useState<MenuItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scrollY] = useState(new Animated.Value(0));

  // --- Animations ---
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const floatingAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const loadingAnim = useRef(new Animated.Value(0)).current;

  const fetchedRef = useRef(false);
  const categoryReqIdRef = useRef(0);

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [HEADER_EXPANDED_HEIGHT, HEADER_COLLAPSED_HEIGHT],
    extrapolate: 'clamp',
  });

  const getSearchCoords = useCallback(() => {
    let lat = location?.coords.latitude;
    let lng = location?.coords.longitude;
    // Use real GPS if within South Africa region; fallback to Johannesburg for emulators
    if (lat == null || lng == null || lat > 0 || lng < 10 || lng > 40) {
      lat = -26.2041;
      lng = 28.0473;
    }
    return { lat, lng };
  }, [location?.coords.latitude, location?.coords.longitude]);

  const loadFavorites = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.FAVORITE_RESTAURANTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setFavoriteIds(new Set(parsed.map(String)));
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleFavorite = async (restaurantId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(restaurantId)) {
        next.delete(restaurantId);
      } else {
        next.add(restaurantId);
      }
      AsyncStorage.setItem(
        APP_CONFIG.STORAGE_KEYS.FAVORITE_RESTAURANTS,
        JSON.stringify(Array.from(next))
      ).catch(() => {});
      return next;
    });
  };

  const refreshActiveOrders = useCallback(async () => {
    if (!user) {
      setActiveOrders([]);
      setActiveOrder(null);
      return;
    }
    try {
      const ordersResponse = await orderService.getMyOrders();
      const orderData: any[] = Array.isArray(ordersResponse)
        ? ordersResponse
        : (ordersResponse as any)?.orders ?? (ordersResponse as any)?.data ?? [];
      const active = orderData.filter((order: any) =>
        ACTIVE_ORDER_STATUSES.includes(order.status)
      );
      setActiveOrders(active);
      setActiveOrder(active[0] || null);
    } catch {
      // Do not break discovery feed if orders call fails
    }
  }, [user]);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const { lat, lng } = getSearchCoords();

      const requests: Promise<any>[] = [
        restaurantService.getHomeFeed(lat, lng),
        restaurantService.searchRestaurants(lat, lng, { maxDistance: 90 }),
      ];
      if (user) {
        requests.push(orderService.getMyOrders());
      }

      const [feedResult, searchResult, ordersResult] = await Promise.allSettled(requests);

      // 1. Parse nearby restaurants
      let restaurantData: any[] = [];
      if (searchResult.status === 'fulfilled') {
        const sr = searchResult.value;
        const extracted = Array.isArray(sr)
          ? sr
          : (sr as any)?.restaurants ?? (sr as any)?.data ?? [];
        if (Array.isArray(extracted)) {
          restaurantData = extracted;
        }
      }

      const normalizedRestaurants: Restaurant[] = restaurantData
        .filter((restaurant: any) => {
          if (restaurant.distance_meters != null && restaurant.delivery_radius_km != null) {
            return Number(restaurant.distance_meters) <= Number(restaurant.delivery_radius_km) * 1000;
          }
          return true;
        })
        .map((restaurant: any) => ({
          ...restaurant,
          cuisine_type: normalizeStringArray(restaurant.cuisine_type, ['Food']),
          food_categories: normalizeStringArray(restaurant.food_categories, []),
        }));

      setRestaurants(normalizedRestaurants);

      const ratedPopular = normalizedRestaurants
        .filter((r) => Number(r.total_ratings || 0) > 0 || Number(r.average_rating || 0) > 0)
        .sort((a, b) => Number(b.average_rating || 0) - Number(a.average_rating || 0));
      setPopularRestaurants((ratedPopular.length > 0 ? ratedPopular : normalizedRestaurants).slice(0, 6));

      // 2. Parse home feed categories & strictly popular menu items
      const nearbyIds = new Set(normalizedRestaurants.map((r) => r.id));
      let apiCategories: FoodCategory[] = [];
      let rawItems: MenuItem[] = [];

      if (feedResult.status === 'fulfilled') {
        const feedPayload = (feedResult.value as any)?.data ?? feedResult.value ?? {};
        apiCategories = Array.isArray(feedPayload.categories) ? feedPayload.categories : [];
        rawItems = Array.isArray(feedPayload.popularItems)
          ? feedPayload.popularItems
          : Array.isArray(feedPayload.discounts)
            ? feedPayload.discounts
            : [];
      }

      // Enforce strict popular-only filter on Popular Menu Items
      const strictlyPopularItems = rawItems.filter(
        (item) => item.is_popular === true && (nearbyIds.size === 0 || nearbyIds.has(item.restaurant_id))
      );
      setPopularItems(strictlyPopularItems);

      // Build unified deduplicated food categories
      const catMap = new Map<string, FoodCategory>();
      apiCategories.forEach((cat) => {
        if (!cat?.name) return;
        const slug = (cat.slug || cat.name).trim().toLowerCase();
        const filteredIds = Array.isArray(cat.restaurant_ids)
          ? nearbyIds.size > 0
            ? cat.restaurant_ids.filter((id) => nearbyIds.has(id))
            : cat.restaurant_ids
          : [];
        if (nearbyIds.size > 0 && filteredIds.length === 0) return;
        catMap.set(slug, {
          name: cat.name.trim(),
          slug,
          item_count: Number(cat.item_count || 0),
          restaurant_count: filteredIds.length || Number(cat.restaurant_count || 0),
          restaurant_ids: filteredIds,
          image_url: cat.image_url || null,
        });
      });

      // Fallback/enrichment from restaurant food_categories or cuisine_type
      normalizedRestaurants.forEach((r) => {
        const sources =
          r.food_categories && r.food_categories.length > 0
            ? r.food_categories
            : normalizeStringArray(r.cuisine_type, []);
        sources.forEach((label) => {
          const slug = label.trim().toLowerCase();
          if (!slug) return;
          const existing = catMap.get(slug);
          if (!existing) {
            catMap.set(slug, {
              name: label.trim(),
              slug,
              item_count: 0,
              restaurant_count: 1,
              restaurant_ids: [r.id],
              image_url: r.cover_image_url || null,
            });
          } else if (existing.restaurant_ids && !existing.restaurant_ids.includes(r.id)) {
            existing.restaurant_ids = [...existing.restaurant_ids, r.id];
            existing.restaurant_count = existing.restaurant_ids.length;
          }
        });
      });

      const mergedCategories = Array.from(catMap.values()).sort(
        (a, b) => b.restaurant_count - a.restaurant_count || a.name.localeCompare(b.name)
      );
      setFoodCategories(mergedCategories);

      // 3. Parse active orders if signed in
      if (user && ordersResult && ordersResult.status === 'fulfilled') {
        const ordersResponse = ordersResult.value;
        const orderData: any[] = Array.isArray(ordersResponse)
          ? ordersResponse
          : (ordersResponse as any)?.orders ?? (ordersResponse as any)?.data ?? [];
        const active = orderData.filter((order: any) =>
          ACTIVE_ORDER_STATUSES.includes(order.status)
        );
        setActiveOrders(active);
        setActiveOrder(active[0] || null);
      } else if (!user) {
        setActiveOrders([]);
        setActiveOrder(null);
      }
    } catch (error) {
      console.error('[DATA FETCH] Critical Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getSearchCoords, user]);

  useEffect(() => {
    loadFavorites();
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchAllData();
    }
  }, [fetchAllData, loadFavorites]);

  useEffect(() => {
    if (location && fetchedRef.current) {
      fetchAllData();
    }
  }, [location?.coords.latitude, location?.coords.longitude]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      refreshActiveOrders();
    }, [loadFavorites, refreshActiveOrders])
  );

  useEffect(() => {
    if (!socket) return;
    const handleOrderUpdate = () => {
      refreshActiveOrders();
    };
    socket.on('order_update', handleOrderUpdate);
    return () => {
      socket.off('order_update', handleOrderUpdate);
    };
  }, [socket, refreshActiveOrders]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.spring(fadeAnim, {
          toValue: 1,
          tension: 20,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 20,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 20,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(floatingAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatingAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [loading]);

  useEffect(() => {
    if (loading && !refreshing) {
      Animated.loop(
        Animated.timing(loadingAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      loadingAnim.stopAnimation();
      loadingAnim.setValue(0);
    }
  }, [loading, refreshing]);

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchAllData();
    if (selectedCategory) {
      await handleSelectCategory(selectedCategory, true);
    }
  };

  const handleSelectCategory = async (categoryName: string | null, force = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!categoryName || (!force && selectedCategory?.toLowerCase() === categoryName.toLowerCase())) {
      setSelectedCategory(null);
      setCategoryRestaurants([]);
      setCategoryLoading(false);
      return;
    }

    setSelectedCategory(categoryName);

    const catObj = foodCategories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase()
    );
    const idSet = catObj?.restaurant_ids ? new Set(catObj.restaurant_ids) : undefined;
    const instantMatches = restaurants.filter((r) =>
      restaurantMatchesCategory(r, categoryName, idSet)
    );
    setCategoryRestaurants(instantMatches);

    const reqId = ++categoryReqIdRef.current;
    setCategoryLoading(true);
    try {
      const { lat, lng } = getSearchCoords();
      const res: any = await restaurantService.searchRestaurants(lat, lng, {
        maxDistance: 90,
        category: categoryName,
      });
      if (categoryReqIdRef.current !== reqId) return;

      const list = Array.isArray(res) ? res : res?.data ?? res?.restaurants ?? [];
      if (Array.isArray(list)) {
        const normalized: Restaurant[] = list
          .filter((restaurant: any) => {
            if (restaurant.distance_meters != null && restaurant.delivery_radius_km != null) {
              return Number(restaurant.distance_meters) <= Number(restaurant.delivery_radius_km) * 1000;
            }
            return true;
          })
          .map((restaurant: any) => ({
            ...restaurant,
            cuisine_type: normalizeStringArray(restaurant.cuisine_type, ['Food']),
            food_categories: normalizeStringArray(restaurant.food_categories, []),
          }));
        setCategoryRestaurants(normalized.length > 0 ? normalized : instantMatches);
      }
    } catch {
      // Retain instant client-side matches cleanly
    } finally {
      if (categoryReqIdRef.current === reqId) {
        setCategoryLoading(false);
      }
    }
  };

  const handleCardPress = (id: string, category?: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (category) {
      router.push(
        `/(customer)/home/restaurant-details?id=${id}&category=${encodeURIComponent(category)}`
      );
    } else {
      router.push(`/(customer)/home/restaurant-details?id=${id}`);
    }
  };

  const categoryChips = useMemo(() => {
    const allChip: FoodCategory = {
      name: 'All',
      slug: '__all__',
      item_count: 0,
      restaurant_count: restaurants.length,
    };
    return [allChip, ...foodCategories];
  }, [foodCategories, restaurants.length]);

  const userInitials = useMemo(() => {
    const first = user?.first_name?.trim()?.[0] || '';
    const last = user?.last_name?.trim()?.[0] || '';
    return (first + last).toUpperCase() || 'G';
  }, [user?.first_name, user?.last_name]);

  // --- Render Helpers ---
  const renderFoodCategory = ({ item }: { item: FoodCategory }) => {
    const isAll = item.slug === '__all__';
    const isSelected = isAll
      ? selectedCategory === null
      : selectedCategory?.toLowerCase() === item.name.toLowerCase();

    return (
      <TouchableOpacity
        style={[
          styles.categoryPill,
          isSelected && styles.categoryPillSelected,
        ]}
        activeOpacity={0.85}
        onPress={() => handleSelectCategory(isAll ? null : item.name)}
      >
        <View
          style={[
            styles.categoryPillIconWrap,
            isSelected && styles.categoryPillIconWrapSelected,
          ]}
        >
          <MaterialCommunityIcons
            name={isAll ? 'apps' : getFoodCategoryIcon(item.name)}
            size={20}
            color={isSelected ? '#1A1A1A' : THEME.primaryAccent}
          />
        </View>
        <View style={styles.categoryPillTextWrap}>
          <Text
            style={[
              styles.categoryPillTitle,
              isSelected && styles.categoryPillTitleSelected,
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={[
              styles.categoryPillCount,
              isSelected && styles.categoryPillCountSelected,
            ]}
          >
            {item.restaurant_count} {item.restaurant_count === 1 ? 'place' : 'places'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPopularCard = ({ item, index }: { item: Restaurant; index: number }) => {
    const translateY = floatingAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, index % 2 === 0 ? -3 : 3],
    });

    const cuisineArray = normalizeStringArray(item.cuisine_type, ['Food']);
    const isFav = favoriteIds.has(item.id);
    const isClosed = item.is_accepting_orders === false;

    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => handleCardPress(item.id)}
        style={styles.cardContainer}
      >
        <Animated.View
          style={[
            styles.restaurantCard,
            {
              transform: [{ translateY }, { scale: scaleAnim }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.cardGlow,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.1, 0.2, 0.1],
                }),
              },
            ]}
          />

          <View style={styles.cardImageContainer}>
            <Image
              source={{
                uri:
                  item.cover_image_url ||
                  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80&auto=format&fit=crop',
              }}
              style={styles.cardImage}
            />
            <View style={[StyleSheet.absoluteFill, styles.gradientOverlay]} />

            <View style={styles.cardTopRow}>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.ratingText}>{formatRating(item.average_rating)}</Text>
              </View>

              <TouchableOpacity
                style={styles.likeButton}
                onPress={() => toggleFavorite(item.id)}
              >
                <Ionicons
                  name={isFav ? 'heart' : 'heart-outline'}
                  size={18}
                  color={isFav ? '#FF4757' : '#8E8E93'}
                />
              </TouchableOpacity>
            </View>

            {isClosed && (
              <View style={styles.closedBadge}>
                <Text style={styles.closedBadgeText}>Closed</Text>
              </View>
            )}

            <View style={styles.timeBadge}>
              <Feather name="clock" size={12} color="#fff" />
              <Text style={styles.timeText}>{item.preparation_time_minutes || 25} min</Text>
            </View>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
              </View>
            </View>

            <Text style={styles.cardDescription} numberOfLines={2}>
              {item.description || 'Freshly prepared meals delivered fast'}
            </Text>

            <View style={styles.cuisineContainer}>
              {cuisineArray.slice(0, 2).map((cuisine, idx) => (
                <View key={idx} style={styles.cuisineTag}>
                  <Text style={styles.cuisineText}>{cuisine}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderPopularItemCard = ({ item }: { item: MenuItem }) => {
    const basePrice = Number(item.price || 0);
    const discPrice =
      item.discounted_price != null ? Number(item.discounted_price) : null;
    const hasDiscount =
      discPrice !== null && Number.isFinite(discPrice) && discPrice > 0 && discPrice < basePrice;
    const discountPercent =
      hasDiscount && basePrice > 0
        ? Math.round(((basePrice - (discPrice as number)) / basePrice) * 100)
        : 0;
    const displayPrice = hasDiscount ? (discPrice as number) : basePrice;

    const cardScale = floatingAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0.98],
    });

    return (
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/(customer)/menu/${item.id}?restaurantId=${item.restaurant_id}`);
        }}
        style={styles.cubeContainer}
      >
        <Animated.View style={[styles.cubeCard, { transform: [{ scale: cardScale }] }]}>
          <Image
            source={{
              uri:
                item.image_url ||
                'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=500&q=80&auto=format&fit=crop',
            }}
            style={styles.cubeImage}
          />
          <View style={styles.cubeOverlay} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={styles.cubeGradient}
          />

          <View style={styles.cubeTopBadges}>
            <View style={styles.popularBadge}>
              <Ionicons name="flame" size={11} color="#1A1A1A" />
              <Text style={styles.popularBadgeText}>Popular</Text>
            </View>
            {discountPercent > 0 && (
              <View style={styles.cubeDiscountBadge}>
                <Text style={styles.cubeDiscountText}>-{discountPercent}%</Text>
              </View>
            )}
          </View>

          <View style={styles.cubeContent}>
            <View style={styles.cubePriceTag}>
              <Text style={styles.cubePriceText}>R{displayPrice.toFixed(2)}</Text>
              {hasDiscount && (
                <Text style={styles.cubeOldPrice}>R{basePrice.toFixed(2)}</Text>
              )}
            </View>

            <Text style={styles.cubeTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.cubeRestaurant} numberOfLines={1}>
              {item.restaurant_name}
            </Text>

            <View style={styles.cubeActionButton}>
              <Feather name="shopping-bag" size={14} color="#fff" />
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderVerticalRestaurantCard = (
    item: Restaurant,
    _index: number,
    activeCategory?: string | null
  ) => {
    const translateX = fadeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [20, 0],
    });

    const cuisineArray = normalizeStringArray(item.cuisine_type, ['Food']);
    const isFav = favoriteIds.has(item.id);
    const isClosed = item.is_accepting_orders === false;
    const distanceLabel = formatDistanceKm(item.distance_meters);

    return (
      <Animated.View
        key={item.id}
        style={[
          styles.verticalCardContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateX }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => handleCardPress(item.id, activeCategory)}
        >
          <View style={styles.verticalCard}>
            <View style={styles.verticalImageWrapper}>
              <Image
                source={{
                  uri:
                    item.cover_image_url ||
                    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80&auto=format&fit=crop',
                }}
                style={styles.verticalImage}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.35)']}
                style={styles.verticalImageGradient}
              />

              <BlurView intensity={80} style={styles.verticalRatingBadge}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.verticalRatingText}>
                  {formatRating(item.average_rating)}
                </Text>
              </BlurView>

              {isClosed && (
                <View style={styles.verticalClosedPill}>
                  <Text style={styles.verticalClosedPillText}>Closed now</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.verticalLikeBtn}
                onPress={() => toggleFavorite(item.id)}
              >
                <BlurView intensity={80} style={StyleSheet.absoluteFill} />
                <Ionicons
                  name={isFav ? 'heart' : 'heart-outline'}
                  size={18}
                  color={isFav ? '#FF4757' : '#fff'}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.verticalContent}>
              <View style={styles.verticalHeaderRow}>
                <Text style={styles.verticalTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.verticalVerified}>
                  <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
                </View>
              </View>

              <Text style={styles.verticalDesc} numberOfLines={2}>
                {item.description || 'Delicious meals ready for delivery'}
              </Text>

              <View style={styles.verticalMetaContainer}>
                <View style={styles.verticalMetaItem}>
                  <Feather name="clock" size={14} color={THEME.textLight} />
                  <Text style={styles.verticalMetaText}>
                    {item.preparation_time_minutes || 25} mins
                  </Text>
                </View>

                {distanceLabel && (
                  <>
                    <View style={styles.verticalDivider} />
                    <View style={styles.verticalMetaItem}>
                      <Feather name="map-pin" size={14} color={THEME.textLight} />
                      <Text style={styles.verticalMetaText}>{distanceLabel}</Text>
                    </View>
                  </>
                )}

                <View style={styles.verticalDivider} />

                <View style={styles.verticalMetaItem}>
                  <Feather name="truck" size={14} color={THEME.textLight} />
                  <Text style={styles.verticalMetaText}>Free over R25</Text>
                </View>
              </View>

              <View style={styles.verticalCuisineRow}>
                {cuisineArray.slice(0, 3).map((cuisine, idx) => (
                  <View key={idx} style={styles.verticalCuisineTag}>
                    <Text style={styles.verticalCuisineText}>{cuisine}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.verticalActionButton}>
                <Text style={styles.verticalActionText}>
                  {activeCategory ? `View ${activeCategory} Menu` : 'View Menu'}
                </Text>
                <Feather name="arrow-right" size={16} color={THEME.primaryAccent} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Loading Screen
  if (loading && !refreshing) {
    const spin = loadingAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const dot1Opacity = loadingAnim.interpolate({
      inputRange: [0, 0.33, 0.66, 1],
      outputRange: [0.3, 1, 0.3, 0.3],
    });
    const dot2Opacity = loadingAnim.interpolate({
      inputRange: [0, 0.33, 0.66, 1],
      outputRange: [0.3, 0.3, 1, 0.3],
    });
    const dot3Opacity = loadingAnim.interpolate({
      inputRange: [0, 0.33, 0.66, 1],
      outputRange: [0.3, 0.3, 0.3, 1],
    });

    return (
      <View style={styles.loadingContainer}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} />

        <View style={styles.loadingContent}>
          <Animated.View
            style={[
              styles.loadingLogo,
              {
                transform: [{ rotate: spin }],
              },
            ]}
          >
            <LinearGradient
              colors={[THEME.gradientStart, THEME.gradientEnd]}
              style={styles.loadingLogoGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Feather name="shopping-bag" size={36} color="#fff" />
            </LinearGradient>
          </Animated.View>

          <Text style={styles.loadingBrandText}>Happy Delivery</Text>
          <Text style={styles.loadingTagline}>Curating culinary excellence</Text>

          <View style={styles.loadingDots}>
            <Animated.View style={[styles.loadingDot, { opacity: dot1Opacity }]} />
            <Animated.View style={[styles.loadingDot, { opacity: dot2Opacity }]} />
            <Animated.View style={[styles.loadingDot, { opacity: dot3Opacity }]} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <RNStatusBar barStyle="dark-content" />

      {/* --- MINIMAL HEADER --- */}
      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTopRow}>
            <View style={styles.greetingContainer}>
              <Text style={styles.welcomeText}>
                Good{' '}
                {new Date().getHours() < 12
                  ? 'Morning'
                  : new Date().getHours() < 18
                    ? 'Afternoon'
                    : 'Evening'}
                , {user?.first_name?.split(' ')[0] || 'Foodie'}!
              </Text>
              <Text style={styles.userName}>
                {(() => {
                  const hour = new Date().getHours();
                  if (hour < 5) return 'Late night craving?';
                  if (hour < 11) return "What's for breakfast?";
                  if (hour < 15) return 'Time for lunch! Hungry?';
                  if (hour < 18) return 'Afternoon snack time?';
                  if (hour < 22) return 'Dinner plans?';
                  return 'Late night craving?';
                })()}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => router.push('/(customer)/profile')}
            >
              {user?.profile_image_url ? (
                <Image source={{ uri: user.profile_image_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarInitials}>
                  <Text style={styles.avatarInitialsText}>{userInitials}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[THEME.primary]}
            tintColor={THEME.primary}
            progressViewOffset={HEADER_EXPANDED_HEIGHT}
          />
        }
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
        {/* Promo Banner */}
        <Animated.View
          style={[
            styles.bannerSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.95}
            style={styles.bannerContainer}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(customer)/search');
            }}
          >
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80&auto=format&fit=crop',
              }}
              style={styles.bannerImage}
            />
            <LinearGradient
              colors={['rgba(0, 0, 0, 0.1)', 'rgba(0, 0, 0, 0.85)']}
              style={styles.bannerGradient}
            />

            <View style={styles.bannerContent}>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>CRAVING SOMETHING GOOD?</Text>
              </View>
              <Text style={styles.bannerTitle}>Explore local favorites</Text>
              <Text style={styles.bannerSubtitle}>
                Freshly made meals delivered straight to your door
              </Text>

              <View style={styles.bannerButton}>
                <Text style={styles.bannerButtonText}>Search restaurants</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Active Order Widget */}
        {activeOrder && (
          <View style={styles.activeOrderSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Order</Text>
              <TouchableOpacity
                onPress={() =>
                  router.push(
                    activeOrder.driver_id
                      ? `/(customer)/orders/tracking?id=${activeOrder.id}`
                      : `/(customer)/orders/${activeOrder.id}`
                  )
                }
              >
                <Text style={styles.seeAllText}>
                  {activeOrder.driver_id ? 'Track Live' : 'View Status'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.activeOrderCard}
              activeOpacity={0.9}
              onPress={() =>
                router.push(
                  activeOrder.driver_id
                    ? `/(customer)/orders/tracking?id=${activeOrder.id}`
                    : `/(customer)/orders/${activeOrder.id}`
                )
              }
            >
              <View style={styles.activeOrderRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.activeOrderLabel}>
                    {activeOrder.restaurant_name || 'Order in progress'}
                  </Text>
                  <Text style={styles.activeOrderSubLabel}>
                    {activeOrder.order_number
                      ? `Order #${activeOrder.order_number}`
                      : 'Open order'}
                  </Text>
                </View>
                <View style={styles.activeOrderBadge}>
                  <Text style={styles.activeOrderBadgeText}>
                    {String(activeOrder.status || '').replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
              <Text style={styles.activeOrderDetails} numberOfLines={1}>
                {activeOrders.length > 1
                  ? `${activeOrders.length} active orders in progress`
                  : activeOrder.driver_id
                    ? 'Tap to track your driver live on the map'
                    : 'Tap to view progress or manage order'}
              </Text>
              <Text style={styles.activeOrderDetails} numberOfLines={1}>
                Driver:{' '}
                {activeOrder.driver_first_name
                  ? `${activeOrder.driver_first_name} ${activeOrder.driver_last_name || ''}`.trim()
                  : 'Waiting for restaurant / driver'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Food Categories (right before Popular Nearby) */}
        {foodCategories.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Food Categories</Text>
                <Text style={styles.sectionSubtitle}>
                  Pick a category to see matching restaurants
                </Text>
              </View>
              {selectedCategory && (
                <TouchableOpacity
                  style={styles.clearFilterButton}
                  onPress={() => handleSelectCategory(null)}
                >
                  <Text style={styles.clearFilterText}>Clear</Text>
                  <Ionicons name="close-circle" size={15} color={THEME.primaryAccent} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              horizontal
              data={categoryChips}
              renderItem={renderFoodCategory}
              keyExtractor={(item) => `food-cat-${item.slug}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
              decelerationRate="fast"
            />
          </View>
        )}

        {/* When a Food Category is selected, prominently show matching Restaurants */}
        {selectedCategory ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.sectionTitle}>
                  Restaurants with {selectedCategory}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {categoryLoading
                    ? 'Finding restaurants...'
                    : `${categoryRestaurants.length} ${
                        categoryRestaurants.length === 1 ? 'restaurant' : 'restaurants'
                      } available`}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={() => handleSelectCategory(null)}
              >
                <Text style={styles.seeAllText}>Show All</Text>
              </TouchableOpacity>
            </View>

            {categoryLoading && categoryRestaurants.length === 0 ? (
              <View style={styles.categoryLoadingBox}>
                <ActivityIndicator size="large" color={THEME.primaryAccent} />
              </View>
            ) : categoryRestaurants.length > 0 ? (
              <View style={styles.verticalList}>
                {categoryRestaurants.map((item, index) =>
                  renderVerticalRestaurantCard(item, index, selectedCategory)
                )}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="food-off-outline"
                  size={48}
                  color={THEME.textLight}
                />
                <Text style={styles.emptyStateTitle}>
                  No restaurants with "{selectedCategory}" nearby
                </Text>
                <Text style={styles.emptyStateText}>
                  Try another food category or view all restaurants
                </Text>
                <TouchableOpacity
                  style={styles.resetCategoryButton}
                  onPress={() => handleSelectCategory(null)}
                >
                  <Text style={styles.resetCategoryButtonText}>View All Restaurants</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Popular Nearby Restaurants */}
            {popularRestaurants.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Popular Nearby</Text>
                    <Text style={styles.sectionSubtitle}>Most loved by foodies</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.seeAllButton}
                    onPress={() => router.push('/(customer)/search')}
                  >
                    <Text style={styles.seeAllText}>Browse all</Text>
                    <Feather name="chevron-right" size={16} color={THEME.primaryAccent} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  horizontal
                  data={popularRestaurants}
                  renderItem={renderPopularCard}
                  keyExtractor={(item) => `pop-${item.id}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  snapToInterval={CARD_WIDTH + 16}
                  decelerationRate="fast"
                />
              </View>
            )}

            {/* Popular Menu Items (Strictly items marked is_popular = true) */}
            {popularItems.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Popular Menu Items</Text>
                    <Text style={styles.sectionSubtitle}>Customer favorites only</Text>
                  </View>
                </View>
                <FlatList
                  horizontal
                  data={popularItems}
                  renderItem={renderPopularItemCard}
                  keyExtractor={(item) => `popular-item-${item.id}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  decelerationRate="fast"
                />
              </View>
            )}

            {/* All Restaurants */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>All Restaurants</Text>
                  <Text style={styles.sectionSubtitle}>
                    {restaurants.length} places to explore
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.seeAllButton}
                  onPress={() => router.push('/(customer)/search')}
                >
                  <Text style={styles.seeAllText}>More</Text>
                  <Feather name="chevron-right" size={16} color={THEME.primaryAccent} />
                </TouchableOpacity>
              </View>

              {restaurants.length > 0 ? (
                <View style={styles.verticalList}>
                  {restaurants.map((item, index) => renderVerticalRestaurantCard(item, index))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Feather name="compass" size={48} color={THEME.textLight} />
                  <Text style={styles.emptyStateTitle}>No restaurants found</Text>
                  <Text style={styles.emptyStateText}>
                    Try adjusting your location or searching all restaurants
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.background,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingLogo: {
    width: 100,
    height: 100,
    borderRadius: 25,
    marginBottom: 24,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingLogoGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBrandText: {
    fontSize: 32,
    fontWeight: '800',
    color: THEME.secondary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  loadingTagline: {
    fontSize: 14,
    color: THEME.textLight,
    fontWeight: '500',
    marginBottom: 40,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.primary,
  },
  scrollContent: {
    paddingTop: HEADER_EXPANDED_HEIGHT + 8,
    paddingBottom: 100,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: THEME.background,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 13,
    color: THEME.textLight,
    fontWeight: '600',
    marginBottom: 4,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.secondary,
    letterSpacing: -0.5,
  },
  profileButton: {
    marginLeft: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.border,
  },
  avatarInitials: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    color: THEME.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  bannerSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  bannerContainer: {
    height: 190,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bannerGradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  bannerContent: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
  },
  bannerBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  bannerBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 6,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 16,
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 8,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: THEME.secondary,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: THEME.textLight,
    fontWeight: '500',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: THEME.primaryAccent,
    fontSize: 14,
    fontWeight: '700',
    marginRight: 4,
  },
  clearFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: THEME.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  clearFilterText: {
    color: THEME.primaryAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  activeOrderSection: {
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  activeOrderCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  activeOrderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeOrderLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.secondary,
  },
  activeOrderSubLabel: {
    fontSize: 13,
    color: THEME.textLight,
    marginTop: 2,
  },
  activeOrderBadge: {
    backgroundColor: THEME.primaryAccent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  activeOrderBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  activeOrderDetails: {
    color: THEME.textLight,
    fontSize: 13,
    marginTop: 4,
  },
  horizontalList: {
    paddingLeft: 24,
    paddingRight: 8,
  },
  categoriesList: {
    paddingHorizontal: 24,
    gap: 10,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EFEFEF',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  categoryPillSelected: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  categoryPillIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: THEME.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  categoryPillIconWrapSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  categoryPillTextWrap: {
    maxWidth: 130,
  },
  categoryPillTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.secondary,
  },
  categoryPillTitleSelected: {
    color: '#1A1A1A',
  },
  categoryPillCount: {
    fontSize: 11,
    color: THEME.textLight,
    fontWeight: '500',
    marginTop: 1,
  },
  categoryPillCountSelected: {
    color: '#3A3A3A',
    fontWeight: '600',
  },
  categoryLoadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  resetCategoryButton: {
    marginTop: 16,
    backgroundColor: THEME.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  resetCategoryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  cardContainer: {
    width: CARD_WIDTH,
    marginRight: 16,
  },
  restaurantCard: {
    backgroundColor: THEME.card,
    borderRadius: 24,
    height: RESTAURANT_CARD_HEIGHT,
    overflow: 'hidden',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: THEME.primary,
    borderRadius: 24,
  },
  cardImageContainer: {
    height: 180,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  cardTopRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ratingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  likeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  closedBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(255, 71, 87, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  closedBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  timeBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.secondary,
    flex: 1,
    marginRight: 8,
  },
  verifiedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardDescription: {
    fontSize: 13,
    color: THEME.textLight,
    lineHeight: 18,
    marginBottom: 12,
  },
  cuisineContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  cuisineTag: {
    backgroundColor: THEME.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cuisineText: {
    fontSize: 12,
    color: THEME.primaryAccent,
    fontWeight: '600',
  },
  cubeContainer: {
    width: CUBE_SIZE,
    marginRight: 12,
  },
  cubeCard: {
    width: CUBE_SIZE,
    height: CUBE_SIZE * 1.32,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  cubeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cubeOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  cubeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
  },
  cubeTopBadges: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: THEME.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  popularBadgeText: {
    color: '#1A1A1A',
    fontSize: 10,
    fontWeight: '800',
  },
  cubeDiscountBadge: {
    backgroundColor: '#FF4757',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cubeDiscountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  cubeContent: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  cubePriceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cubePriceText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    marginRight: 6,
  },
  cubeOldPrice: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  cubeTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  cubeRestaurant: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 6,
  },
  cubeActionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  verticalList: {
    paddingHorizontal: 24,
    gap: 20,
  },
  verticalCardContainer: {
    marginBottom: 4,
  },
  verticalCard: {
    backgroundColor: THEME.card,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  verticalImageWrapper: {
    height: 196,
    position: 'relative',
  },
  verticalImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  verticalImageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  verticalRatingBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  verticalRatingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  verticalClosedPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 71, 87, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  verticalClosedPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  verticalLikeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  verticalContent: {
    padding: 20,
  },
  verticalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  verticalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.secondary,
    flex: 1,
    marginRight: 12,
  },
  verticalVerified: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalDesc: {
    fontSize: 14,
    color: THEME.textLight,
    lineHeight: 20,
    marginBottom: 14,
  },
  verticalMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  verticalMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verticalMetaText: {
    fontSize: 13,
    color: THEME.textLight,
    fontWeight: '500',
  },
  verticalDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: THEME.border,
    marginHorizontal: 10,
  },
  verticalCuisineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  verticalCuisineTag: {
    backgroundColor: THEME.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  verticalCuisineText: {
    fontSize: 12,
    color: THEME.primaryAccent,
    fontWeight: '600',
  },
  verticalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.primaryLight,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  verticalActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.primaryAccent,
    marginRight: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.secondary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: THEME.textLight,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 40,
  },
});
