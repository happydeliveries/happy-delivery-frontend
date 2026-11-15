import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { CART_CONFIG, STORAGE_KEYS } from '../constants/config';
import { cartService } from '../services/cart'; // We'll create this service next

export type CartItem = {
  id: string;
  menu_item_id: string;
  name: string;
  description?: string;
  price: number;
  discounted_price?: number;
  quantity: number;
  special_instructions?: string;
  selected_options?: Record<string, any>;
  image_url?: string;
  restaurant_id: string;
  restaurant_name: string;
  is_available: boolean;
};

export type CartState = {
  items: CartItem[];
  restaurant_id: string | null;
  restaurant_name: string | null;
  subtotal: number;
  delivery_fee: number;
  tax_amount: number;
  tip_amount: number;
  total_amount: number;
  last_updated: Date;
};

export const useCart = () => {
  const [cart, setCart] = useState<CartState>({
    items: [],
    restaurant_id: null,
    restaurant_name: null,
    subtotal: 0,
    delivery_fee: CART_CONFIG.DEFAULT_DELIVERY_FEE,
    tax_amount: 0,
    tip_amount: 0,
    total_amount: 0,
    last_updated: new Date(),
  });
  
  const [loading, setLoading] = useState(true);
  const [lastRestaurantWarning, setLastRestaurantWarning] = useState<string | null>(null);

  // Load cart from storage on mount
  useEffect(() => {
    loadCart();
  }, []);

  // Save cart to storage whenever it changes
  useEffect(() => {
    if (!loading) {
      saveCart();
      calculateTotals();
    }
  }, [cart.items, cart.restaurant_id, loading]);

  const loadCart = async () => {
    try {
      const savedCart = await AsyncStorage.getItem(STORAGE_KEYS.CART_DATA);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        // Convert date string back to Date object
        parsedCart.last_updated = new Date(parsedCart.last_updated);
        setCart(parsedCart);
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCart = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CART_DATA, JSON.stringify(cart));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const calculateTotals = useCallback(() => {
    const subtotal = cart.items.reduce(
      (sum, item) => sum + (item.discounted_price || item.price) * item.quantity,
      0
    );
    
    // Free delivery threshold
    const delivery_fee = subtotal >= CART_CONFIG.FREE_DELIVERY_THRESHOLD 
      ? 0 
      : CART_CONFIG.DEFAULT_DELIVERY_FEE;
    
    const tax_amount = subtotal * CART_CONFIG.TAX_RATE;
    const total_amount = subtotal + delivery_fee + tax_amount + cart.tip_amount;

    setCart(prev => ({
      ...prev,
      subtotal,
      delivery_fee,
      tax_amount,
      total_amount,
      last_updated: new Date(),
    }));
  }, [cart.items, cart.tip_amount]);

  const addItem = (item: Omit<CartItem, 'quantity'>, restaurantId: string, restaurantName: string) => {
    setCart(prev => {
      // Check if we're adding from a different restaurant
      if (prev.restaurant_id && prev.restaurant_id !== restaurantId) {
        Alert.alert(
          'Clear Cart?',
          `Your cart contains items from ${prev.restaurant_name}. Would you like to clear the cart and add items from ${restaurantName}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Clear & Add', 
              onPress: () => {
                const newItem = { ...item, quantity: 1 };
                const newCart: CartState = {
                  items: [newItem],
                  restaurant_id: restaurantId,
                  restaurant_name: restaurantName,
                  subtotal: (item.discounted_price || item.price),
                  delivery_fee: CART_CONFIG.DEFAULT_DELIVERY_FEE,
                  tax_amount: 0,
                  tip_amount: 0,
                  total_amount: 0,
                  last_updated: new Date(),
                };
                setCart(newCart);
              }
            }
          ]
        );
        return prev;
      }

      // Check if item already exists
      const existingItemIndex = prev.items.findIndex(
        i => i.menu_item_id === item.menu_item_id && 
        JSON.stringify(i.selected_options) === JSON.stringify(item.selected_options)
      );

      let newItems: CartItem[];
      if (existingItemIndex !== -1) {
        // Update quantity
        newItems = [...prev.items];
        const newQuantity = newItems[existingItemIndex].quantity + 1;
        
        // Check max quantity
        if (newQuantity > CART_CONFIG.MAX_QUANTITY_PER_ITEM) {
          Alert.alert(
            'Maximum Quantity',
            `You can only add up to ${CART_CONFIG.MAX_QUANTITY_PER_ITEM} of this item.`
          );
          return prev;
        }
        
        newItems[existingItemIndex] = {
          ...newItems[existingItemIndex],
          quantity: newQuantity,
        };
      } else {
        // Add new item
        newItems = [...prev.items, { ...item, quantity: 1 }];
      }

      const newCart: CartState = {
        ...prev,
        items: newItems,
        restaurant_id: restaurantId,
        restaurant_name: restaurantName,
        last_updated: new Date(),
      };

      return newCart;
    });
  };

  const removeItem = (menuItemId: string, selectedOptions?: Record<string, any>) => {
    setCart(prev => {
      const newItems = prev.items.filter(item => 
        !(item.menu_item_id === menuItemId && 
          JSON.stringify(item.selected_options) === JSON.stringify(selectedOptions))
      );
      
      // If cart is empty, clear restaurant info
      const newRestaurantId = newItems.length === 0 ? null : prev.restaurant_id;
      const newRestaurantName = newItems.length === 0 ? null : prev.restaurant_name;

      return {
        ...prev,
        items: newItems,
        restaurant_id: newRestaurantId,
        restaurant_name: newRestaurantName,
        last_updated: new Date(),
      };
    });
  };

  const updateQuantity = (menuItemId: string, quantity: number, selectedOptions?: Record<string, any>) => {
    if (quantity < 1) {
      removeItem(menuItemId, selectedOptions);
      return;
    }

    if (quantity > CART_CONFIG.MAX_QUANTITY_PER_ITEM) {
      Alert.alert(
        'Maximum Quantity',
        `You can only add up to ${CART_CONFIG.MAX_QUANTITY_PER_ITEM} of this item.`
      );
      return;
    }

    setCart(prev => {
      const newItems = prev.items.map(item => {
        if (item.menu_item_id === menuItemId && 
            JSON.stringify(item.selected_options) === JSON.stringify(selectedOptions)) {
          return { ...item, quantity };
        }
        return item;
      });

      return {
        ...prev,
        items: newItems,
        last_updated: new Date(),
      };
    });
  };

  const updateItemInstructions = (menuItemId: string, instructions: string, selectedOptions?: Record<string, any>) => {
    setCart(prev => {
      const newItems = prev.items.map(item => {
        if (item.menu_item_id === menuItemId && 
            JSON.stringify(item.selected_options) === JSON.stringify(selectedOptions)) {
          return { ...item, special_instructions: instructions };
        }
        return item;
      });

      return {
        ...prev,
        items: newItems,
        last_updated: new Date(),
      };
    });
  };

  const updateTip = (tipAmount: number) => {
    setCart(prev => ({
      ...prev,
      tip_amount: tipAmount,
      last_updated: new Date(),
    }));
  };

  const clearCart = () => {
    setCart({
      items: [],
      restaurant_id: null,
      restaurant_name: null,
      subtotal: 0,
      delivery_fee: CART_CONFIG.DEFAULT_DELIVERY_FEE,
      tax_amount: 0,
      tip_amount: 0,
      total_amount: 0,
      last_updated: new Date(),
    });
  };

  const validateCart = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (cart.items.length === 0) {
      errors.push('Cart is empty');
    }

    if (!cart.restaurant_id) {
      errors.push('No restaurant selected');
    }

    // Check minimum order amount
    if (cart.subtotal < CART_CONFIG.MIN_ORDER_AMOUNT) {
      errors.push(`Minimum order amount is R${CART_CONFIG.MIN_ORDER_AMOUNT.toFixed(2)}`);
    }

    // Check maximum order amount
    if (cart.subtotal > CART_CONFIG.MAX_ORDER_AMOUNT) {
      errors.push(`Maximum order amount is R${CART_CONFIG.MAX_ORDER_AMOUNT.toFixed(2)}`);
    }

    // Check item availability
    const unavailableItems = cart.items.filter(item => !item.is_available);
    if (unavailableItems.length > 0) {
      errors.push(`Some items are no longer available`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  return {
    cart,
    cartItemCount: cart.items.reduce((total, item) => total + item.quantity, 0),
    loading,
    addItem,
    removeItem,
    updateQuantity,
    updateItemInstructions,
    updateTip,
    clearCart,
    validateCart,
    calculateTotals,
  };
};

// Optional: Create a CartContext if you want to use it globally
import { createContext, useContext, ReactNode } from 'react';

const CartContext = createContext<ReturnType<typeof useCart> | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const cart = useCart();
  
  return (
    <CartContext.Provider value={cart}>
      {children}
    </CartContext.Provider>
  );
};

export const useCartContext = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCartContext must be used within a CartProvider');
  }
  return context;
};