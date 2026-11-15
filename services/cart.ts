import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';
import { CartState } from '../hooks/useCart';

export const cartService = {
  // Save cart to server (for cross-device sync)
  async syncCart(userId: string, cart: CartState) {
    try {
      // In a real app, you'd send this to your backend
      // For now, we'll just save locally
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.CART_DATA}_${userId}`,
        JSON.stringify(cart)
      );
      return { success: true };
    } catch (error) {
      console.error('Error syncing cart:', error);
      return { success: false, error: 'Failed to sync cart' };
    }
  },

  // Get cart from server
  async getCart(userId: string): Promise<CartState | null> {
    try {
      const cartData = await AsyncStorage.getItem(
        `${STORAGE_KEYS.CART_DATA}_${userId}`
      );
      return cartData ? JSON.parse(cartData) : null;
    } catch (error) {
      console.error('Error getting cart:', error);
      return null;
    }
  },

  // Clear cart on server
  async clearCart(userId: string) {
    try {
      await AsyncStorage.removeItem(`${STORAGE_KEYS.CART_DATA}_${userId}`);
      return { success: true };
    } catch (error) {
      console.error('Error clearing cart:', error);
      return { success: false, error: 'Failed to clear cart' };
    }
  },

  // Calculate delivery fee based on location and order amount
  calculateDeliveryFee(
    subtotal: number,
    distanceKm: number,
    restaurantId?: string
  ): number {
    const baseFee = 3.99;
    const distanceFee = Math.max(0, (distanceKm - 3) * 0.5); // R0.50 per km after 3km
    const freeDeliveryThreshold = 25.0;
    
    if (subtotal >= freeDeliveryThreshold) {
      return 0;
    }
    
    return parseFloat((baseFee + distanceFee).toFixed(2));
  },

  // Calculate tax amount
  calculateTax(subtotal: number, taxRate: number = 0.08): number {
    return parseFloat((subtotal * taxRate).toFixed(2));
  },

  // Format cart for API submission
  formatForOrder(cart: CartState, customerId: string) {
    return {
      customer_id: customerId,
      restaurant_id: cart.restaurant_id,
      items: cart.items.map(item => ({
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.discounted_price || item.price,
        special_instructions: item.special_instructions,
        selected_options: item.selected_options,
      })),
      special_instructions: cart.items
        .filter(item => item.special_instructions)
        .map(item => `${item.name}: ${item.special_instructions}`)
        .join('; '),
      subtotal: cart.subtotal,
      delivery_fee: cart.delivery_fee,
      tax_amount: cart.tax_amount,
      tip_amount: cart.tip_amount,
      total_amount: cart.total_amount,
    };
  },

  // Validate item availability (mock - in real app, call your API)
  async validateItems(items: Array<{ menu_item_id: string; quantity: number }>) {
    // This would make an API call to check item availability
    // For now, return all as available
    return items.map(item => ({
      ...item,
      is_available: true,
      validation_errors: [] as string[],
    }));
  },
};