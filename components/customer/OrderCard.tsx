import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

interface OrderCardProps {
  order: {
    id: string;
    order_number: string;
    status: string;
    payment_status?: string;
    total_amount: number;
    placed_at: string;
    restaurant_name: string;
    driver_first_name?: string;
    driver_last_name?: string;
  };
  actionLabel?: string;
  onActionPress?: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, actionLabel, onActionPress }) => {
  const getStatusIcon = (status: string, paymentStatus?: string) => {
    switch (status) {
      case 'delivered':
        return 'checkmark-circle';
      case 'cancelled':
      case 'no_drivers_available':
        return 'close-circle';
      case 'pending':
        return 'time';
      case 'ordering_at_restaurant':
        return paymentStatus === 'completed' ? 'car' : 'card';
      case 'accepted_by_driver':
        return 'car';
      case 'on_the_way':
        return 'navigate';
      default:
        return 'restaurant';
    }
  };

  const getStatusColor = (status: string, paymentStatus?: string) => {
    switch (status) {
      case 'delivered':
        return colors.success;
      case 'cancelled':
      case 'no_drivers_available':
        return colors.error;
      case 'pending':
        return colors.warning;
      case 'ordering_at_restaurant':
        return paymentStatus === 'completed' ? colors.info : colors.primary;
      case 'accepted_by_driver':
        return colors.info;
      default:
        return colors.info;
    }
  };

  const getStatusText = (status: string, paymentStatus?: string) => {
    if (status === 'pending') return 'Awaiting Approval';
    if (status === 'ordering_at_restaurant') {
      return paymentStatus === 'completed' ? 'Paid • Finding Driver' : 'Accepted • Ready to Pay';
    }
    if (status === 'cancelled') return 'Rejected / Cancelled';
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>{order.order_number}</Text>
          <Text style={styles.date}>{formatDate(order.placed_at)}</Text>
        </View>
        
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status, order.payment_status) + '20' }]}>
          <Ionicons 
            name={getStatusIcon(order.status, order.payment_status)} 
            size={14} 
            color={getStatusColor(order.status, order.payment_status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(order.status, order.payment_status) }]}>
            {getStatusText(order.status, order.payment_status)}
          </Text>
        </View>
      </View>
      
      <View style={styles.restaurantRow}>
        <Ionicons name="restaurant" size={16} color={colors.textTertiary} />
        <Text style={styles.restaurantName} numberOfLines={1}>
          {order.restaurant_name}
        </Text>
      </View>
      
      {order.driver_first_name && (
        <View style={styles.driverRow}>
          <Ionicons name="person" size={16} color={colors.textTertiary} />
          <Text style={styles.driverName}>
            Driver: {order.driver_first_name} {order.driver_last_name}
          </Text>
        </View>
      )}
      
      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>R {Number(order.total_amount || 0).toFixed(2)}</Text>
        </View>
        
        <TouchableOpacity
          style={styles.trackButton}
          onPress={onActionPress}
          activeOpacity={0.7}
          disabled={!onActionPress}
        >
          <Text style={styles.trackButtonText}>
            {actionLabel ?? (['accepted_by_driver', 'picked_up', 'on_the_way', 'arrived'].includes(order.status)
              ? 'Track Order'
              : 'View Details')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  restaurantName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalContainer: {},
  totalLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 4,
  },
});

export default OrderCard;