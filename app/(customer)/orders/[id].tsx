import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Linking,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '../../../components/common/Button';
import { colors } from '../../../constants/colors';
import { orderService } from '../../../services/order';
import { useSocket } from '../../../hooks/useSocket';

type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status?: string;
  payment_method?: string;
  subtotal: number;
  delivery_fee: number;
  tax_amount: number;
  tip_amount: number;
  total_amount: number;
  placed_at: string;
  delivered_at?: string;
  special_instructions?: string;
  delivery_instructions?: string;
  restaurant_name: string;
  restaurant_address: string;
  restaurant_phone: string;
  driver_first_name?: string;
  driver_last_name?: string;
  driver_phone?: string;
  driver_vehicle?: string;
  items: Array<{
    id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    special_instructions?: string;
    selected_options?: any;
  }>;
};

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const socket = useSocket();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'cash' | 'mobile_money'>('card');
  const [paystackModalVisible, setPaystackModalVisible] = useState(false);
  const [paystackSession, setPaystackSession] = useState<{
    authorization_url: string;
    reference: string;
    amount: number;
    currency: string;
    email: string;
    mode: string;
  } | null>(null);
  const [cardNumber, setCardNumber] = useState('4084 0840 8408 4081');
  const [cardExpiry, setCardExpiry] = useState('09/29');
  const [cardCvv, setCardCvv] = useState('408');
  const [selectedBank, setSelectedBank] = useState('Capitec Bank');
  const [verifyingPaystack, setVerifyingPaystack] = useState(false);

  useEffect(() => {
    let isMounted = true; 

    const loadData = async () => {
      try {
        const data = await orderService.getOrder(id);
        const resolvedOrder = (data as any)?.order ?? (data as any)?.data ?? data;
        if (isMounted && resolvedOrder) {
          setOrder(resolvedOrder);
          if (resolvedOrder.payment_method) {
            setSelectedPaymentMethod(resolvedOrder.payment_method);
          }
        }
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    loadData();
    const intervalId = setInterval(loadData, 5000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [id]);

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('join_order', id);

    const handleOrderUpdate = () => {
      fetchOrderDetails();
    };

    socket.on('order_update', handleOrderUpdate);
    return () => {
      socket.off('order_update', handleOrderUpdate);
    };
  }, [socket, id]);

  const fetchOrderDetails = async () => {
    try {
      const data = await orderService.getOrder(id);
      const resolvedOrder = (data as any)?.order ?? (data as any)?.data ?? data;
      if (resolvedOrder) {
        setOrder(resolvedOrder);
        if (resolvedOrder.payment_status === 'completed' && paystackModalVisible) {
          setPaystackModalVisible(false);
        }
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-check order payment status when returning from Paystack browser checkout
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && paystackSession?.reference) {
        fetchOrderDetails();
      }
    });
    return () => sub.remove();
  }, [paystackSession]);

  const handlePayNow = async () => {
    if (!order) return;
    setPaying(true);
    try {
      const initRes = await orderService.initializePaystackPayment(order.id, selectedPaymentMethod);
      const sessionData = (initRes as any)?.data ?? initRes;
      if (!sessionData?.reference) {
        throw new Error('Could not initialize Paystack checkout session');
      }
      setPaystackSession(sessionData);
      setPaystackModalVisible(true);
    } catch (error: any) {
      const errMsg =
        typeof error === 'string'
          ? error
          : error?.response?.data?.error || error?.message || 'Could not start Paystack payment.';
      Alert.alert('Paystack Error', errMsg);
    } finally {
      setPaying(false);
    }
  };

  const handleOpenPaystackBrowser = async () => {
    if (!paystackSession?.authorization_url) return;
    try {
      await Linking.openURL(paystackSession.authorization_url);
    } catch {
      Alert.alert('Browser Error', 'Could not open Paystack checkout URL.');
    }
  };

  const handleCompletePaystackPayment = async (completeInApp: boolean) => {
    if (!order || !paystackSession) return;
    if (completeInApp && selectedPaymentMethod === 'card') {
      const digits = cardNumber.replace(/\D/g, '');
      if (digits.length < 12 || !cardExpiry.trim() || cardCvv.trim().length < 3) {
        Alert.alert('Card Details Required', 'Please enter a valid card number, expiry date, and CVV.');
        return;
      }
    }

    setVerifyingPaystack(true);
    try {
      const digits = cardNumber.replace(/\D/g, '');
      await orderService.verifyPaystackPayment({
        order_id: order.id,
        reference: paystackSession.reference,
        channel: selectedPaymentMethod === 'mobile_money' ? 'eft' : selectedPaymentMethod,
        complete_checkout: completeInApp,
        card_last4: digits.slice(-4) || '4081',
      });
      setPaystackModalVisible(false);
      await fetchOrderDetails();
      Alert.alert(
        'Paystack Payment Confirmed!',
        'Your payment has been verified via Paystack and your order is now available to active drivers nearby.'
      );
    } catch (error: any) {
      const errMsg =
        typeof error === 'string'
          ? error
          : error?.response?.data?.error || error?.message || 'Payment could not be verified yet.';
      Alert.alert('Paystack Verification', errMsg);
    } finally {
      setVerifyingPaystack(false);
    }
  };

  const getStatusSteps = () => {
    const steps = [
      { key: 'ordered', label: 'Placed', icon: 'receipt' },
      { key: 'accepted_by_manager', label: 'Accepted', icon: 'restaurant' },
      { key: 'paid', label: 'Paid', icon: 'card' },
      { key: 'on_the_way', label: 'Driver', icon: 'car' },
      { key: 'delivered', label: 'Delivered', icon: 'checkmark-circle' },
    ];

    let currentIndex = 0;
    if (order?.status === 'cancelled' || order?.status === 'no_drivers_available') {
      currentIndex = -1;
    } else if (order?.status === 'pending') {
      currentIndex = 0;
    } else if (order?.status === 'ordering_at_restaurant' && order?.payment_status !== 'completed') {
      currentIndex = 1;
    } else if (order?.status === 'ordering_at_restaurant' && order?.payment_status === 'completed') {
      currentIndex = 2;
    } else if (['accepted_by_driver', 'order_ready', 'picked_up', 'on_the_way', 'arrived'].includes(order?.status || '')) {
      currentIndex = 3;
    } else if (order?.status === 'delivered') {
      currentIndex = 4;
    }

    return steps.map((step, index) => ({
      ...step,
      completed: currentIndex >= 0 && index <= currentIndex,
      current: index === currentIndex,
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="receipt-outline" size={60} color={colors.gray400} />
          <Text style={styles.errorTitle}>Order not found</Text>
          <Button 
            title="Back to Orders"
            onPress={() => router.push('/(customer)/orders')}
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  const statusSteps = getStatusSteps();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.orderNumber}>{order.order_number}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Status Timeline */}
        <View style={styles.timelineContainer}>
          {statusSteps.map((step, index) => (
            <View key={step.key} style={styles.timelineStep}>
              <View style={styles.timelineLineContainer}>
                {index > 0 && (
                  <View style={[
                    styles.timelineLine,
                    step.completed ? styles.timelineLineActive : styles.timelineLineInactive,
                  ]} />
                )}
                <View style={[
                  styles.timelineDot,
                  step.completed ? styles.timelineDotActive : styles.timelineDotInactive,
                  step.current && styles.timelineDotCurrent,
                ]}>
                  <Ionicons 
                    name={step.icon as any} 
                    size={16} 
                    color={step.completed ? '#fff' : colors.gray400} 
                  />
                </View>
              </View>
              <Text style={[
                styles.timelineLabel,
                step.completed ? styles.timelineLabelActive : styles.timelineLabelInactive,
              ]}>
                {step.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Status Banner */}
        {order.status === 'pending' && (
          <View style={[styles.statusBanner, { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' }]}>
            <Ionicons name="time-outline" size={24} color="#D97706" />
            <View style={styles.statusBannerTextContainer}>
              <Text style={[styles.statusBannerTitle, { color: '#92400E' }]}>Awaiting Restaurant Approval</Text>
              <Text style={[styles.statusBannerSubtitle, { color: '#B45309' }]}>
                Your order has been sent to the restaurant manager. Once they accept it, you will be able to pay here.
              </Text>
            </View>
          </View>
        )}

        {order.status === 'cancelled' && (
          <View style={[styles.statusBanner, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
            <Ionicons name="close-circle-outline" size={24} color="#DC2626" />
            <View style={styles.statusBannerTextContainer}>
              <Text style={[styles.statusBannerTitle, { color: '#991B1B' }]}>Order Rejected / Cancelled</Text>
              <Text style={[styles.statusBannerSubtitle, { color: '#B91C1C' }]}>
                This order was rejected by the restaurant manager and has been cancelled completely.
              </Text>
            </View>
          </View>
        )}

        {order.status === 'ordering_at_restaurant' && order.payment_status !== 'completed' && (
          <View style={styles.paymentCard}>
            <View style={styles.paymentHeaderRow}>
              <View style={styles.paystackBadgeLogo}>
                <Text style={styles.paystackBadgeLogoText}>P</Text>
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.paymentCardTitle}>Order Accepted • Pay with Paystack</Text>
                <Text style={styles.paymentCardSubtitle}>
                  Your restaurant accepted the order! Complete your secure Paystack payment below so active drivers can pick it up.
                </Text>
              </View>
            </View>

            <View style={styles.paymentMethodsRow}>
              {([
                { key: 'card', label: 'Card', icon: 'card-outline' },
                { key: 'mobile_money', label: 'Instant EFT', icon: 'business-outline' },
                { key: 'cash', label: 'QR / Scan', icon: 'qr-code-outline' },
              ] as const).map((method) => (
                <TouchableOpacity
                  key={method.key}
                  style={[
                    styles.paymentMethodChip,
                    selectedPaymentMethod === method.key && styles.paymentMethodChipSelected,
                  ]}
                  onPress={() => setSelectedPaymentMethod(method.key)}
                >
                  <Ionicons
                    name={method.icon as any}
                    size={18}
                    color={selectedPaymentMethod === method.key ? '#09A5DB' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.paymentMethodChipText,
                      selectedPaymentMethod === method.key && styles.paymentMethodChipTextSelected,
                    ]}
                  >
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title={paying ? 'Initializing Paystack...' : `Pay with Paystack • R ${Number(order.total_amount || 0).toFixed(2)}`}
              onPress={handlePayNow}
              loading={paying}
              variant="primary"
            />
          </View>
        )}

        {order.status === 'ordering_at_restaurant' && order.payment_status === 'completed' && (
          <View style={[styles.statusBanner, { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }]}>
            <Ionicons name="car-outline" size={24} color="#2563EB" />
            <View style={styles.statusBannerTextContainer}>
              <Text style={[styles.statusBannerTitle, { color: '#1E40AF' }]}>Payment Complete • Finding Driver</Text>
              <Text style={[styles.statusBannerSubtitle, { color: '#1D4ED8' }]}>
                Your order is paid and is now available for active drivers to accept.
              </Text>
            </View>
          </View>
        )}

        {['accepted_by_driver', 'picked_up', 'on_the_way', 'arrived'].includes(order.status) && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push(`/(customer)/orders/tracking?id=${order.id}`)}
            style={[
              styles.statusBanner,
              {
                backgroundColor: order.status === 'picked_up' ? '#ECFDF5' : '#EFF6FF',
                borderColor: order.status === 'picked_up' ? '#10B981' : '#3B82F6',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 12,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name={order.status === 'picked_up' ? 'navigate-circle' : 'map'}
                size={28}
                color={order.status === 'picked_up' ? '#059669' : '#2563EB'}
              />
              <View style={styles.statusBannerTextContainer}>
                <Text
                  style={[
                    styles.statusBannerTitle,
                    { color: order.status === 'picked_up' ? '#065F46' : '#1E40AF' },
                  ]}
                >
                  {order.status === 'picked_up'
                    ? 'Order Picked Up • Driver Live on Map!'
                    : order.status === 'on_the_way'
                    ? 'Driver is On the Way • Track Live!'
                    : order.status === 'arrived'
                    ? 'Driver Has Arrived!'
                    : 'Driver Assigned to Your Order'}
                </Text>
                <Text
                  style={[
                    styles.statusBannerSubtitle,
                    { color: order.status === 'picked_up' ? '#047857' : '#1D4ED8' },
                  ]}
                >
                  {order.status === 'picked_up'
                    ? 'Your driver has picked up your order from the restaurant. Tap below to track the driver live on the in-app map.'
                    : 'Tap below to open the live in-app map and watch your driver in real time.'}
                </Text>
              </View>
            </View>
            <Button
              title={order.status === 'picked_up' ? 'Track Driver Live on Map' : 'Open Live Map Tracking'}
              onPress={() => router.push(`/(customer)/orders/tracking?id=${order.id}`)}
              variant="primary"
            />
          </TouchableOpacity>
        )}

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {(order.items || []).map(item => {
            const rawOpts = (item as any).selected_options;
            let parsedOpts: Record<string, any> | null = null;
            if (rawOpts && typeof rawOpts === 'object') {
              parsedOpts = rawOpts;
            } else if (typeof rawOpts === 'string' && rawOpts.trim()) {
              try {
                parsedOpts = JSON.parse(rawOpts);
              } catch {
                parsedOpts = null;
              }
            }
            const optionSummary = parsedOpts
              ? Object.entries(parsedOpts)
                  .map(([grp, val]) => {
                    if (val == null || val === '') return '';
                    if (Array.isArray(val)) {
                      const list = val
                        .map((v) => {
                          if (typeof v === 'object' && v !== null) {
                            const p = Number(v.price ?? v.priceDelta ?? 0);
                            return `${v.name || v.label || ''}${p > 0 ? ` (+R${p.toFixed(2)})` : ''}`;
                          }
                          return String(v);
                        })
                        .filter(Boolean)
                        .join(', ');
                      return list ? `${grp}: ${list}` : '';
                    }
                    if (typeof val === 'object') {
                      const p = Number(val.price ?? val.priceDelta ?? 0);
                      const n = val.name || val.label || '';
                      return n ? `${grp}: ${n}${p > 0 ? ` (+R${p.toFixed(2)})` : ''}` : '';
                    }
                    return `${grp}: ${val}`;
                  })
                  .filter(Boolean)
                  .join(' • ')
              : '';

            return (
              <View key={item.id} style={styles.orderItem}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                  <Text style={styles.itemPrice}>R {Number(item.total_price || 0).toFixed(2)}</Text>
                </View>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                  {!!optionSummary && (
                    <Text style={[styles.itemInstructions, { fontStyle: 'normal', color: colors.textSecondary, marginTop: 2 }]}>
                      {optionSummary}
                    </Text>
                  )}
                  {!!item.special_instructions && (
                    <Text style={styles.itemInstructions}>Note: {item.special_instructions}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Delivery Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          
          <View style={styles.detailRow}>
            <Ionicons name="restaurant" size={20} color={colors.primary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Restaurant</Text>
              <Text style={styles.detailValue}>{order.restaurant_name}</Text>
              <Text style={styles.detailSubtext}>{order.restaurant_address}</Text>
              {order.restaurant_phone && (
                <Text style={styles.detailSubtext}>{order.restaurant_phone}</Text>
              )}
            </View>
          </View>

          {order.driver_first_name && (
            <View style={styles.detailRow}>
              <Ionicons name="person" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Driver</Text>
                <Text style={styles.detailValue}>
                  {order.driver_first_name} {order.driver_last_name}
                </Text>
                {order.driver_phone && (
                  <Text style={styles.detailSubtext}>{order.driver_phone}</Text>
                )}
                {order.driver_vehicle && (
                  <Text style={styles.detailSubtext}>{order.driver_vehicle}</Text>
                )}
              </View>
            </View>
          )}

          {order.delivery_instructions && (
            <View style={styles.detailRow}>
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Delivery Instructions</Text>
                <Text style={styles.detailValue}>{order.delivery_instructions}</Text>
              </View>
            </View>
          )}

          {order.special_instructions && (
            <View style={styles.detailRow}>
              <Ionicons name="clipboard" size={20} color={colors.primary} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Special Instructions</Text>
                <Text style={styles.detailValue}>{order.special_instructions}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Payment Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            {/* FIX: Ensure number conversion */}
            <Text style={styles.summaryValue}>R {Number(order.subtotal || 0).toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            {/* FIX: Ensure number conversion */}
            <Text style={styles.summaryValue}>R {Number(order.delivery_fee || 0).toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax</Text>
            {/* FIX: Ensure number conversion */}
            <Text style={styles.summaryValue}>R {Number(order.tax_amount || 0).toFixed(2)}</Text>
          </View>
          
          {Number(order.tip_amount) > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tip</Text>
              <Text style={styles.summaryValue}>R {Number(order.tip_amount || 0).toFixed(2)}</Text>
            </View>
          )}
          
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            {/* FIX: Ensure number conversion */}
            <Text style={styles.totalValue}>R {Number(order.total_amount || 0).toFixed(2)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {['accepted_by_driver', 'order_ready', 'picked_up', 'on_the_way', 'arrived'].includes(order.status) && (
          <View style={styles.actionButtons}>
            <Button
              title="View Live Tracking"
              onPress={() => router.push(`/(customer)/orders/tracking?id=${order.id}`)}
              variant="primary"
              style={styles.actionButton}
            />
          </View>
        )}

        {order.status === 'delivered' && (
          <View style={styles.actionButtons}>
            <Button
              title="Reorder"
              onPress={() => {
                // Handle reorder
              }}
              variant="primary"
              style={styles.actionButton}
            />
            <Button
              title="Rate Order"
              onPress={() => {
                // Handle rating
              }}
              variant="outline"
              style={styles.actionButton}
            />
          </View>
        )}
      </ScrollView>

      {/* Paystack Checkout Modal */}
      <Modal
        visible={paystackModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaystackModalVisible(false)}
      >
        <View style={styles.psModalOverlay}>
          <View style={styles.psModalCard}>
            {/* Paystack Header */}
            <View style={styles.psModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.paystackBadgeLogo}>
                  <Text style={styles.paystackBadgeLogoText}>P</Text>
                </View>
                <View>
                  <Text style={styles.psHeaderTitle}>Paystack Checkout</Text>
                  <Text style={styles.psHeaderEmail}>{paystackSession?.email || order.order_number}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.psHeaderPayLabel}>PAY</Text>
                <Text style={styles.psHeaderAmount}>
                  {paystackSession?.currency || 'ZAR'} {Number(order.total_amount || 0).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Reference bar */}
            <View style={styles.psRefBar}>
              <Text style={styles.psRefText}>Order: {order.order_number}</Text>
              <Text style={styles.psRefText}>Ref: {paystackSession?.reference?.slice(0, 18)}</Text>
            </View>

            <ScrollView style={styles.psModalBody} keyboardShouldPersistTaps="handled">
              {selectedPaymentMethod === 'card' && (
                <View>
                  <Text style={styles.psFieldLabel}>CARD NUMBER</Text>
                  <TextInput
                    style={styles.psInput}
                    value={cardNumber}
                    onChangeText={setCardNumber}
                    keyboardType="number-pad"
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                  />
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.psFieldLabel}>CARD EXPIRY</Text>
                      <TextInput
                        style={styles.psInput}
                        value={cardExpiry}
                        onChangeText={setCardExpiry}
                        placeholder="MM/YY"
                        maxLength={7}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.psFieldLabel}>CVV</Text>
                      <TextInput
                        style={styles.psInput}
                        value={cardCvv}
                        onChangeText={setCardCvv}
                        keyboardType="number-pad"
                        secureTextEntry
                        placeholder="123"
                        maxLength={4}
                      />
                    </View>
                  </View>
                </View>
              )}

              {selectedPaymentMethod === 'mobile_money' && (
                <View>
                  <Text style={styles.psFieldLabel}>SELECT YOUR BANK (PAYSTACK INSTANT EFT)</Text>
                  {['Capitec Bank', 'FNB', 'Standard Bank', 'Nedbank', 'ABSA', 'TymeBank'].map((bank) => (
                    <TouchableOpacity
                      key={bank}
                      style={[
                        styles.psBankRow,
                        selectedBank === bank && styles.psBankRowSelected,
                      ]}
                      onPress={() => setSelectedBank(bank)}
                    >
                      <Ionicons
                        name={selectedBank === bank ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={selectedBank === bank ? '#09A5DB' : colors.gray400}
                      />
                      <Text style={styles.psBankText}>{bank}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {selectedPaymentMethod === 'cash' && (
                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <Ionicons name="qr-code-outline" size={88} color="#011B33" />
                  <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
                    Pay with SnapScan, Zapper, or Masterpass via Paystack QR.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.psPayBtn, verifyingPaystack && { opacity: 0.65 }]}
                disabled={verifyingPaystack}
                onPress={() => handleCompletePaystackPayment(true)}
              >
                {verifyingPaystack ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.psPayBtnText}>
                    Pay {paystackSession?.currency || 'ZAR'} {Number(order.total_amount || 0).toFixed(2)}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.psBrowserBtn}
                onPress={handleOpenPaystackBrowser}
              >
                <Ionicons name="open-outline" size={16} color="#09A5DB" />
                <Text style={styles.psBrowserBtnText}>
                  Open Hosted Paystack Checkout in Browser
                </Text>
              </TouchableOpacity>

              {paystackSession?.mode === 'live' || paystackSession?.mode === 'test' ? (
                <TouchableOpacity
                  style={styles.psVerifyLinkBtn}
                  onPress={() => handleCompletePaystackPayment(false)}
                >
                  <Text style={styles.psVerifyLinkText}>
                    Completed payment in browser? Tap to Verify Reference
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.psCancelBtn}
                onPress={() => setPaystackModalVisible(false)}
              >
                <Text style={styles.psCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.psModalFooter}>
              <Ionicons name="lock-closed" size={13} color="#64748B" />
              <Text style={styles.psFooterText}>Secured by Paystack</Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  errorTitle: {
    fontSize: 20,
    color: colors.error,
    marginTop: 20,
    marginBottom: 30,
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
  backButton: {
    padding: 4,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  timelineContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  timelineStep: {
    alignItems: 'center',
    flex: 1,
  },
  timelineLineContainer: {
    alignItems: 'center',
    width: '100%',
  },
  timelineLine: {
    position: 'absolute',
    top: 12,
    left: -50,
    right: 50,
    height: 2,
  },
  timelineLineActive: {
    backgroundColor: colors.primary,
  },
  timelineLineInactive: {
    backgroundColor: colors.gray200,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
  },
  timelineDotInactive: {
    backgroundColor: colors.gray100,
    borderWidth: 2,
    borderColor: colors.gray200,
  },
  timelineDotCurrent: {
    borderWidth: 3,
    borderColor: colors.primary + '40',
  },
  timelineLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  timelineLabelActive: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  timelineLabelInactive: {
    color: colors.textTertiary,
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  orderItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  itemDetails: {
    marginLeft: 8,
  },
  itemQuantity: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  itemInstructions: {
    fontSize: 14,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  detailContent: {
    flex: 1,
    marginLeft: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailSubtext: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  actionButtons: {
    padding: 20,
    backgroundColor: '#fff',
  },
  actionButton: {
    marginBottom: 12,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBannerTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  statusBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBannerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  paymentCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary,
    elevation: 3,
  },
  paymentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  paymentCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  paymentCardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  paymentMethodChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F9FAFB',
  },
  paymentMethodChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
  },
  paymentMethodChipText: {
    marginLeft: 6,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  paymentMethodChipTextSelected: {
    color: '#09A5DB',
    fontWeight: '700',
  },
  paystackBadgeLogo: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#09A5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paystackBadgeLogoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  psModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  psModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    maxHeight: '88%',
  },
  psModalHeader: {
    backgroundColor: '#011B33',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  psHeaderTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  psHeaderEmail: {
    color: '#94A3B8',
    fontSize: 12,
  },
  psHeaderPayLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  psHeaderAmount: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '800',
  },
  psRefBar: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  psRefText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  psModalBody: {
    padding: 20,
  },
  psFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  psInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 14,
  },
  psBankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    gap: 10,
  },
  psBankRowSelected: {
    borderColor: '#09A5DB',
    backgroundColor: '#F0F9FF',
  },
  psBankText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  psPayBtn: {
    backgroundColor: '#3BB75E',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  psPayBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  psBrowserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  psBrowserBtnText: {
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '700',
  },
  psVerifyLinkBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  psVerifyLinkText: {
    color: '#09A5DB',
    fontSize: 12.5,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  psCancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  psCancelBtnText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  psModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  psFooterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
});