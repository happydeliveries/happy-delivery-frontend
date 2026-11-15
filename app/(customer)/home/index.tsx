import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar as RNStatusBar,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons, Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

// Hooks & Services
import { useLocation } from '../../../hooks/useLocation';
import { useAuth } from '../../../hooks/useAuth';
import { restaurantService } from '../../../services/restaurant';
import { orderService } from '../../../services/order';

import { LinearGradient } from 'expo-linear-gradient';

// --- THEME ---
const THEME = {
  primary: '#FFCC00',
  primaryLight: 'rgba(255, 107, 53, 0.1)',
  secondary: '#1A1A1A',
  success: '#00C896',
  warning: '#FFD166',
  background: '#FFFBF2',
  card: '#FFFFFF',
  textLight: '#8E8E93',
  border: '#E5E5E5',
  shadow: 'rgba(0, 0, 0, 0.08)',
  accent: '#5E35B1',
  gradientStart: '#FF6B35',
  gradientEnd: '#FF3366',
};

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.72;
const CUBE_SIZE = 120;
const RESTAURANT_CARD_HEIGHT = 320;

// --- FIXED HEADER CONSTANTS ---
const HEADER_EXPANDED_HEIGHT = Platform.OS === 'ios' ? 120 : 140;
const HEADER_COLLAPSED_HEIGHT = Platform.OS === 'ios' ? 90 : 110;

// --- Types ---
type Restaurant = {
  id: string;
  name: string;
  description: string;
  cuisine_type: string[] | string | null;
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
  restaurant_id: string;
};

