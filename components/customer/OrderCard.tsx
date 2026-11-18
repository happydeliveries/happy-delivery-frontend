import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_CONFIG } from '../../constants/api';

const SWAP_DRIVER_AND_RESTAURANT_IMAGES = false;

export interface CustomerOrderSummary {
  id: string;
  order_number: string;
  status: string;
  payment_status?: string;
  total_amount: number;
  placed_at?: string;
  created_at?: string;
  restaurant_name: string;
  restaurant_logo?: string | null;
  restaurant_cover?: string | null;
  restaurant_address?: string | null;
  driver_first_name?: string | null;
  driver_last_name?: string | null;
  driver_image?: string | null;
  driver_vehicle_type?: string | null;
  rescue_courier?: {
    name?: string | null;
  } | null;
  items_count?: number;
  items_summary?: string | null;
  first_item_image?: string | null;
}

interface OrderCardProps {
  order: CustomerOrderSummary;
  actionLabel?: string;
  swapImages?: boolean;
  onPress?: () => void;
  onActionPress?: () => void;
}

export const resolveOrderMediaUrl = (raw?: string | null): string | null => {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `${API_CONFIG.BASE_URL}${trimmed}`;
  }
  return `${API_CONFIG.BASE_URL}/${trimmed}`;
};

const ACTIVE_STATUS_SET = new Set([
  'pending',
  'ordering_at_restaurant',
  'order_ready',
  'accepted_by_driver',
  'picked_up',
  'on_the_way',
  'arrived',
]);

const CANCELLED_OR_FAILED_SET = new Set([
  'cancelled',
  'no_drivers_available',
  'delivery_failed',
]);

const STEP_LABELS = ['Placed', 'Preparing', 'On Way', 'Delivered'] as const;

