import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import CartItem from '../../../components/customer/CartItem';
import Button from '../../../components/common/Button';
import { customerColors as colors } from '../../../constants/customerTheme';
import { useCartStore } from '../../../store/cartStore';
import { useLocation } from '../../../hooks/useLocation';
import { orderService } from '../../../services/order';
import { getDeliveryTierLabel } from '../../../constants/deliveryPricing';

export default function CartScreen() {
  const router = useRouter();
  const { location } = useLocation();
  const [quoting, setQuoting] = useState(false);
  const {
    items,
    total,
    clearCart,
    removeItem,
    updateQuantity,
    restaurantId,
    restaurantName,
    distanceKm,
    deliverable,
    deliveryError,
    isOpenNow,
    closedReason,
    setDeliveryQuote,
  } = useCartStore();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (items.length === 0 || !restaurantId) return;

      const lat = location?.coords?.latitude;
      const lng = location?.coords?.longitude;
      setQuoting(true);

      orderService
        .getDeliveryQuote({
          restaurant_id: restaurantId,
          ...(typeof lat === 'number' && typeof lng === 'number'
            ? { latitude: lat, longitude: lng }
            : {}),
        })
        .then((res: any) => {
          if (cancelled) return;
          const q = res?.data ?? res;
          if (!q) return;
          setDeliveryQuote({
            deliveryFee: q.delivery_fee != null ? Number(q.delivery_fee) : null,
            distanceKm: q.distance_km != null ? Number(q.distance_km) : null,
            deliveryRadiusKm: q.max_radius_km != null ? Number(q.max_radius_km) : null,
            deliverable: q.distance_km != null ? Boolean(q.deliverable) : true,
            deliveryError: q.distance_km != null && !q.deliverable ? q.error : null,
            isOpenNow: q.is_open_now !== false,
            closedReason: q.closed_reason || null,
            openingHoursDisplay: q.opening_hours_display || null,
          });
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });

      return () => {
        cancelled = true;
      };
    }, [items.length, restaurantId, location?.coords?.latitude, location?.coords?.longitude])
  );

  const handleCheckout = () => {
    if (items.length === 0 || !isOpenNow) return;
    router.push('/(customer)/checkout');
  };

  const handleGoToRestaurant = () => {
    if (items.length > 0 && restaurantId) {
      router.push(`/(customer)/home/restaurant-details?id=${restaurantId}`);
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
            tone="customer"
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
          <Ionicons name="restaurant" size={20} color={colors.primaryText} />
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

      {/* Warning banners for Closed / Out-of-radius */}
      {!isOpenNow && (
        <View style={styles.warningBanner}>
          <Ionicons name="time-outline" size={20} color="#991B1B" />
          <Text style={styles.warningBannerText}>
            {closedReason || `${restaurantName || 'This restaurant'} is currently closed and not accepting orders.`}
          </Text>
        </View>
      )}

      {isOpenNow && !deliverable && deliveryError && (
        <View style={[styles.warningBanner, { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' }]}>
          <Ionicons name="location-outline" size={20} color="#B45309" />
          <Text style={[styles.warningBannerText, { color: '#92400E' }]}>
            {deliveryError} You can still enter a closer delivery address at Checkout.
          </Text>
        </View>
      )}

      {/* Order Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Order Summary</Text>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>R {total.subtotal.toFixed(2)}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.summaryLabel}>
              Delivery Fee {distanceKm != null ? `(${distanceKm.toFixed(1)} km)` : '(Estimated)'}
            </Text>
            <Text style={styles.summarySubLabel}>
              {quoting
                ? 'Calculating radial delivery fee...'
                : getDeliveryTierLabel(distanceKm)}
            </Text>
          </View>
          {quoting ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <Text style={styles.summaryValue}>R {total.deliveryFee.toFixed(2)}</Text>
          )}
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
          tone="customer"
          title={
            !isOpenNow
              ? 'Restaurant Closed'
              : `Proceed to Checkout • R ${total.total.toFixed(2)}`
          }
          onPress={handleCheckout}
          disabled={items.length === 0 || !isOpenNow}
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
    color: colors.primaryText,
    fontWeight: '600',
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
  summarySubLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  warningBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
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
    color: colors.primaryText,
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