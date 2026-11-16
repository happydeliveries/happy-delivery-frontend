import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, ReactNode } from 'react';
import {
  DEFAULT_BASE_DELIVERY_FEE,
  calculateRadialDeliveryFee,
} from '../constants/deliveryPricing';

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

type DeliveryQuoteUpdate = {
  deliveryFee?: number | null;
  distanceKm?: number | null;
  deliveryRadiusKm?: number | null;
  deliverable?: boolean;
  deliveryError?: string | null;
  isOpenNow?: boolean;
  closedReason?: string | null;
  openingHoursDisplay?: string | null;
};

type CartStore = {
  items: CartItem[];
  restaurantId?: string;
  restaurantName?: string;
  distanceKm: number | null;
  deliveryRadiusKm: number | null;
  quotedDeliveryFee: number | null;
  deliverable: boolean;
  deliveryError: string | null;
  isOpenNow: boolean;
  closedReason: string | null;
  openingHoursDisplay: string | null;
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
  setDeliveryQuote: (quote: DeliveryQuoteUpdate) => void;
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

const calculateTax = (subtotal: number) => {
  return subtotal * 0.08; // 8% tax
};

const resolveEffectiveDeliveryFee = (
  items: CartItem[],
  quotedDeliveryFee: number | null,
  distanceKm: number | null,
  deliveryRadiusKm: number | null
) => {
  if (!items || items.length === 0) return 0;
  if (quotedDeliveryFee !== null && quotedDeliveryFee !== undefined && Number.isFinite(Number(quotedDeliveryFee))) {
    return Number(quotedDeliveryFee);
  }
  if (distanceKm !== null && distanceKm !== undefined && Number.isFinite(Number(distanceKm))) {
    return calculateRadialDeliveryFee(Number(distanceKm), deliveryRadiusKm ?? 15);
  }
  return DEFAULT_BASE_DELIVERY_FEE;
};

const computeCartTotals = (
  items: CartItem[],
  quotedDeliveryFee: number | null = null,
  distanceKm: number | null = null,
  deliveryRadiusKm: number | null = null
) => {
  const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const deliveryFee = resolveEffectiveDeliveryFee(items, quotedDeliveryFee, distanceKm, deliveryRadiusKm);
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
      distanceKm: null,
      deliveryRadiusKm: null,
      quotedDeliveryFee: null,
      deliverable: true,
      deliveryError: null,
      isOpenNow: true,
      closedReason: null,
      openingHoursDisplay: null,
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

          const nextQuotedFee = isDifferentRestaurant ? null : state.quotedDeliveryFee;
          const nextDistanceKm = isDifferentRestaurant ? null : state.distanceKm;
          const nextRadiusKm = isDifferentRestaurant ? null : state.deliveryRadiusKm;

          return {
            items: updatedItems,
            restaurantId: itemData.restaurantId,
            restaurantName: itemData.restaurantName,
            distanceKm: nextDistanceKm,
            deliveryRadiusKm: nextRadiusKm,
            quotedDeliveryFee: nextQuotedFee,
            deliverable: isDifferentRestaurant ? true : state.deliverable,
            deliveryError: isDifferentRestaurant ? null : state.deliveryError,
            isOpenNow: isDifferentRestaurant ? true : state.isOpenNow,
            closedReason: isDifferentRestaurant ? null : state.closedReason,
            openingHoursDisplay: isDifferentRestaurant ? null : state.openingHoursDisplay,
            total: computeCartTotals(updatedItems, nextQuotedFee, nextDistanceKm, nextRadiusKm),
          };
        });
      },

      removeItem: (menuItemId, selectedOptions = {}) => {
        const itemId = buildCartItemKey(menuItemId, selectedOptions);

        set((state) => {
          const updatedItems = state.items.filter(
            (item) => calculateItemId(item) !== itemId && item.id !== itemId
          );
          const empty = updatedItems.length === 0;

          return {
            items: updatedItems,
            restaurantId: empty ? undefined : state.restaurantId,
            restaurantName: empty ? undefined : state.restaurantName,
            distanceKm: empty ? null : state.distanceKm,
            deliveryRadiusKm: empty ? null : state.deliveryRadiusKm,
            quotedDeliveryFee: empty ? null : state.quotedDeliveryFee,
            deliverable: empty ? true : state.deliverable,
            deliveryError: empty ? null : state.deliveryError,
            isOpenNow: empty ? true : state.isOpenNow,
            closedReason: empty ? null : state.closedReason,
            openingHoursDisplay: empty ? null : state.openingHoursDisplay,
            total: computeCartTotals(
              updatedItems,
              empty ? null : state.quotedDeliveryFee,
              empty ? null : state.distanceKm,
              empty ? null : state.deliveryRadiusKm
            ),
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
            total: computeCartTotals(
              updatedItems,
              state.quotedDeliveryFee,
              state.distanceKm,
              state.deliveryRadiusKm
            ),
          };
        });
      },

      clearCart: () => {
        set({
          items: [],
          restaurantId: undefined,
          restaurantName: undefined,
          distanceKm: null,
          deliveryRadiusKm: null,
          quotedDeliveryFee: null,
          deliverable: true,
          deliveryError: null,
          isOpenNow: true,
          closedReason: null,
          openingHoursDisplay: null,
          total: {
            subtotal: 0,
            deliveryFee: 0,
            tax: 0,
            total: 0,
          },
        });
      },

      setRestaurant: (restaurantId, restaurantName) => {
        set((state) => {
          if (state.restaurantId === restaurantId && state.restaurantName === restaurantName) {
            return {};
          }
          return {
            restaurantId,
            restaurantName,
            distanceKm: null,
            deliveryRadiusKm: null,
            quotedDeliveryFee: null,
            deliverable: true,
            deliveryError: null,
            isOpenNow: true,
            closedReason: null,
            openingHoursDisplay: null,
          };
        });
      },

      setDeliveryQuote: (quote) => {
        set((state) => {
          const nextQuotedFee =
            quote.deliveryFee !== undefined ? quote.deliveryFee : state.quotedDeliveryFee;
          const nextDistanceKm =
            quote.distanceKm !== undefined ? quote.distanceKm : state.distanceKm;
          const nextRadiusKm =
            quote.deliveryRadiusKm !== undefined ? quote.deliveryRadiusKm : state.deliveryRadiusKm;

          return {
            quotedDeliveryFee: nextQuotedFee,
            distanceKm: nextDistanceKm,
            deliveryRadiusKm: nextRadiusKm,
            deliverable: quote.deliverable !== undefined ? quote.deliverable : state.deliverable,
            deliveryError: quote.deliveryError !== undefined ? quote.deliveryError : state.deliveryError,
            isOpenNow: quote.isOpenNow !== undefined ? quote.isOpenNow : state.isOpenNow,
            closedReason: quote.closedReason !== undefined ? quote.closedReason : state.closedReason,
            openingHoursDisplay:
              quote.openingHoursDisplay !== undefined ? quote.openingHoursDisplay : state.openingHoursDisplay,
            total: computeCartTotals(state.items, nextQuotedFee, nextDistanceKm, nextRadiusKm),
          };
        });
      },

      calculateTotals: () => {
        const state = get();
        set({
          total: computeCartTotals(
            state.items,
            state.quotedDeliveryFee,
            state.distanceKm,
            state.deliveryRadiusKm
          ),
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