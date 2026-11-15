import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CartItem from '../../../components/customer/CartItem';
import Button from '../../../components/common/Button';
import { colors } from '../../../constants/colors';
import { useCartStore } from '../../../store/cartStore';

export default function CartScreen() {
  const router = useRouter();
  const { items, total, clearCart, removeItem, updateQuantity, restaurantName } = useCartStore();

  const handleCheckout = () => {
    if (items.length === 0) return;
    // Navigate to checkout screen (to be implemented)
    router.push('/(customer)/checkout');
  };

  const handleGoToRestaurant = () => {
    if (items.length > 0) {
      // Navigate back to the restaurant
      router.back();
    } else {
      router.push('/(customer)/home');
    }
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cart-outline" size={80} color={colors.gray300} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Add some delicious items from restaurants
          </Text>
          <Button
            title="Browse Restaurants"
            onPress={() => router.push('/(customer)/home')}
            style={styles.emptyButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Cart</Text>
        <TouchableOpacity onPress={clearCart}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Restaurant Info */}
      {restaurantName && (
        <View style={styles.restaurantInfo}>
          <Ionicons name="restaurant" size={20} color={colors.primary} />
          <Text style={styles.restaurantName} numberOfLines={1}>
            Ordering from: {restaurantName}
          </Text>
          <TouchableOpacity onPress={handleGoToRestaurant}>
            <Text style={styles.viewMenuText}>View Menu</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cart Items */}
      <ScrollView style={styles.itemsContainer}>
        {items.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            onRemove={() => removeItem(item.menuItemId, item.selectedOptions)}
            onQuantityChange={(quantity) =>
              updateQuantity(item.menuItemId, quantity, item.selectedOptions)
            }
          />
        ))}
      </ScrollView>

      {/* Order Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Order Summary</Text>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>R {total.subtotal.toFixed(2)}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Delivery Fee</Text>
          <Text style={styles.summaryValue}>R {total.deliveryFee.toFixed(2)}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tax</Text>
          <Text style={styles.summaryValue}>R {total.tax.toFixed(2)}</Text>
        </View>
        
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>R {total.total.toFixed(2)}</Text>
        </View>
      </View>

      {/* Checkout Button */}
      <View style={styles.checkoutContainer}>
        <Button
          title={`Proceed to Checkout • R ${total.total.toFixed(2)}`}
          onPress={handleCheckout}
          disabled={items.length === 0}
          style={styles.checkoutButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  clearText: {
    fontSize: 14,
    color: colors.error,
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  restaurantName: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    marginLeft: 12,
    marginRight: 12,
  },
  viewMenuText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  itemsContainer: {
    flex: 1,
    padding: 20,
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  checkoutContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkoutButton: {
    width: '100%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  emptyButton: {
    width: '100%',
  },
});