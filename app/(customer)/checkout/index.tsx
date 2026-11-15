import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useCartStore } from '../../../store/cartStore'; 
import { orderService } from '../../../services/order'; 
import { colors } from '../../../constants/colors';

export default function CheckoutScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const isCheckoutFocused = pathname.includes('checkout');
  const { items, total, restaurantId, restaurantName, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);

  // Form State
  const [address, setAddress] = useState({
    street: '',
    city: '',
    zip: '',
    instructions: '' 
  });
  
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
  const orderSuccessRef = useRef(false);

  // Wait for Zustand persist to finish loading from AsyncStorage before
  // making any decisions about the cart.  This prevents the race where the
  // store starts empty and we redirect the user back to the cart prematurely.
  const [hydrated, setHydrated] = useState(() =>
    useCartStore.persist.hasHydrated()
  );

  useEffect(() => {
    if (useCartStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useCartStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return () => unsub();
  }, []);

  // Reset orderSuccessRef when new items are added to cart for a subsequent order
  useEffect(() => {
    if (items.length > 0) {
      orderSuccessRef.current = false;
    }
  }, [items.length]);

  // Redirect to cart if hydrated and cart is empty (unless order was just submitted)
  useEffect(() => {
    if (isCheckoutFocused && !orderSuccessRef.current && hydrated && items.length === 0) {
      router.replace('/(customer)/cart');
    }
  }, [isCheckoutFocused, hydrated, items.length]);

  // Show nothing while hydrating OR while redirecting (empty cart)
  if (!hydrated || (!orderSuccessRef.current && hydrated && items.length === 0)) {
    return null;
  }

  const handlePlaceOrder = async () => {
    // 1. Input Validation
    if (!address.street.trim() || !address.city.trim()) {
      return Alert.alert('Missing Address', 'Please enter your street and city.');
    }

    if (!restaurantId) {
      return Alert.alert('System Error', 'Restaurant ID is missing. Please clear cart and try again.');
    }

    setLoading(true);

    try {
      // 2. Format Items for Backend
      const orderItems = items.map((item) => ({
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        unit_price: item.price,
        special_instructions: item.specialInstructions || (item as any).instructions || '',
        selected_options: item.selectedOptions || {},
        allergen_notes: item.allergenNotes || ''
      }));

      // 3. Construct Payload
      const orderPayload = {
        restaurant_id: restaurantId,
        items: orderItems,
        delivery_address: {
          street: address.street.trim(),
          city: address.city.trim(),
          zip: address.zip.trim()
        },
        delivery_instructions: address.instructions.trim(),
        special_instructions: "", 
        payment_method: paymentMethod,
        subtotal: total.subtotal,
        delivery_fee: total.deliveryFee,
        tax_amount: total.tax,
        tip_amount: 0
      };

      // 4. Call Backend to Create Order
      const response = await orderService.createOrder(orderPayload);
      
      // 5. Handle Success
      orderSuccessRef.current = true;
      clearCart();
      setAddress({ street: '', city: '', zip: '', instructions: '' });
      // API interceptor returns response.data directly; order ID may be nested
      const orderId = (response as any)?.data?.id ?? (response as any)?.id ?? (response as any)?.order?.id;
      const navigateAfterOrder = () => {
        if (orderId) {
          router.replace(`/(customer)/orders/${orderId}`);
        } else {
          router.replace('/(customer)/orders');
        }
      };

      if (Platform.OS === 'web') {
        Alert.alert(
          'Order Sent to Restaurant!',
          'Your order has been sent to the restaurant manager for approval. Once accepted, you will be able to complete payment.'
        );
        navigateAfterOrder();
      } else {
        Alert.alert(
          'Order Sent to Restaurant!', 
          'Your order has been sent to the restaurant manager for approval. Once accepted, you will be able to complete payment.',
          [{ 
            text: 'OK', 
            onPress: navigateAfterOrder
          }]
        );
      }

    } catch (error: any) {
      console.error('Checkout Error:', error);
      const errorMessage =
        typeof error === 'string'
          ? error
          : error?.response?.data?.error || error?.message || 'Could not place order. Please try again.';
      Alert.alert('Order Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* Restaurant Summary */}
          <View style={styles.restaurantBanner}>
            <Ionicons name="restaurant" size={20} color={colors.primary} />
            <Text style={styles.restaurantName}>Ordering from {restaurantName}</Text>
          </View>

          {/* Section: Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Details</Text>
            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Street Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 123 Campus Way"
                  value={address.street}
                  onChangeText={(t) => setAddress({ ...address, street: t })}
                />
              </View>
              
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>City</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Nelspruit"
                    value={address.city}
                    onChangeText={(t) => setAddress({ ...address, city: t })}
                  />
                </View>
                <View style={[styles.inputGroup, { width: 100 }]}>
                  <Text style={styles.label}>Zip Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1200"
                    value={address.zip}
                    onChangeText={(t) => setAddress({ ...address, zip: t })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Instructions (Optional)</Text>
                <TextInput
                  style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="e.g. Gate code is 5544, leave at reception"
                  value={address.instructions}
                  onChangeText={(t) => setAddress({ ...address, instructions: t })}
                  multiline
                />
              </View>
            </View>
          </View>

          {/* Section: Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Preference</Text>
            <Text style={styles.sectionSubtitle}>You will pay once the restaurant manager accepts your order.</Text>
            
            <View style={styles.card}>
              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod('card')}
              >
                <View style={styles.paymentRow}>
                  <Ionicons name="card-outline" size={24} color={paymentMethod === 'card' ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.paymentText, paymentMethod === 'card' && styles.paymentTextSelected]}>Card Payment</Text>
                </View>
                {paymentMethod === 'card' && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod('cash')}
              >
                <View style={styles.paymentRow}>
                  <Ionicons name="cash-outline" size={24} color={paymentMethod === 'cash' ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.paymentText, paymentMethod === 'cash' && styles.paymentTextSelected]}>Cash on Delivery</Text>
                </View>
                {paymentMethod === 'cash' && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Section: Totals */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            <View style={styles.card}>
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
                <Text style={styles.totalLabel}>Total To Pay</Text>
                <Text style={styles.totalValue}>R {total.total.toFixed(2)}</Text>
              </View>
            </View>
          </View>

        </ScrollView>

        {/* Footer Action */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.placeOrderBtn, loading && styles.disabledBtn]} 
            onPress={handlePlaceOrder}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.placeOrderText}>Request Order • R {total.total.toFixed(2)}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  
  scrollContent: { padding: 20, paddingBottom: 100 },
  
  restaurantBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  restaurantName: { marginLeft: 8, color: colors.primary, fontWeight: '600' },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 },
  sectionSubtitle: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, marginTop: -4 },
  
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  inputGroup: { marginBottom: 12 },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    color: colors.textPrimary,
  },
  row: { flexDirection: 'row' },

  // Payment
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
  },
  paymentOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '05',
  },
  paymentRow: { flexDirection: 'row', alignItems: 'center' },
  paymentText: { marginLeft: 12, fontSize: 14, color: colors.textPrimary },
  paymentTextSelected: { fontWeight: '600', color: colors.primary },

  // Summary
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { color: colors.textSecondary, fontSize: 14 },
  summaryValue: { fontWeight: '500', color: colors.textPrimary, fontSize: 14 },
  totalRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: colors.textPrimary },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: colors.primary },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 10,
  },
  placeOrderBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.7 },
  placeOrderText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});