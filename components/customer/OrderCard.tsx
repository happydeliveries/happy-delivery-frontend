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
import { customerColors as colors } from '../../constants/customerTheme';

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
  items_count?: number;
  items_summary?: string | null;
  first_item_image?: string | null;
}

interface OrderCardProps {
  order: CustomerOrderSummary;
  actionLabel?: string;
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

const TRACKING_STATUS_SET = new Set([
  'accepted_by_driver',
  'picked_up',
  'on_the_way',
  'arrived',
]);

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
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';

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

const getStatusAppearance = (status: string, paymentStatus?: string) => {
  switch (status) {
    case 'delivered':
      return {
        label: 'Delivered',
        icon: 'checkmark-circle' as const,
        bg: '#ECFDF5',
        text: '#047857',
        border: '#A7F3D0',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        icon: 'close-circle' as const,
        bg: '#FEF2F2',
        text: '#DC2626',
        border: '#FECACA',
      };
    case 'no_drivers_available':
      return {
        label: 'No Drivers',
        icon: 'alert-circle' as const,
        bg: '#FEF2F2',
        text: '#DC2626',
        border: '#FECACA',
      };
    case 'delivery_failed':
      return {
        label: 'Failed',
        icon: 'close-circle' as const,
        bg: '#FEF2F2',
        text: '#DC2626',
        border: '#FECACA',
      };
    case 'pending':
      return {
        label: 'Pending',
        icon: 'time' as const,
        bg: '#FFFBEB',
        text: '#B45309',
        border: '#FDE68A',
      };
    case 'ordering_at_restaurant':
      if (paymentStatus === 'completed') {
        return {
          label: 'Finding Driver',
          icon: 'car' as const,
          bg: '#EFF6FF',
          text: '#1D4ED8',
          border: '#BFDBFE',
        };
      }
      return {
        label: 'Ready to Pay',
        icon: 'card' as const,
        bg: colors.primarySoft,
        text: colors.primaryText,
        border: colors.primaryBorder,
      };
    case 'order_ready':
      return {
        label: 'Ready',
        icon: 'bag-check' as const,
        bg: '#EFF6FF',
        text: '#1D4ED8',
        border: '#BFDBFE',
      };
    case 'accepted_by_driver':
      return {
        label: 'Driver Assigned',
        icon: 'car' as const,
        bg: '#EFF6FF',
        text: '#1D4ED8',
        border: '#BFDBFE',
      };
    case 'picked_up':
      return {
        label: 'Picked Up',
        icon: 'bicycle' as const,
        bg: '#ECFDF5',
        text: '#047857',
        border: '#A7F3D0',
      };
    case 'on_the_way':
      return {
        label: 'On the Way',
        icon: 'navigate' as const,
        bg: '#ECFDF5',
        text: '#047857',
        border: '#A7F3D0',
      };
    case 'arrived':
      return {
        label: 'Arrived',
        icon: 'location' as const,
        bg: '#ECFDF5',
        text: '#047857',
        border: '#A7F3D0',
      };
    default:
      return {
        label: status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        icon: 'restaurant' as const,
        bg: '#F3F4F6',
        text: colors.textSecondary,
        border: '#E5E7EB',
      };
  }
};

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  actionLabel,
  onPress,
  onActionPress,
}) => {
  const logoUri =
    resolveOrderMediaUrl(order.restaurant_logo) ||
    resolveOrderMediaUrl(order.restaurant_cover);
  const itemThumbUri = resolveOrderMediaUrl(order.first_item_image);

  const [logoFailed, setLogoFailed] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoUri]);

  useEffect(() => {
    setThumbFailed(false);
  }, [itemThumbUri]);

  const statusMeta = getStatusAppearance(order.status, order.payment_status);
  const isActive = ACTIVE_STATUS_SET.has(order.status);
  const needsPayment =
    order.status === 'ordering_at_restaurant' && order.payment_status !== 'completed';
  const isTracking = TRACKING_STATUS_SET.has(order.status);
  const isPrimaryAction = needsPayment || isTracking;

  const resolvedActionLabel =
    actionLabel ??
    (needsPayment
      ? 'Pay Now'
      : order.status === 'picked_up'
      ? 'Track Driver'
      : isTracking
      ? 'Track Order'
      : 'View Order');

  const formattedTime = formatOrderTimestamp(order.placed_at || order.created_at);
  const shortOrderRef = order.order_number ? `#${order.order_number}` : '';
  const metaLine = [formattedTime, shortOrderRef].filter(Boolean).join('  •  ');
  const itemsCount = Number(order.items_count || 0);
  const itemsSummary = String(order.items_summary || '').trim();
  const hasItemsInfo = itemsSummary.length > 0 || itemsCount > 0;

  return (
    <TouchableOpacity
      style={[styles.container, isActive && styles.containerActive]}
      onPress={onPress ?? onActionPress}
      activeOpacity={0.92}
    >
      {/* Header: Restaurant Logo + Name + Status Pill */}
      <View style={styles.header}>
        <View style={styles.logoWrapper}>
          {logoUri && !logoFailed ? (
            <Image
              source={{ uri: logoUri }}
              style={styles.logoImage}
              resizeMode="cover"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.logoInitials}>
                {getRestaurantInitials(order.restaurant_name)}
              </Text>
            </View>
          )}
          {isActive && <View style={styles.liveCornerDot} />}
        </View>

        <View style={styles.headerTextCol}>
          <View style={styles.titleStatusRow}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {order.restaurant_name || 'Restaurant'}
            </Text>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: statusMeta.bg,
                  borderColor: statusMeta.border,
                },
              ]}
            >
              <Ionicons name={statusMeta.icon} size={12} color={statusMeta.text} />
              <Text style={[styles.statusText, { color: statusMeta.text }]} numberOfLines={1}>
                {statusMeta.label}
              </Text>
            </View>
          </View>

          {!!metaLine && (
            <Text style={styles.metaLine} numberOfLines={1}>
              {metaLine}
            </Text>
          )}
        </View>
      </View>

      {/* Item Preview Strip */}
      {hasItemsInfo && (
        <View style={styles.itemsStrip}>
          {itemThumbUri && !thumbFailed ? (
            <Image
              source={{ uri: itemThumbUri }}
              style={styles.itemThumb}
              resizeMode="cover"
              onError={() => setThumbFailed(true)}
            />
          ) : (
            <View style={styles.itemIconBox}>
              <Ionicons name="fast-food-outline" size={14} color={colors.textSecondary} />
            </View>
          )}

          <Text style={styles.itemsSummaryText} numberOfLines={2}>
            {itemsSummary || `${itemsCount} ${itemsCount === 1 ? 'item' : 'items'} ordered`}
          </Text>

          {itemsCount > 0 && (
            <View style={styles.itemCountPill}>
              <Text style={styles.itemCountText}>
                {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Assigned Driver Chip */}
      {!!order.driver_first_name && (
        <View style={styles.driverRow}>
          <Ionicons name="car-sport-outline" size={14} color={colors.primaryText} />
          <Text style={styles.driverName} numberOfLines={1}>
            Courier: {order.driver_first_name} {order.driver_last_name || ''}
          </Text>
        </View>
      )}

      {/* Footer: Total + Action CTA */}
      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>
            {order.payment_status === 'completed' ? 'Total Paid' : 'Order Total'}
          </Text>
          <Text style={styles.totalAmount}>R {Number(order.total_amount || 0).toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            isPrimaryAction ? styles.actionBtnPrimary : styles.actionBtnSecondary,
          ]}
          onPress={onActionPress ?? onPress}
          activeOpacity={0.82}
          disabled={!onActionPress && !onPress}
        >
          {needsPayment && (
            <Ionicons name="card-outline" size={14} color={colors.onPrimary} />
          )}
          {isTracking && (
            <Ionicons name="navigate" size={14} color={colors.onPrimary} />
          )}
          <Text
            style={[
              styles.actionBtnText,
              isPrimaryAction ? styles.actionBtnTextPrimary : styles.actionBtnTextSecondary,
            ]}
          >
            {resolvedActionLabel}
          </Text>
          {!isPrimaryAction && (
            <Ionicons name="chevron-forward" size={14} color={colors.textPrimary} />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  containerActive: {
    borderColor: colors.primaryBorder,
    shadowOpacity: 0.07,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoWrapper: {
    position: 'relative',
    width: 48,
    height: 48,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  logoFallback: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInitials: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.onPrimary,
    letterSpacing: -0.4,
  },
  liveCornerDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  headerTextCol: {
    flex: 1,
    gap: 5,
  },
  titleStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  restaurantName: {
    flex: 1,
    fontSize: 16.5,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  metaLine: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500',
  },
  itemsStrip: {
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderCurve: 'continuous',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  itemThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  itemIconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsSummaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 17,
  },
  itemCountPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  driverRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  driverName: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  footer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalContainer: {
    gap: 1,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  totalAmount: {
    fontSize: 17.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  actionBtnPrimary: {
    backgroundColor: colors.primary,
  },
  actionBtnSecondary: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnTextPrimary: {
    color: colors.onPrimary,
  },
  actionBtnTextSecondary: {
    color: colors.textPrimary,
  },
});

export default OrderCard;
