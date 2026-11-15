import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, ReactNode } from 'react';

type CartItem = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  menuItemId: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  specialInstructions?: string;
  selectedOptions?: Record<string, any>;
  allergenNotes?: string;
};

type CartStore = {
  items: CartItem[];
  restaurantId?: string;
  restaurantName?: string;
  total: {
    subtotal: number;
    deliveryFee: number;
    tax: number;
    total: number;
  };
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (menuItemId: string, selectedOptions?: Record<string, any>) => void;
  updateQuantity: (menuItemId: string, quantity: number, selectedOptions?: Record<string, any>) => void;
  clearCart: () => void;
  setRestaurant: (restaurantId: string, restaurantName: string) => void;
  calculateTotals: () => void;
};

const calculateItemId = (item: Omit<CartItem, 'id'>) => {
  return `${item.menuItemId}-${JSON.stringify(item.selectedOptions || {})}`;
};

const calculateDeliveryFee = (subtotal: number) => {
  if (subtotal === 0) return 0;
  if (subtotal > 25) return 0; // Free delivery over $25
  return 3.99;
};

const calculateTax = (subtotal: number) => {
  return subtotal * 0.08; // 8% tax
};

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      total: {
        subtotal: 0,
        deliveryFee: 0,
        tax: 0,
        total: 0,
      },
      
      addItem: (itemData) => {
        const itemId = calculateItemId(itemData);
        const state = get();
        
        // Check if we're adding from a different restaurant
        if (state.restaurantId && state.restaurantId !== itemData.restaurantId) {
          // Clear cart if adding from different restaurant
          set({
            items: [],
            restaurantId: itemData.restaurantId,
            restaurantName: itemData.restaurantName,
          });
        }
        
        set((state) => {
          const existingItemIndex = state.items.findIndex(
            (item) => calculateItemId(item) === itemId
          );
          
          if (existingItemIndex >= 0) {
            // Update quantity of existing item
            const updatedItems = [...state.items];
            updatedItems[existingItemIndex].quantity += itemData.quantity;
            
            const subtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const deliveryFee = calculateDeliveryFee(subtotal);
            const tax = calculateTax(subtotal);
            
            return {
              items: updatedItems,
              restaurantId: itemData.restaurantId,
              restaurantName: itemData.restaurantName,
              total: {
                subtotal,
                deliveryFee,
                tax,
                total: subtotal + deliveryFee + tax,
              },
            };
          } else {
            // Add new item
            const newItem = {
              ...itemData,
              id: itemId,
            };
            
            const updatedItems = [...state.items, newItem];
            const subtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const deliveryFee = calculateDeliveryFee(subtotal);
            const tax = calculateTax(subtotal);
            
            return {
              items: updatedItems,
              restaurantId: itemData.restaurantId,
              restaurantName: itemData.restaurantName,
              total: {
                subtotal,
                deliveryFee,
                tax,
                total: subtotal + deliveryFee + tax,
              },
            };
          }
        });
      },
      
      removeItem: (menuItemId, selectedOptions = {}) => {
        const itemId = `${menuItemId}-${JSON.stringify(selectedOptions)}`;
        
        set((state) => {
          const updatedItems = state.items.filter((item) => calculateItemId(item) !== itemId);
          
          const subtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const deliveryFee = calculateDeliveryFee(subtotal);
          const tax = calculateTax(subtotal);
          
          return {
            items: updatedItems,
            total: {
              subtotal,
              deliveryFee,
              tax,
              total: subtotal + deliveryFee + tax,
            },
          };
        });
      },
      
      updateQuantity: (menuItemId, quantity, selectedOptions = {}) => {
        const itemId = `${menuItemId}-${JSON.stringify(selectedOptions)}`;
        
        if (quantity <= 0) {
          get().removeItem(menuItemId, selectedOptions);
          return;
        }
        
        set((state) => {
          const updatedItems = state.items.map((item) =>
            calculateItemId(item) === itemId ? { ...item, quantity } : item
          );
          
          const subtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const deliveryFee = calculateDeliveryFee(subtotal);
          const tax = calculateTax(subtotal);
          
          return {
            items: updatedItems,
            total: {
              subtotal,
              deliveryFee,
              tax,
              total: subtotal + deliveryFee + tax,
            },
          };
        });
      },
      
      clearCart: () => {
        set({
          items: [],
          restaurantId: undefined,
          restaurantName: undefined,
          total: {
            subtotal: 0,
            deliveryFee: 0,
            tax: 0,
            total: 0,
          },
        });
      },
      
      setRestaurant: (restaurantId, restaurantName) => {
        set({ restaurantId, restaurantName });
      },
      
      calculateTotals: () => {
        const state = get();
        const subtotal = state.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const deliveryFee = calculateDeliveryFee(subtotal);
        const tax = calculateTax(subtotal);
        
        set({
          total: {
            subtotal,
            deliveryFee,
            tax,
            total: subtotal + deliveryFee + tax,
          },
        });
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Create a context provider for CartStore (Optional - if you want context)
const CartContext = createContext<CartStore | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const cartStore = useCartStore();
  
  return (
    <CartContext.Provider value={cartStore}>
      {children}
    </CartContext.Provider>
  );
}

// Hook to use cart context
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}