const getRestaurantInitials = (name?: string) => {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'HD';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const formatOrderTimestamp = (raw?: string) => {
  if (!raw) return 'Recent';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Recent';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (diffDays === 0) return `Today • ${timePart}`;
  if (diffDays === 1) return `Yesterday • ${timePart}`;

  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
  return `${datePart} • ${timePart}`;
};

const getStatusBadgeConfig = (status: string) => {
  switch (status) {
    case 'delivered':
      return {
        label: 'Delivered',
        icon: 'checkmark-circle' as const,
        bg: '#DCFCE7',
        text: '#15803D',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        icon: 'close-circle' as const,
        bg: '#FEE2E2',
        text: '#DC2626',
      };
    case 'no_drivers_available':
      return {
        label: 'No Drivers',
        icon: 'alert-circle' as const,
        bg: '#FEE2E2',
        text: '#DC2626',
      };
    case 'delivery_failed':
      return {
        label: 'Failed',
        icon: 'close-circle' as const,
        bg: '#FEE2E2',
        text: '#DC2626',
      };
    default:
      return {
        label: 'Active',
        icon: 'time' as const,
        bg: '#FFF7ED',
        text: '#EA580C',
      };
  }
};

const getTrackerConfig = (status: string) => {
  if (status === 'delivered') {
    return {
      mode: 'delivered' as const,
      completedUpTo: 3,
      floatingIndex: -1,
      floatingLabel: '',
    };
  }
  if (CANCELLED_OR_FAILED_SET.has(status)) {
    return {
      mode: 'error' as const,
      completedUpTo: 0,
      floatingIndex: -1,
      floatingLabel: '',
    };
  }

  let floatingLabel = 'On Way';
  if (status === 'pending') floatingLabel = 'Placed';
  else if (status === 'ordering_at_restaurant') floatingLabel = 'Preparing';
  else if (status === 'order_ready') floatingLabel = 'Ready';
  else if (status === 'accepted_by_driver') floatingLabel = 'Assigned';
  else if (status === 'arrived') floatingLabel = 'Arrived';

  return {
    mode: 'active' as const,
    completedUpTo: 2,
    floatingIndex: 2,
    floatingLabel,
  };
};

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  swapImages,
  onPress,
  onActionPress,
}) => {
  const restaurantUri =
    resolveOrderMediaUrl(order.restaurant_logo) ||
    resolveOrderMediaUrl(order.restaurant_cover);
  const driverUri = resolveOrderMediaUrl(order.driver_image);

  const [driverFailed, setDriverFailed] = useState(false);
  const [restaurantFailed, setRestaurantFailed] = useState(false);

  useEffect(() => {
    setDriverFailed(false);
  }, [driverUri]);

  useEffect(() => {
    setRestaurantFailed(false);
  }, [restaurantUri]);

  const shouldSwapImages = Boolean(swapImages || SWAP_DRIVER_AND_RESTAURANT_IMAGES);
  const avatarKind = shouldSwapImages ? 'restaurant' : 'driver';
  const featuredKind = shouldSwapImages ? 'driver' : 'restaurant';

  const avatarUri = avatarKind === 'driver' ? driverUri : restaurantUri;
  const avatarFailed = avatarKind === 'driver' ? driverFailed : restaurantFailed;
  const onAvatarError = () =>
    avatarKind === 'driver' ? setDriverFailed(true) : setRestaurantFailed(true);

  const featuredUri = featuredKind === 'restaurant' ? restaurantUri : driverUri;
  const featuredFailed = featuredKind === 'restaurant' ? restaurantFailed : driverFailed;
  const onFeaturedError = () =>
    featuredKind === 'restaurant' ? setRestaurantFailed(true) : setDriverFailed(true);

  const courierName =
    String(order.rescue_courier?.name || '').trim() ||
    [order.driver_first_name, order.driver_last_name].filter(Boolean).join(' ').trim();

  const itemsCount = Number(order.items_count || 0);
  const itemsSummary = String(order.items_summary || '').trim();
  const itemCountText = itemsCount > 0 ? `${itemsCount} ${itemsCount === 1 ? 'item' : 'items'}` : '';
  const itemsSubtitle = [itemsSummary, itemCountText].filter(Boolean).join(' • ') || 'Order items';

  const shortOrderId = order.order_number
    ? `ID: #${order.order_number}`
    : `ID: #${String(order.id || '').slice(0, 8).toUpperCase()}`;

  const statusBadge = getStatusBadgeConfig(order.status);
  const tracker = getTrackerConfig(order.status);
  const formattedTime = formatOrderTimestamp(order.placed_at || order.created_at);
  const totalLabel = order.payment_status === 'completed' ? 'Total Paid' : 'Order Total';
  const isActive = ACTIVE_STATUS_SET.has(order.status);

  const isDriverCar = String(order.driver_vehicle_type || '').toLowerCase().includes('car');

  const renderFallbackIcon = (kind: 'driver' | 'restaurant', size: number) => {
    if (kind === 'driver') {
      return (
        <View style={styles.driverFallbackInner}>
          <Ionicons
            name={courierName ? 'person' : isDriverCar ? 'car-outline' : 'car-sport-outline'}
            size={size}
            color="#6B7280"
          />
        </View>
      );
    }
    return (
      <View style={styles.restaurantFallbackInner}>
        <Text style={[styles.restaurantInitials, size >= 28 && styles.restaurantInitialsLarge]}>
          {getRestaurantInitials(order.restaurant_name)}
        </Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress ?? onActionPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${shortOrderId}, ${statusBadge.label}`}
    >
      {/* Top Row: Circular Avatar + Order ID/Items/Courier + Status Pill */}
      <View style={styles.topRow}>
        <View style={styles.avatarCircle}>
          {avatarUri && !avatarFailed ? (
            <Image
              source={{ uri: avatarUri }}
              style={styles.fillImage}
              resizeMode="cover"
              onError={onAvatarError}
            />
          ) : (
            renderFallbackIcon(avatarKind, 21)
          )}
        </View>

        <View style={styles.titleStack}>
          <Text style={styles.orderIdText} numberOfLines={1}>
            {shortOrderId}
          </Text>
          <Text style={styles.itemsSubtitleText} numberOfLines={1}>
            {itemsSubtitle}
          </Text>
          {!!courierName && (
            <Text style={styles.courierSubtitleText} numberOfLines={1}>
              Courier: {courierName}
            </Text>
          )}
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
          <Ionicons name={statusBadge.icon} size={12} color={statusBadge.text} />
          <Text style={[styles.statusBadgeText, { color: statusBadge.text }]} numberOfLines={1}>
            {statusBadge.label}
          </Text>
        </View>
      </View>

      {/* Lower Body: Left (~68%) Tracker + Metadata | Right (~32%) Featured Image */}
      <View style={styles.lowerBody}>
        <View style={styles.leftColumn}>
          {/* 4-Node Horizontal Dotted Progress Tracker */}
          <View style={[styles.stepperWrap, isActive && styles.stepperWrapWithLabel]}>
            {STEP_LABELS.map((stepLabel, idx) => {
              const isErrorNode = tracker.mode === 'error' && idx === 0;
              const isCompletedOrActive =
                tracker.mode !== 'error' && idx <= tracker.completedUpTo;
              const isFloatingHere =
                tracker.mode === 'active' && idx === tracker.floatingIndex;
              const connectorActive =
                tracker.mode !== 'error' && idx < tracker.completedUpTo;

              return (
                <React.Fragment key={stepLabel}>
                  <View style={styles.nodeSlot}>
                    {isFloatingHere && (
                      <View style={styles.floatingAnchor} pointerEvents="none">
                        <View style={styles.floatingTag}>
                          <Ionicons name="car-outline" size={11} color="#F97316" />
                          <Text style={styles.floatingTagText} numberOfLines={1}>
                            {tracker.floatingLabel}
                          </Text>
                        </View>
                      </View>
                    )}

                    <View
                      style={[
                        styles.nodeOuter,
                        isCompletedOrActive && styles.nodeOuterOrange,
                        isErrorNode && styles.nodeOuterError,
                      ]}
                    >
                      <View
                        style={[
                          styles.nodeDot,
                          isCompletedOrActive && styles.nodeDotOrange,
                          isErrorNode && styles.nodeDotError,
                        ]}
                      >
                        {isCompletedOrActive && (
                          <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                        )}
                        {isErrorNode && (
                          <Ionicons name="close" size={10} color="#FFFFFF" />
                        )}
                      </View>
                    </View>
                  </View>

                  {idx < STEP_LABELS.length - 1 && (
                    <View style={styles.dottedTrack}>
                      {[0, 1, 2, 3, 4].map((dotIdx) => (
                        <View
                          key={dotIdx}
                          style={[
                            styles.trackDot,
                            connectorActive && styles.trackDotOrange,
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* Bottom Two-Column Info Row */}
          <View style={styles.metaRow}>
            <View style={styles.metaColLeft}>
              <Text style={styles.metaLabel} numberOfLines={1}>
                {formattedTime}
              </Text>
              <Text style={styles.restaurantValue} numberOfLines={1}>
                {order.restaurant_name || 'Restaurant'}
              </Text>
            </View>

            <View style={styles.metaColRight}>
              <Text style={styles.metaTotalLabel} numberOfLines={1}>
                {totalLabel}
              </Text>
              <Text style={styles.priceValue} numberOfLines={1}>
                R {Number(order.total_amount || 0).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.rightColumn}>
          <View style={styles.featuredImageBox}>
            {featuredUri && !featuredFailed ? (
              <Image
                source={{ uri: featuredUri }}
                style={styles.fillImage}
                resizeMode="cover"
                onError={onFeaturedError}
              />
            ) : (
              renderFallbackIcon(featuredKind, 28)
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEF0F4',
    boxShadow: '0 4px 14px rgba(17, 24, 39, 0.06)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  fillImage: {
    width: '100%',
    height: '100%',
  },
  driverFallbackInner: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantFallbackInner: {
    flex: 1,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantInitials: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  restaurantInitialsLarge: {
    fontSize: 24,
  },
  titleStack: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  itemsSubtitleText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  courierSubtitleText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  lowerBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 14,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 14,
    justifyContent: 'space-between',
  },
  rightColumn: {
    width: 92,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  featuredImageBox: {
    width: 92,
    height: 92,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 14,
  },
  stepperWrapWithLabel: {
    paddingTop: 20,
  },
  nodeSlot: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  floatingAnchor: {
    position: 'absolute',
    bottom: 24,
    left: -31,
    width: 84,
    alignItems: 'center',
  },
  floatingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  floatingTagText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#EA580C',
  },
  nodeOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeOuterOrange: {
    backgroundColor: '#FFEDD5',
  },
  nodeOuterError: {
    backgroundColor: '#FEE2E2',
  },
  nodeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDotOrange: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F97316',
  },
  nodeDotError: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  dottedTrack: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 2,
  },
  trackDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: '#E5E7EB',
  },
  trackDotOrange: {
    backgroundColor: '#F97316',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaColLeft: {
    flex: 1,
  },
  metaColRight: {
    alignItems: 'flex-start',
  },
  metaLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  metaTotalLabel: {
    fontSize: 10.5,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  restaurantValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 2,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});

export default OrderCard;
