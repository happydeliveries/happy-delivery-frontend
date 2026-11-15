import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import Button from '../../../components/common/Button';
import {
  normalizeCustomizations,
  NormalizedCustomizationGroup,
  NormalizedOptionChoice,
} from '../../../components/customer/MenuItem';
import { colors } from '../../../constants/colors';
import { restaurantService } from '../../../services/restaurant';
import { useCartStore } from '../../../store/cartStore';

type MenuItemType = {
  id: string;
  name: string;
  description: string;
  price: number;
  discounted_price?: number;
  image_url?: string;
  category: string;
  tags: string[];
  ingredients: any[];
  customizations: any[];
  is_available: boolean;
  is_veg?: boolean;
  is_popular?: boolean;
  calories?: number;
  preparation_time_minutes?: number;
};

type Restaurant = {
  id: string;
  name: string;
  logo_url?: string;
  address?: string;
  average_rating?: number;
  total_ratings?: number;
};

const HEADER_HEIGHT = 60;

export default function MenuItemDetailScreen() {
  const { id, restaurantId } = useLocalSearchParams<{ id: string; restaurantId: string }>();
  const [menuItem, setMenuItem] = useState<MenuItemType | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedCustomizations, setSelectedCustomizations] = useState<
    Record<string, NormalizedOptionChoice[]>
  >({});

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { addItem, setRestaurant: setCartRestaurant, restaurantId: cartRestaurantId, clearCart } = useCartStore();

  // --- Effects ---
  useEffect(() => {
    if (id && restaurantId) {
      fetchMenuItemDetails();
      fetchRestaurantDetails();
    } else {
      setLoading(false);
    }
  }, [id, restaurantId]);

  useEffect(() => {
    if (!loading) {
      Animated.spring(fadeAnim, {
        toValue: 1,
        tension: 20,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  // --- Data Fetching ---
  const fetchMenuItemDetails = async () => {
    try {
      const response = await restaurantService.getMenuItemDetail(restaurantId, id);
      const data = (response as any)?.item ?? (response as any)?.data ?? response;
      setMenuItem({
        id: data.id,
        name: data.name,
        description: data.description || '',
        price: Number(data.price),
        discounted_price: data.discounted_price ? Number(data.discounted_price) : undefined,
        image_url: data.image_url,
        category: data.category || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        customizations: data.customizations || [],
        is_available: data.is_available ?? true,
        is_veg: Boolean(data.is_veg),
        is_popular: Boolean(data.is_popular),
        calories: data.calories ? Number(data.calories) : undefined,
        preparation_time_minutes: data.preparation_time_minutes
          ? Number(data.preparation_time_minutes)
          : undefined,
      });
    } catch (error) {
      console.error('Error fetching menu item details:', error);
      Alert.alert('Error', 'Failed to load menu item details');
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantDetails = async () => {
    try {
      const response = await restaurantService.getRestaurant(restaurantId);
      setRestaurant((response as any)?.restaurant ?? (response as any)?.data ?? response);
    } catch (error) {
      console.error('Error fetching restaurant details:', error);
    }
  };

  const customizationGroups = useMemo(
    () => normalizeCustomizations(menuItem?.customizations),
    [menuItem?.customizations]
  );

  const basePrice = useMemo(() => {
    if (!menuItem) return 0;
    return menuItem.discounted_price && menuItem.discounted_price < menuItem.price
      ? menuItem.discounted_price
      : menuItem.price;
  }, [menuItem]);

  const extraOptionsPrice = useMemo(() => {
    let sum = 0;
    Object.values(selectedCustomizations).forEach((choices) => {
      if (Array.isArray(choices)) {
        choices.forEach((c) => {
          sum += Number(c.price || 0);
        });
      }
    });
    return sum;
  }, [selectedCustomizations]);

  const unitPrice = basePrice + extraOptionsPrice;

  const handleToggleOption = (
    group: NormalizedCustomizationGroup,
    choice: NormalizedOptionChoice
  ) => {
    setSelectedCustomizations((prev) => {
      const current = prev[group.name] || [];
      const exists = current.some((c) => c.name === choice.name);

      if (group.type === 'single') {
        if (exists && !group.required) {
          const next = { ...prev };
          delete next[group.name];
          return next;
        }
        return {
          ...prev,
          [group.name]: [choice],
        };
      } else {
        if (exists) {
          const filtered = current.filter((c) => c.name !== choice.name);
          const next = { ...prev };
          if (filtered.length > 0) {
            next[group.name] = filtered;
          } else {
            delete next[group.name];
          }
          return next;
        } else {
          if (current.length >= group.max_select) {
            Alert.alert(
              'Maximum Reached',
              `You can select up to ${group.max_select} option${group.max_select > 1 ? 's' : ''} for "${group.name}".`
            );
            return prev;
          }
          return {
            ...prev,
            [group.name]: [...current, choice],
          };
        }
      }
    });
  };

  // --- Cart Handling ---
  const handleAddToCart = () => {
    if (!menuItem || !restaurant) return;

    // Validate required option groups
    for (const group of customizationGroups) {
      const picked = selectedCustomizations[group.name] || [];
      if (group.required && picked.length === 0) {
        Alert.alert(
          'Required Selection',
          `Please choose an option for "${group.name}".`
        );
        return;
      }
    }

    // Check if user is ordering from a different restaurant
    if (cartRestaurantId && cartRestaurantId !== restaurantId) {
      Alert.alert(
        'Start new order?',
        `You have items from another restaurant in your cart. Adding this item will clear your current cart.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start New Order',
            style: 'destructive',
            onPress: () => {
              if (clearCart) clearCart();
              addItemToCart();
            },
          },
        ]
      );
      return;
    }

    addItemToCart();
  };

  const addItemToCart = () => {
    if (!menuItem || !restaurant) return;

    setCartRestaurant(restaurantId, restaurant.name);
    addItem({
      restaurantId,
      restaurantName: restaurant.name,
      menuItemId: menuItem.id,
      name: menuItem.name,
      description: menuItem.description,
      price: unitPrice,
      quantity,
      imageUrl: menuItem.image_url,
      specialInstructions: specialInstructions.trim(),
      selectedOptions: selectedCustomizations,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success', 'Item added to cart!', [
      {
        text: 'Continue Shopping',
        onPress: () => router.back(),
      },
      {
        text: 'Go to Cart',
        onPress: () => router.push('/(customer)/cart'),
      },
    ]);
  };

  // --- Render Helpers ---
  const handleIncrement = () => setQuantity((prev) => prev + 1);
  const handleDecrement = () => setQuantity((prev) => (prev > 1 ? prev - 1 : 1));

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-50, 0, 100],
    outputRange: [1.2, 1, 0.95],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!menuItem) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Menu item not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const discountPercent =
    menuItem.discounted_price && menuItem.discounted_price < menuItem.price
      ? Math.round(
          ((menuItem.price - menuItem.discounted_price) / menuItem.price) * 100
        )
      : 0;

  // Normalize restaurant rating to a number to avoid runtime errors
  const ratingValue =
    restaurant && restaurant.average_rating != null
      ? Number(restaurant.average_rating)
      : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {menuItem.name}
        </Text>
        <View style={styles.headerPlaceholder} />
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image Section */}
        <Animated.View
          style={[
            styles.imageContainer,
            { transform: [{ scale: imageScale }] },
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <View style={styles.backButtonBg}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </View>
          </TouchableOpacity>

          <Image
            source={{
              uri:
                menuItem.image_url ||
                'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80&auto=format&fit=crop',
            }}
            style={styles.image}
          />

          {/* Discount Badge */}
          {discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
            </View>
          )}

          {!menuItem.is_available && (
            <View style={styles.unavailableBadge}>
              <Text style={styles.unavailableText}>Currently Unavailable</Text>
            </View>
          )}
        </Animated.View>

        {/* Content Section */}
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          {/* Header Info */}
          <View style={styles.headerInfo}>
            <View style={styles.metaBadgesRow}>
              {menuItem.is_veg && (
                <View style={styles.vegPill}>
                  <Ionicons name="leaf" size={12} color="#166534" />
                  <Text style={styles.vegPillText}>Vegetarian</Text>
                </View>
              )}
              {menuItem.is_popular && (
                <View style={styles.popularPill}>
                  <Ionicons name="flame" size={12} color="#9a3412" />
                  <Text style={styles.popularPillText}>Popular</Text>
                </View>
              )}
              {!!menuItem.preparation_time_minutes && (
                <View style={styles.metaInfoPill}>
                  <Ionicons name="time-outline" size={13} color="#475569" />
                  <Text style={styles.metaInfoPillText}>
                    {menuItem.preparation_time_minutes} min
                  </Text>
                </View>
              )}
              {!!menuItem.calories && (
                <View style={styles.metaInfoPill}>
                  <Ionicons name="flame-outline" size={13} color="#475569" />
                  <Text style={styles.metaInfoPillText}>{menuItem.calories} kcal</Text>
                </View>
              )}
            </View>

            <View style={styles.titleSection}>
              <Text style={styles.title}>{menuItem.name}</Text>
              {menuItem.discounted_price && menuItem.discounted_price < menuItem.price ? (
                <View style={styles.priceSection}>
                  <Text style={styles.originalPrice}>R{menuItem.price.toFixed(2)}</Text>
                  <Text style={styles.price}>R{basePrice.toFixed(2)}</Text>
                </View>
              ) : (
                <Text style={styles.price}>R{basePrice.toFixed(2)}</Text>
              )}
            </View>

            {/* Rating if available */}
            {ratingValue != null && !Number.isNaN(ratingValue) && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>{ratingValue.toFixed(1)}</Text>
                <Text style={styles.ratingsCount}>
                  ({restaurant?.total_ratings || 0} reviews)
                </Text>
              </View>
            )}
          </View>

          {/* Restaurant Info */}
          {restaurant && (
            <TouchableOpacity
              style={styles.restaurantCard}
              onPress={() =>
                router.push(`/(customer)/home/restaurant-details?id=${restaurantId}`)
              }
            >
              {restaurant.logo_url && (
                <Image
                  source={{ uri: restaurant.logo_url }}
                  style={styles.restaurantLogo}
                />
              )}
              <View style={styles.restaurantInfo}>
                <Text style={styles.restaurantName}>{restaurant.name}</Text>
                {restaurant.address && (
                  <Text style={styles.restaurantAddress} numberOfLines={1}>
                    {restaurant.address}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray} />
            </TouchableOpacity>
          )}

          {/* Description */}
          {!!menuItem.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{menuItem.description}</Text>
            </View>
          )}

          {/* Customizations & Option Groups */}
          {customizationGroups.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customize Your Item</Text>
              {customizationGroups.map((group) => {
                const pickedList = selectedCustomizations[group.name] || [];
                return (
                  <View key={group.id} style={styles.custGroupCard}>
                    <View style={styles.custGroupHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.custGroupTitle}>{group.name}</Text>
                        <Text style={styles.custGroupSub}>
                          {group.type === 'multiple'
                            ? `Choose up to ${group.max_select}`
                            : 'Select 1 option'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.reqBadge,
                          group.required
                            ? styles.reqBadgeRequired
                            : styles.reqBadgeOptional,
                        ]}
                      >
                        <Text
                          style={[
                            styles.reqBadgeText,
                            group.required
                              ? styles.reqBadgeTextRequired
                              : styles.reqBadgeTextOptional,
                          ]}
                        >
                          {group.required ? 'Required' : 'Optional'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.custOptionsList}>
                      {group.options.map((choice) => {
                        const isSelected = pickedList.some(
                          (c) => c.name === choice.name
                        );
                        return (
                          <TouchableOpacity
                            key={choice.id}
                            style={[
                              styles.custOptionRow,
                              isSelected && styles.custOptionRowSelected,
                            ]}
                            onPress={() => handleToggleOption(group, choice)}
                          >
                            <View style={styles.custOptionLeft}>
                              <Ionicons
                                name={
                                  group.type === 'multiple'
                                    ? isSelected
                                      ? 'checkbox'
                                      : 'square-outline'
                                    : isSelected
                                    ? 'radio-button-on'
                                    : 'radio-button-off'
                                }
                                size={20}
                                color={isSelected ? colors.primary : colors.gray400}
                              />
                              <Text
                                style={[
                                  styles.custOptionName,
                                  isSelected && styles.custOptionNameSelected,
                                ]}
                              >
                                {choice.name}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.custOptionPrice,
                                isSelected && styles.custOptionNameSelected,
                              ]}
                            >
                              {choice.price > 0
                                ? `+R${choice.price.toFixed(2)}`
                                : 'Free'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Ingredients */}
          {menuItem.ingredients && menuItem.ingredients.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <View style={styles.ingredientsList}>
                {menuItem.ingredients.map((ingredient, index) => (
                  <View key={index} style={styles.ingredientTag}>
                    <Text style={styles.ingredientText}>{ingredient}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Tags */}
          {menuItem.tags && menuItem.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagsList}>
                {menuItem.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Special Instructions (Cross-Platform TextInput) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <TextInput
              style={styles.instructionsInput}
              placeholder="Add any special requests (e.g., extra sauce, no onions)..."
              placeholderTextColor="#999"
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              multiline
              maxLength={250}
            />
          </View>

          {/* Quantity Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quantity</Text>
            <View style={styles.quantitySelector}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={handleDecrement}
              >
                <Ionicons name="remove" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={handleIncrement}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.spacer} />
        </Animated.View>
      </Animated.ScrollView>

      {/* Floating Action Button */}
      <View style={styles.bottomContainer}>
        <View style={styles.totalContainer}>
          <View>
            <Text style={styles.totalLabel}>Total:</Text>
            {extraOptionsPrice > 0 && (
              <Text style={styles.extraOptionsHint}>
                Includes +R{extraOptionsPrice.toFixed(2)} in options
              </Text>
            )}
          </View>
          <Text style={styles.totalPrice}>
            R{(unitPrice * quantity).toFixed(2)}
          </Text>
        </View>
        <Button
          title={
            menuItem.is_available
              ? `Add to Cart • R${(unitPrice * quantity).toFixed(2)}`
              : 'Not Available'
          }
          onPress={handleAddToCart}
          disabled={!menuItem.is_available}
          style={styles.addButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    height: HEADER_HEIGHT,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerBackButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    marginTop: HEADER_HEIGHT,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 320,
    backgroundColor: '#f5f5f5',
    marginBottom: 20,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 5,
  },
  backButtonBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FF4757',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  discountBadgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  unavailableBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  unavailableText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 16,
  },
  headerInfo: {
    marginBottom: 16,
  },
  metaBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  vegPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  vegPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  popularPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffedd5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  popularPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9a3412',
  },
  metaInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  metaInfoPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  titleSection: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    textDecorationLine: 'line-through',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFD700',
  },
  ratingsCount: {
    fontSize: 12,
    color: '#666',
  },
  restaurantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  restaurantLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  restaurantAddress: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  custGroupCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  custGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  custGroupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  custGroupSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  reqBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  reqBadgeRequired: {
    backgroundColor: '#fef3c7',
  },
  reqBadgeOptional: {
    backgroundColor: '#e5e7eb',
  },
  reqBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reqBadgeTextRequired: {
    color: '#92400e',
  },
  reqBadgeTextOptional: {
    color: '#4b5563',
  },
  custOptionsList: {
    gap: 8,
  },
  custOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  custOptionRowSelected: {
    borderColor: colors.primary,
    backgroundColor: '#f0fdf4',
  },
  custOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  custOptionName: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  custOptionNameSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  custOptionPrice: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  ingredientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingredientTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  ingredientText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  tagsList: {
    gap: 10,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 14,
    color: '#333',
  },
  instructionsInput: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    minHeight: 76,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#111827',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    paddingVertical: 12,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    minWidth: 40,
    textAlign: 'center',
  },
  spacer: {
    height: 120,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  extraOptionsHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  addButton: {
    height: 48,
    borderRadius: 8,
  },
});
