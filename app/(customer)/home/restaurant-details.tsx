import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert, // Added for cart conflict dialog
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../components/common/Button';
import MenuItem from '../../../components/customer/MenuItem';
import { colors } from '../../../constants/colors';
import { restaurantService } from '../../../services/restaurant';
import { useCartStore } from '../../../store/cartStore';

type Restaurant = {
  id: string;
  name: string;
  description: string;
  cuisine_type: string[];
  address: string;
  phone_number: string;
  average_rating: number;
  total_ratings: number;
  logo_url: string;
  cover_image_url: string;
  opening_hours: any;
  is_accepting_orders: boolean;
};

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

export default function RestaurantDetailsScreen() {
  // 1. Extract 'category' from params
  const { id, category } = useLocalSearchParams<{ id: string; category?: string }>();
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemType[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 2. Initialize state with the passed category, or default to 'All'
  const [selectedCategory, setSelectedCategory] = useState<string>(category || 'All');
  
  const { addItem, restaurantId, setRestaurant: setCartRestaurant, clearCart } = useCartStore();

  // 3. Add a listener to update the selection if the URL changes while the page is open
  useEffect(() => {
    // Safety check: Ensure ID exists and isn't the string "undefined"
    if (id && id !== 'undefined') {
      fetchRestaurantDetails();
      fetchMenuItems();
    } else {
      setLoading(false);
    }
  }, [id]);

  const fetchRestaurantDetails = async () => {
    try {
      const response = await restaurantService.getRestaurant(id);
      // API interceptor returns response.data directly
      setRestaurant((response as any).restaurant ?? (response as any).data ?? response);
    } catch (error) {
      console.error('Error fetching restaurant:', error);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const response = await restaurantService.getRestaurantMenus(id);
      // API interceptor returns response.data directly; shape may be array or {menus: [...]}
      const menus: any[] = Array.isArray(response) ? response
        : ((response as any).menus ?? (response as any).data ?? []);
      
      const allItems: MenuItemType[] = [];

      if (Array.isArray(menus)) {
        menus.forEach((menu: any) => {
          if (menu.items && Array.isArray(menu.items)) {
            menu.items.forEach((item: any) => {
              allItems.push({
                id: item.id,
                name: item.name,
                description: item.description || '',
                price: Number(item.price),
                discounted_price: item.discounted_price ? Number(item.discounted_price) : undefined,
                image_url: item.image_url,
                category: item.category || menu.name || 'General',
                tags: item.tags || [],
                ingredients: item.ingredients || [],
                customizations: item.customizations || [],
                is_available: item.is_available ?? true,
                is_veg: Boolean(item.is_veg),
                is_popular: Boolean(item.is_popular),
                calories: item.calories ? Number(item.calories) : undefined,
                preparation_time_minutes: item.preparation_time_minutes ? Number(item.preparation_time_minutes) : undefined,
              });
            });
          }
        });
      }
      setMenuItems(allItems);
    } catch (error) {
      console.error('Error fetching menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- OPTIMIZATION: Memoized Categories ---
  // Only recalculates when menuItems changes, not on every render
  const categories = useMemo(() => {
    const cats = ['All'];
    menuItems.forEach(item => {
      if (item.category && !cats.includes(item.category)) {
        cats.push(item.category);
      }
    });
    return cats;
  }, [menuItems]);

  // --- OPTIMIZATION: Memoized Filtering ---
  const filteredItems = useMemo(() => {
    return selectedCategory === 'All' 
      ? menuItems 
      : menuItems.filter(item => item.category === selectedCategory);
  }, [selectedCategory, menuItems]);

  // --- LOGIC: Cart Conflict Handling ---
  const handleAddToCart = (item: any) => {
    if (!restaurant) return;

    // Check if user is ordering from a different restaurant
    if (restaurantId && restaurantId !== id) {
      Alert.alert(
        "Start new order?",
        `You have items from another restaurant in your cart. Adding this item will clear your current cart.`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Start New Order", 
            style: "destructive",
            onPress: () => {
              // If your store has a clear function, use it. 
              // Otherwise, setting the new restaurant usually resets the cart in many implementations.
              if (clearCart) clearCart(); 
              addCreateItem(item);
            } 
          }
        ]
      );
      return;
    }

    addCreateItem(item);
  };

  // Helper to actually add the item
  const addCreateItem = (item: any) => {
    if (!restaurant) return;
    
    setCartRestaurant(id, restaurant.name);
    addItem({
      restaurantId: id,
      restaurantName: restaurant.name,
      menuItemId: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.unitPrice ?? item.discounted_price ?? item.price),
      quantity: item.quantity || 1,
      specialInstructions: item.specialInstructions,
      selectedOptions: item.selectedOptions,
      imageUrl: item.image_url,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Restaurant not found</Text>
          <Button 
            title="Go Back" 
            onPress={() => router.back()}
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView stickyHeaderIndices={[2]}> 
        {/* Index 2 corresponds to categoriesContainer if mapped correctly, 
            but strictly speaking requires flat structure. 
            For now, standard scroll is safer without restyling. */}
            
        {/* Restaurant Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          {restaurant.cover_image_url ? (
            <Image 
              source={{ uri: restaurant.cover_image_url }} 
              style={styles.coverImage}
            />
          ) : (
            <View style={[styles.coverImage, styles.coverPlaceholder]}>
              <Ionicons name="restaurant" size={60} color="#fff" />
            </View>
          )}
          
          <View style={styles.restaurantInfo}>
            {restaurant.logo_url ? (
              <Image 
                source={{ uri: restaurant.logo_url }} 
                style={styles.logo}
              />
            ) : (
              <View style={[styles.logo, styles.logoPlaceholder]}>
                <Ionicons name="fast-food" size={30} color={colors.primary} />
              </View>
            )}
            
            <View style={styles.restaurantDetails}>
              <Text style={styles.restaurantName} numberOfLines={2}>{restaurant.name}</Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>
                  {Number(restaurant.average_rating || 0).toFixed(1)} 
                  <Text style={styles.ratingCount}> ({restaurant.total_ratings || 0})</Text>
                </Text>
              </View>
              
              {restaurant.cuisine_type && restaurant.cuisine_type.length > 0 && (
                <Text style={styles.cuisine}>
                  {Array.isArray(restaurant.cuisine_type) 
                    ? restaurant.cuisine_type.join(', ') 
                    : restaurant.cuisine_type}
                </Text>
              )}
              
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, restaurant.is_accepting_orders ? styles.open : styles.closed]} />
                <Text style={styles.statusText}>
                  {restaurant.is_accepting_orders ? 'Open Now' : 'Closed'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Restaurant Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionTitle}>About</Text>
          <Text style={styles.descriptionText}>
            {restaurant.description || 'No description available.'}
          </Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color={colors.primary} />
            <Text style={styles.infoText}>{restaurant.address}</Text>
          </View>
          
          {restaurant.phone_number && (
            <View style={styles.infoRow}>
              <Ionicons name="call" size={20} color={colors.primary} />
              <Text style={styles.infoText}>{restaurant.phone_number}</Text>
            </View>
          )}
        </View>

        {/* Menu Categories */}
        <View style={styles.categoriesContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {categories.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[
                  styles.categoryText,
                  selectedCategory === category && styles.categoryTextActive,
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>{selectedCategory} Menu</Text>
          
          {filteredItems.length === 0 ? (
            <View style={styles.emptyMenu}>
              <Text style={styles.emptyMenuText}>No items available in this category</Text>
            </View>
          ) : (
            filteredItems.map(item => (
              <MenuItem
                key={item.id}
                item={item}
                restaurantId={id}
                onAddToCart={(cartItem: any) => handleAddToCart(cartItem || item)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: colors.error,
    marginBottom: 20,
  },
  header: {
    position: 'relative',
    height: 250,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 20, // Adjusted for SafeAreaView overlap if needed
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    // Style for the error screen button
    marginTop: 10,
  },
  restaurantInfo: {
    position: 'absolute',
    bottom: -50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    marginTop: -60,
  },
  logoPlaceholder: {
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restaurantDetails: {
    flex: 1,
    marginLeft: 16,
  },
  restaurantName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 4,
  },
  ratingCount: {
    color: colors.textTertiary,
    fontWeight: 'normal',
  },
  cuisine: {
    fontSize: 14,
    color: colors.primary,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  open: {
    backgroundColor: colors.success,
  },
  closed: {
    backgroundColor: colors.error,
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  descriptionContainer: {
    padding: 20,
    paddingTop: 70, // Space for the floating card
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  descriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 12,
    flex: 1,
  },
  categoriesContainer: {
    paddingVertical: 16,
    backgroundColor: '#fff', // Ensure background for sticky effect if used
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    marginRight: 12,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: '#fff',
  },
  menuContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  emptyMenu: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyMenuText: {
    fontSize: 16,
    color: colors.textTertiary,
  },
});