const normalizeCuisineType = (cuisineType: any): string[] => {
  if (!cuisineType) return ['Food'];
  if (Array.isArray(cuisineType)) return cuisineType;
  if (typeof cuisineType === 'string') {
    return cuisineType.includes(',')
      ? cuisineType.split(',').map((item) => item.trim()).filter(Boolean)
      : [cuisineType];
  }
  return ['Food'];
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

  // Header shrinks on scroll
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [HEADER_EXPANDED_HEIGHT, HEADER_COLLAPSED_HEIGHT],
    extrapolate: 'clamp',
  });

  // --- Effects ---
  // Track if we've already kicked off the first fetch so we don't double-load
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Always attempt to load — use GPS coords if available, Johannesburg as fallback
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchAllData();
    }
  }, []);

  // Re-fetch when we get real location after initially loading with the fallback
  useEffect(() => {
    if (location && fetchedRef.current) {
      fetchAllData();
    }
  }, [location?.coords.latitude, location?.coords.longitude]);

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

  // --- Data Fetching ---
  const activeStatuses = ['accepted_by_driver', 'picked_up', 'on_the_way', 'arrived'];

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // Build parallel requests; only include location-based search when coords are available
      // Use real GPS if within South Africa region; fallback to Johannesburg for emulators (e.g. Mountain View US)
      let lat = location?.coords.latitude;
      let lng = location?.coords.longitude;
      if (lat == null || lng == null || lat > 0 || lng < 10 || lng > 40) {
        lat = -26.2041;
        lng = 28.0473;
      }

      const [feedResponse, searchResponse, ordersResponse] = await Promise.all([
        restaurantService.getHomeFeed(),
        restaurantService.searchRestaurants(lat, lng, { maxDistance: 10 }),
        orderService.getMyOrders(),
      ]);

      // The api interceptor returns response.data directly, so feedResponse IS the data object
      // It may have shape: { success: true, data: { menus: [], discounts: [] } }
      // OR an array of restaurants (for search endpoint)
      const feedData: any = feedResponse;

      // Build the nearby restaurants list first so we can filter discounts/menus
      let restaurantData: any[] = [];
      const searchData = Array.isArray(searchResponse)
        ? searchResponse
        : (searchResponse as any)?.restaurants ?? (searchResponse as any)?.data ?? null;
      if (searchData && Array.isArray(searchData)) {
        restaurantData = searchData;
      } else if (Array.isArray(feedData)) {
        // Some backends return a flat array for the search endpoint
        restaurantData = feedData;
      }

      // Ensure only restaurants strictly within delivery radius are displayed
      const normalizedRestaurants = restaurantData
        .filter((restaurant: any) => {
          if (restaurant.distance_meters != null && restaurant.delivery_radius_km != null) {
            return Number(restaurant.distance_meters) <= (Number(restaurant.delivery_radius_km) * 1000);
          }
          return true;
        })
        .map((restaurant: any) => ({
          ...restaurant,
          cuisine_type: normalizeCuisineType(restaurant.cuisine_type),
        }));

      setRestaurants(normalizedRestaurants);
      setPopularRestaurants(
        normalizedRestaurants.filter((r: any) => (r.total_ratings || 0) > 0).slice(0, 5)
      );

      // Filter menus and discounts to only show items from nearby restaurants
      const nearbyIds = new Set(normalizedRestaurants.map((r: any) => r.id));
      if (feedData && !Array.isArray(feedData) && feedData?.success) {
        const allMenus: MenuCategory[] = feedData.data?.menus || [];
        const allDiscounts: MenuItem[] = feedData.data?.discounts || [];
        setMenus(nearbyIds.size > 0 ? allMenus.filter((m) => nearbyIds.has(m.restaurant_id)) : allMenus);
        setDiscounts(nearbyIds.size > 0 ? allDiscounts.filter((d) => nearbyIds.has(d.restaurant_id)) : allDiscounts);
      } else if (feedData && !Array.isArray(feedData)) {
        // Try alternate shapes: feedData.menus / feedData.discounts
        const allMenus: MenuCategory[] = feedData.menus || [];
        const allDiscounts: MenuItem[] = feedData.discounts || [];
        setMenus(nearbyIds.size > 0 ? allMenus.filter((m) => nearbyIds.has(m.restaurant_id)) : allMenus);
        setDiscounts(nearbyIds.size > 0 ? allDiscounts.filter((d) => nearbyIds.has(d.restaurant_id)) : allDiscounts);
      }

      // ordersResponse is already response.data (interceptor strips the axios wrapper)
      // The shape could be { orders: [...] } or just an array
      const orderData: any[] = Array.isArray(ordersResponse)
        ? ordersResponse
        : (ordersResponse as any)?.orders ?? (ordersResponse as any)?.data ?? [];
      const active = orderData.filter((order: any) => activeStatuses.includes(order.status));
      setActiveOrders(active);
      setActiveOrder(active[0] || null);
    } catch (error) {
      console.error('[DATA FETCH] Critical Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await fetchAllData();
  };

  const handleCardPress = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(customer)/home/restaurant-details?id=${id}`);
  };

  // --- Render Helpers ---

  const renderCategory = ({ item, index }: { item: MenuCategory; index: number }) => {
    const translateY = floatingAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -5],
    });

    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { translateY }],
        }}
      >
        <TouchableOpacity
          style={styles.menuLink}
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(
              `/(customer)/home/restaurant-details?id=${item.restaurant_id}&category=${encodeURIComponent(
                item.name
              )}`
            );
          }}
        >
          <View style={styles.menuLinkIcon}>
            <MaterialCommunityIcons
              name={index % 3 === 0 ? 'food' : index % 3 === 1 ? 'food-variant' : 'food-turkey'}
              size={20}
              color={THEME.primary}
            />
          </View>
          <View style={styles.menuLinkTextContainer}>
            <Text style={styles.menuLinkText} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.menuLinkSubText} numberOfLines={1}>
              @ {item.restaurant_name}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={THEME.textLight} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderPopularCard = ({ item, index }: { item: Restaurant; index: number }) => {
    const translateY = floatingAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, index % 2 === 0 ? -3 : 3],
    });

    const cuisineArray = normalizeCuisineType(item.cuisine_type);

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
                <Text style={styles.ratingText}>
                  {item.average_rating ? item.average_rating.toFixed(1) : '4.5'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.likeButton}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <Ionicons name="heart" size={18} color="#FF4757" />
              </TouchableOpacity>
            </View>

            <View style={styles.timeBadge}>
              <Feather name="clock" size={12} color="#fff" />
              <Text style={styles.timeText}>{item.preparation_time_minutes} min</Text>
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
              {item.description}
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

  const renderDealCard = ({ item, index }: { item: MenuItem; index: number }) => {
    const discountPercent =
      item.discounted_price < item.price
        ? Math.round(((item.price - item.discounted_price) / item.price) * 100)
        : 0;

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
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.cubeGradient}
          />

          {discountPercent > 0 && (
            <View style={styles.cubeDiscountBadge}>
              <Text style={styles.cubeDiscountText}>-{discountPercent}%</Text>
            </View>
          )}

          <View style={styles.cubeContent}>
            <View style={styles.cubePriceTag}>
              <Text style={styles.cubePriceText}>R{item.discounted_price || item.price}</Text>
              {item.discounted_price < item.price && (
                <Text style={styles.cubeOldPrice}>R{item.price}</Text>
              )}
            </View>

            <Text style={styles.cubeTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.cubeRestaurant} numberOfLines={1}>
              {item.restaurant_name}
            </Text>

            <View style={styles.cubeActionButton}>
              <Feather name="shopping-cart" size={14} color="#fff" />
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const renderVerticalRestaurantCard = (item: Restaurant, index: number) => {
    const translateX = fadeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [20, 0],
    });

    const cuisineArray = normalizeCuisineType(item.cuisine_type);

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
        <TouchableOpacity activeOpacity={0.95} onPress={() => handleCardPress(item.id)}>
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
                colors={['transparent', 'rgba(0,0,0,0.3)']}
                style={styles.verticalImageGradient}
              />

              {item.average_rating && (
                <BlurView intensity={80} style={styles.verticalRatingBadge}>
                  <Ionicons name="star" size={12} color="#FFD700" />
                  <Text style={styles.verticalRatingText}>
                    {item.average_rating.toFixed(1)}
                  </Text>
                </BlurView>
              )}

              <TouchableOpacity
                style={styles.verticalLikeBtn}
                onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <BlurView intensity={80} style={StyleSheet.absoluteFill} />
                <Ionicons name="heart-outline" size={18} color="#fff" />
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
                {item.description}
              </Text>

              <View style={styles.verticalMetaContainer}>
                <View style={styles.verticalMetaItem}>
                  <Feather name="clock" size={14} color={THEME.textLight} />
                  <Text style={styles.verticalMetaText}>
                    {item.preparation_time_minutes} mins
                  </Text>
                </View>

                <View style={styles.verticalDivider} />

                <View style={styles.verticalMetaItem}>
                  <Feather name="truck" size={14} color={THEME.textLight} />
                  <Text style={styles.verticalMetaText}>Free delivery</Text>
                </View>
              </View>

              <View style={styles.verticalCuisineRow}>
                {cuisineArray.slice(0, 3).map((cuisine, idx) => (
                  <View key={idx} style={styles.verticalCuisineTag}>
                    <Text style={styles.verticalCuisineText}>{cuisine}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.verticalActionButton}>
                <Text style={styles.verticalActionText}>View Menu</Text>
                <Feather name="arrow-right" size={16} color={THEME.primary} />
              </TouchableOpacity>
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

          <Text style={styles.loadingBrandText}>Foodie</Text>
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
      <RNStatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* --- MINIMAL HEADER --- */}
      <Animated.View
        style={[
          styles.header,
          { height: headerHeight },
        ]}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTopRow}>
            <View style={styles.greetingContainer}>
              <Text style={styles.welcomeText}>
                Good{' '}
                {new Date().getHours() > 5 && new Date().getHours() < 12
                  ? 'Morning'
                  : 'Afternoon'}
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
              <Image
                source={{
                  uri: 'https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_640.png',
                }}
                style={styles.avatar}
              />
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
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          >
            <Image
              source={{
                uri: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80&auto=format&fit=crop',
              }}
              style={styles.bannerImage}
            />
            <LinearGradient
              colors={['rgba(0, 0, 0, 0)', 'rgb(0, 0, 0)']}
              style={styles.bannerGradient}
            />

            <View style={styles.bannerContent}>
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>NEW MENU</Text>
              </View>
              <Text style={styles.bannerTitle}>Explore curated menu picks</Text>
              <Text style={styles.bannerSubtitle}>
                Fresh dishes and trending favorites in one place
              </Text>

              <View style={styles.bannerButton}>
                <Text style={styles.bannerButtonText}>Browse menus</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Featured Menus */}
        {menus.length > 0 && (
          <View style={styles.section}>
            {/* <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Explore Menu Categories</Text>
              <TouchableOpacity onPress={() => router.push('/(customer)/search')}>
                <Text style={styles.seeAllText}>Browse all</Text>
              </TouchableOpacity>
            </View> */}
            <FlatList
              horizontal
              data={menus}
              renderItem={renderCategory}
              keyExtractor={(item) => `cat-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesList}
              decelerationRate="fast"
            />
          </View>
        )}

        {activeOrder && (
          <View style={styles.activeOrderSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Delivery</Text>
              <TouchableOpacity
                onPress={() =>
                  router.push(`/(customer)/orders/tracking?id=${activeOrder.id}`)
                }
              >
                <Text style={styles.seeAllText}>Track</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.activeOrderCard}
              activeOpacity={0.9}
              onPress={() =>
                router.push(`/(customer)/orders/tracking?id=${activeOrder.id}`)
              }
            >
              <View style={styles.activeOrderRow}>
                <View>
                  <Text style={styles.activeOrderLabel}>
                    {activeOrder.restaurant_name || 'Delivery in progress'}
                  </Text>
                  <Text style={styles.activeOrderSubLabel}>
                    {activeOrder.order_number ? `Order #${activeOrder.order_number}` : 'Open order'}
                  </Text>
                </View>
                <View style={styles.activeOrderBadge}>
                  <Text style={styles.activeOrderBadgeText}>
                    {activeOrder.status.replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
              <Text style={styles.activeOrderDetails} numberOfLines={1}>
                {activeOrders.length > 1
                  ? `${activeOrders.length} active deliveries in progress`
                  : 'Track your current order in real-time'}
              </Text>
              <Text style={styles.activeOrderDetails} numberOfLines={1}>
                Driver:{' '}
                {activeOrder.driver_first_name
                  ? `${activeOrder.driver_first_name} ${activeOrder.driver_last_name}`
                  : 'Assigning...'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Popular Restaurants */}
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
                <Feather name="chevron-right" size={16} color={THEME.primary} />
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={popularRestaurants}
              renderItem={renderPopularCard}
              keyExtractor={(item) => `pop-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              snapToInterval={CARD_WIDTH + 20}
              decelerationRate="fast"
            />
          </View>
        )}

        {/* Popular Menu Items */}
        {discounts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Popular Menu Items</Text>
                <Text style={styles.sectionSubtitle}>Tried-and-true favorites</Text>
              </View>
            </View>
            <FlatList
              horizontal
              data={discounts}
              renderItem={renderDealCard}
              keyExtractor={(item) => `deal-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              decelerationRate="fast"
            />
          </View>
        )}

        {/* Trending Deals */}
        {/* {discounts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Hot Deals</Text>
                <Text style={styles.sectionSubtitle}>Save big on favorites</Text>
              </View>
            </View>
            <FlatList
              horizontal
              data={discounts}
              renderItem={renderDealCard}
              keyExtractor={(item) => `deal-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              decelerationRate="fast"
            />
          </View>
        )} */}

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
              <Feather name="chevron-right" size={16} color={THEME.primary} />
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
                Try adjusting your location or search
              </Text>
            </View>
          )}
        </View>

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
    fontSize: 36,
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
  // --- FIXED SCROLL CONTENT ---
  scrollContent: {
    paddingTop: HEADER_EXPANDED_HEIGHT,
    paddingBottom: 100,
  },
  // --- MINIMAL HEADER STYLES ---
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
  bannerSection: {
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  bannerContainer: {
    height: 200,
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
    ...StyleSheet.absoluteFillObject,
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
    marginBottom: 12,
  },
  bannerBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 20,
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.secondary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: THEME.textLight,
    fontWeight: '500',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: THEME.primary,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  quickActionsSection: {
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  quickActionButton: {
    backgroundColor: '#fff',
    width: '48%',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  quickActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: THEME.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.secondary,
    lineHeight: 20,
  },
  activeOrderSection: {
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  activeOrderCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
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
    marginBottom: 12,
  },
  activeOrderLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.secondary,
  },
  activeOrderSubLabel: {
    fontSize: 13,
    color: THEME.textLight,
    marginTop: 4,
  },
  activeOrderBadge: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  activeOrderBadgeText: {
    color: '#fff',
    fontSize: 12,
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
    gap: 12,
  },
  menuLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    minWidth: 200,
  },
  menuLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: THEME.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuLinkTextContainer: {
    flex: 1,
  },
  menuLinkText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.secondary,
    marginBottom: 2,
  },
  menuLinkSubText: {
    fontSize: 12,
    color: THEME.textLight,
    fontWeight: '500',
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
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    color: THEME.primary,
    fontWeight: '600',
  },
  cubeContainer: {
    width: CUBE_SIZE,
    marginRight: 12,
  },
  cubeCard: {
    width: CUBE_SIZE,
    height: CUBE_SIZE * 1.3,
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cubeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  cubeDiscountBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FF4757',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  cubeDiscountText: {
    color: '#fff',
    fontSize: 11,
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
    marginBottom: 6,
  },
  cubePriceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginRight: 6,
  },
  cubeOldPrice: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
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
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 8,
  },
  cubeActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  verticalList: {
    paddingHorizontal: 24,
    gap: 24,
  },
  verticalCardContainer: {
    marginBottom: 8,
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
    height: 200,
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
    marginBottom: 16,
  },
  verticalMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
    marginHorizontal: 12,
  },
  verticalCuisineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  verticalCuisineTag: {
    backgroundColor: THEME.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  verticalCuisineText: {
    fontSize: 12,
    color: THEME.primary,
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
    color: THEME.primary,
    marginRight: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.secondary,
    marginTop: 16,
    marginBottom: 8,
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