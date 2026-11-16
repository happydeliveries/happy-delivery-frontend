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

const sortOptions = (options: Record<string, any> = {}): Record<string, any> => {
  const sorted: Record<string, any> = {};
  Object.keys(options)
    .sort()
    .forEach((key) => {
      const val = options[key];
      if (val !== undefined && val !== null) {
        sorted[key] = val;
      }
    });
  return sorted;
};

const buildCartItemKey = (menuItemId: string, selectedOptions: Record<string, any> = {}) => {
  return `${menuItemId}-${JSON.stringify(sortOptions(selectedOptions))}`;
};

const calculateItemId = (item: Pick<CartItem, 'menuItemId' | 'selectedOptions'>) => {
  return buildCartItemKey(item.menuItemId, item.selectedOptions || {});
};

const calculateDeliveryFee = (subtotal: number) => {
  if (subtotal === 0) return 0;
  if (subtotal > 25) return 0; // Free delivery over R25
  return 3.99;
};

const calculateTax = (subtotal: number) => {
  return subtotal * 0.08; // 8% tax
};

const computeCartTotals = (items: CartItem[]) => {
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const deliveryFee = calculateDeliveryFee(subtotal);
  const tax = calculateTax(subtotal);
  return {
    subtotal,
    deliveryFee,
    tax,
    total: subtotal + deliveryFee + tax,
  };
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
        const normalizedOptions = sortOptions(itemData.selectedOptions || {});
        const itemId = buildCartItemKey(itemData.menuItemId, normalizedOptions);

        set((state) => {
          const isDifferentRestaurant =
            Boolean(state.restaurantId) &&
            state.items.length > 0 &&
            state.restaurantId !== itemData.restaurantId;

          const baseItems = isDifferentRestaurant ? [] : state.items;
          const existingItemIndex = baseItems.findIndex(
            (item) => calculateItemId(item) === itemId || item.id === itemId
          );

          let updatedItems: CartItem[];
          if (existingItemIndex >= 0) {
            updatedItems = baseItems.map((item, idx) =>
              idx === existingItemIndex
                ? { ...item, quantity: item.quantity + itemData.quantity }
                : item
            );
          } else {
            const newItem: CartItem = {
              ...itemData,
              selectedOptions: normalizedOptions,
              id: itemId,
            };
            updatedItems = [...baseItems, newItem];
          }

          return {
            items: updatedItems,
            restaurantId: itemData.restaurantId,
            restaurantName: itemData.restaurantName,
            total: computeCartTotals(updatedItems),
          };
        });
      },

      removeItem: (menuItemId, selectedOptions = {}) => {
        const itemId = buildCartItemKey(menuItemId, selectedOptions);

        set((state) => {
          const updatedItems = state.items.filter(
            (item) => calculateItemId(item) !== itemId && item.id !== itemId
          );

          return {
            items: updatedItems,
            restaurantId: updatedItems.length === 0 ? undefined : state.restaurantId,
            restaurantName: updatedItems.length === 0 ? undefined : state.restaurantName,
            total: computeCartTotals(updatedItems),
          };
        });
      },

      updateQuantity: (menuItemId, quantity, selectedOptions = {}) => {
        const itemId = buildCartItemKey(menuItemId, selectedOptions);

        if (quantity <= 0) {
          get().removeItem(menuItemId, selectedOptions);
          return;
        }

        set((state) => {
          const updatedItems = state.items.map((item) =>
            calculateItemId(item) === itemId || item.id === itemId
              ? { ...item, quantity }
              : item
          );

          return {
            items: updatedItems,
            total: computeCartTotals(updatedItems),
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
        set({
          total: computeCartTotals(state.items),
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