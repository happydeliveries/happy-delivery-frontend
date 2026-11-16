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
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../../store/cartStore';
import { orderService } from '../../../services/order';
import { authService, userService } from '../../../services/auth';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from '../../../hooks/useLocation';
import { colors } from '../../../constants/colors';

type SavedAddress = {
  id?: string;
  label?: string;
  street?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  instructions?: string;
  latitude?: number;
  longitude?: number;
  is_default?: boolean;
};

type TipMode = 'none' | 'percent' | 'custom';

const TIP_PERCENT_OPTIONS = [5, 10, 15, 20, 25, 30] as const;

const sanitizeTipInput = (raw: string): string => {
  const normalized = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const parts = normalized.split('.');
  if (parts.length <= 1) return parts[0];
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
};

const computeTipAmount = (
  tipMode: TipMode,
  selectedTipPercent: number | null,
  customTipInput: string,
  subtotal: number
): number => {
  if (tipMode === 'percent' && selectedTipPercent && selectedTipPercent > 0) {
    return Math.max(0, +((subtotal * selectedTipPercent) / 100).toFixed(2));
  }
  if (tipMode === 'custom') {
    const parsed = parseFloat(customTipInput);
    if (Number.isFinite(parsed) && parsed > 0) {
      return +parsed.toFixed(2);
    }
  }
  return 0;
};

export default function CheckoutScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const isCheckoutFocused = pathname.includes('checkout');
  const { user } = useAuth();
  const { location, getCurrentLocation, getAddressDetailsFromCoords } = useLocation();
  const { items, total, restaurantId, restaurantName, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [saveAddressForLater, setSaveAddressForLater] = useState(true);

  // Form State
  const [address, setAddress] = useState<{
    street: string;
    city: string;
    zip: string;
    instructions: string;
    latitude?: number;
    longitude?: number;
  }>({
    street: '',
    city: '',
    zip: '',
    instructions: '',
    latitude: undefined,
    longitude: undefined,
  });

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'mobile_money'>('card');
  const [tipMode, setTipMode] = useState<TipMode>('none');
  const [selectedTipPercent, setSelectedTipPercent] = useState<number | null>(null);
  const [customTipInput, setCustomTipInput] = useState('');
  const orderSuccessRef = useRef(false);

  const tipAmount = computeTipAmount(tipMode, selectedTipPercent, customTipInput, total.subtotal);
  const grandTotal = +(total.total + tipAmount).toFixed(2);

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

  // Load saved delivery addresses & preferred payment method when signed in
  useEffect(() => {
    if (!user) return;
    authService
      .getCurrentUser()
      .then((meRes: any) => {
        const prof = meRes?.profile ?? meRes?.data?.profile;
        if (prof?.default_payment_method === 'mobile_money') {
          setPaymentMethod('mobile_money');
        }
      })
      .catch(() => {});
    userService
      .getAddresses()
      .then((res: any) => {
        const list: SavedAddress[] = Array.isArray(res) ? res : res?.data ?? [];
        if (Array.isArray(list) && list.length > 0) {
          setSavedAddresses(list);
          const def = list.find((a) => a.is_default) || list[0];
          applySavedAddress(def);
        }
      })
      .catch(() => {});
  }, [user?.id]);

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

  const applySavedAddress = (saved: SavedAddress) => {
    setSelectedSavedId(saved.id || saved.street || null);
    setAddress({
      street: saved.street || saved.address || '',
      city: saved.city || '',
      zip: saved.postal_code || '',
      instructions: saved.instructions || '',
      latitude: saved.latitude,
      longitude: saved.longitude,
    });
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const current = await getCurrentLocation();
      const coords = current?.coords || location?.coords;
      if (!coords) {
        Alert.alert('Location Unavailable', 'Could not determine your GPS coordinates. Please type your address manually.');
        return;
      }
      const geo = await getAddressDetailsFromCoords(coords.latitude, coords.longitude);
      setSelectedSavedId(null);
      setAddress((prev) => ({
        ...prev,
        street: geo?.street || geo?.name || geo?.formattedAddress || prev.street,
        city: geo?.city || geo?.district || prev.city,
        zip: geo?.postalCode || prev.zip,
        latitude: coords.latitude,
        longitude: coords.longitude,
      }));
    } catch {
      Alert.alert('Location Error', 'Failed to look up your current street address.');
    } finally {
      setLocating(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in or create an account to place your order.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
        ]
      );
      return;
    }

    // 1. Input Validation
    if (!address.street.trim() || !address.city.trim()) {
      return Alert.alert('Missing Address', 'Please enter your street and city.');
    }

    if (!restaurantId) {
      return Alert.alert('System Error', 'Restaurant ID is missing. Please clear cart and try again.');
    }

    setLoading(true);

    try {
      // Save address if user typed a new address and checked save
      if (saveAddressForLater && !selectedSavedId) {
        userService
          .addAddress({
            label: 'Saved',
            street: address.street.trim(),
            city: address.city.trim(),
            postal_code: address.zip.trim(),
            instructions: address.instructions.trim(),
            latitude: address.latitude,
            longitude: address.longitude,
            is_default: savedAddresses.length === 0,
          })
          .catch(() => {});
      }

      // 2. Format Items for Backend
      const orderItems = items.map((item) => ({
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        unit_price: item.price,
        special_instructions: item.specialInstructions || (item as any).instructions || '',
        selected_options: item.selectedOptions || {},
        allergen_notes: item.allergenNotes || ''
      }));

      // 3. Construct Payload (include GPS coords when available so driver navigation & live map are exact)
      const deliveryAddressPayload: Record<string, any> = {
        street: address.street.trim(),
        city: address.city.trim(),
        zip: address.zip.trim(),
      };
      const effLat = address.latitude ?? location?.coords.latitude;
      const effLng = address.longitude ?? location?.coords.longitude;
      if (typeof effLat === 'number' && typeof effLng === 'number') {
        deliveryAddressPayload.latitude = effLat;
        deliveryAddressPayload.longitude = effLng;
      }

      const orderPayload = {
        restaurant_id: restaurantId,
        items: orderItems,
        delivery_address: deliveryAddressPayload,
        delivery_instructions: address.instructions.trim(),
        special_instructions: "", 
        payment_method: paymentMethod,
        subtotal: total.subtotal,
        delivery_fee: total.deliveryFee,
        tax_amount: total.tax,
        tip_amount: tipAmount
      };

      // 4. Call Backend to Create Order
      const response = await orderService.createOrder(orderPayload);
      
      // 5. Handle Success
      orderSuccessRef.current = true;
      clearCart();
      setAddress({ street: '', city: '', zip: '', instructions: '' });
      setTipMode('none');
      setSelectedTipPercent(null);
      setCustomTipInput('');
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
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Delivery Details</Text>
              <TouchableOpacity
                style={styles.gpsButton}
                onPress={handleUseCurrentLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="locate" size={16} color={colors.primary} />
                    <Text style={styles.gpsButtonText}>Use GPS</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {savedAddresses.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.savedAddressChips}
              >
                {savedAddresses.map((saved, idx) => {
                  const chipKey = saved.id || saved.street || String(idx);
                  const active = selectedSavedId === chipKey;
                  return (
                    <TouchableOpacity
                      key={chipKey}
                      style={[styles.savedChip, active && styles.savedChipActive]}
                      onPress={() => applySavedAddress(saved)}
                    >
                      <Ionicons
                        name="bookmark"
                        size={13}
                        color={active ? '#fff' : colors.primary}
                      />
                      <Text style={[styles.savedChipText, active && styles.savedChipTextActive]}>
                        {saved.label || saved.street}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Street Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 123 Campus Way"
                  value={address.street}
                  onChangeText={(t) => {
                    setSelectedSavedId(null);
                    setAddress({ ...address, street: t });
                  }}
                />
              </View>
              
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>City</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Nelspruit"
                    value={address.city}
                    onChangeText={(t) => {
                      setSelectedSavedId(null);
                      setAddress({ ...address, city: t });
                    }}
                  />
                </View>
                <View style={[styles.inputGroup, { width: 100 }]}>
                  <Text style={styles.label}>Postal Code</Text>
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

              {user && !selectedSavedId && (
                <TouchableOpacity
                  style={styles.saveAddressRow}
                  onPress={() => setSaveAddressForLater((prev) => !prev)}
                >
                  <Ionicons
                    name={saveAddressForLater ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.saveAddressText}>Save this address to my profile</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Section: Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Online Payment Method</Text>
            <Text style={styles.sectionSubtitle}>
              Pay securely via Paystack once the restaurant accepts your order.
            </Text>
            
            <View style={styles.card}>
              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod('card')}
              >
                <View style={styles.paymentRow}>
                  <Ionicons name="card-outline" size={24} color={paymentMethod === 'card' ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.paymentText, paymentMethod === 'card' && styles.paymentTextSelected]}>Debit / Credit Card</Text>
                </View>
                {paymentMethod === 'card' && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'mobile_money' && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod('mobile_money')}
              >
                <View style={styles.paymentRow}>
                  <Ionicons name="qr-code-outline" size={24} color={paymentMethod === 'mobile_money' ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.paymentText, paymentMethod === 'mobile_money' && styles.paymentTextSelected]}>Instant EFT / SnapScan / QR</Text>
                </View>
                {paymentMethod === 'mobile_money' && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Section: Tip Driver */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Tip Driver</Text>
              {tipAmount > 0 && (
                <View style={styles.tipBadge}>
                  <Text style={styles.tipBadgeText}>+R {tipAmount.toFixed(2)}</Text>
                </View>
              )}
            </View>
            <Text style={styles.sectionSubtitle}>
              Show appreciation to your driver — 100% of your tip goes directly to them.
            </Text>

            <View style={styles.card}>
              <View style={styles.tipGrid}>
                <TouchableOpacity
                  style={[styles.tipChip, tipMode === 'none' && styles.tipChipActive]}
                  onPress={() => {
                    setTipMode('none');
                    setSelectedTipPercent(null);
                    setCustomTipInput('');
                  }}
                >
                  <Text style={[styles.tipChipLabel, tipMode === 'none' && styles.tipChipTextActive]}>
                    No Tip
                  </Text>
                  <Text style={[styles.tipChipSub, tipMode === 'none' && styles.tipChipTextActive]}>
                    R 0.00
                  </Text>
                </TouchableOpacity>

                {TIP_PERCENT_OPTIONS.map((pct) => {
                  const active = tipMode === 'percent' && selectedTipPercent === pct;
                  const pctRand = +((total.subtotal * pct) / 100).toFixed(2);
                  return (
                    <TouchableOpacity
                      key={pct}
                      style={[styles.tipChip, active && styles.tipChipActive]}
                      onPress={() => {
                        if (active) {
                          setTipMode('none');
                          setSelectedTipPercent(null);
                        } else {
                          setTipMode('percent');
                          setSelectedTipPercent(pct);
                        }
                      }}
                    >
                      <Text style={[styles.tipChipLabel, active && styles.tipChipTextActive]}>
                        {pct}%
                      </Text>
                      <Text style={[styles.tipChipSub, active && styles.tipChipTextActive]}>
                        R {pctRand.toFixed(2)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={[styles.tipChip, tipMode === 'custom' && styles.tipChipActive]}
                  onPress={() => {
                    setTipMode('custom');
                    setSelectedTipPercent(null);
                  }}
                >
                  <Text style={[styles.tipChipLabel, tipMode === 'custom' && styles.tipChipTextActive]}>
                    Custom
                  </Text>
                  <Text style={[styles.tipChipSub, tipMode === 'custom' && styles.tipChipTextActive]}>
                    Enter R
                  </Text>
                </TouchableOpacity>
              </View>

              {tipMode === 'custom' && (
                <View style={styles.customTipWrapper}>
                  <Text style={styles.label}>Enter your own tip amount (ZAR)</Text>
                  <View style={styles.customTipInputRow}>
                    <Text style={styles.currencyPrefix}>R</Text>
                    <TextInput
                      style={styles.customTipInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.textTertiary}
                      value={customTipInput}
                      onChangeText={(text) => {
                        setTipMode('custom');
                        setSelectedTipPercent(null);
                        setCustomTipInput(sanitizeTipInput(text));
                      }}
                      keyboardType="decimal-pad"
                    />
                    {customTipInput.length > 0 && (
                      <TouchableOpacity onPress={() => setCustomTipInput('')}>
                        <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
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
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Driver Tip{tipMode === 'percent' && selectedTipPercent ? ` (${selectedTipPercent}%)` : ''}
                </Text>
                <Text style={[styles.summaryValue, tipAmount > 0 && styles.tipSummaryValue]}>
                  R {tipAmount.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total To Pay</Text>
                <Text style={styles.totalValue}>R {grandTotal.toFixed(2)}</Text>
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
              <Text style={styles.placeOrderText}>Request Order • R {grandTotal.toFixed(2)}</Text>
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gpsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  savedAddressChips: {
    gap: 8,
    marginBottom: 10,
  },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  savedChipActive: {
    backgroundColor: colors.primary,
  },
  savedChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  savedChipTextActive: {
    color: '#fff',
  },
  saveAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  saveAddressText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tipBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tipBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  tipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tipChip: {
    width: '23%',
    minWidth: 70,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  tipChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  tipChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tipChipSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tipChipTextActive: {
    color: '#fff',
  },
  customTipWrapper: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  customTipInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginRight: 8,
  },
  customTipInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tipSummaryValue: {
    color: colors.primary,
    fontWeight: '700',
  },
});