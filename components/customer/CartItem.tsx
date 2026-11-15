import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
} from 'react-native';
import { colors } from '../../constants/colors';
import { Feather } from '@expo/vector-icons';

interface CartItemProps {
  item: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
    specialInstructions?: string;
    selectedOptions?: Record<string, any>;
    allergenNotes?: string;
  };
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
}

const CartItem: React.FC<CartItemProps> = ({ item, onRemove, onQuantityChange }) => {
  const handleIncrease = () => {
    onQuantityChange(item.quantity + 1);
  };

  const handleDecrease = () => {
    if (item.quantity > 1) {
      onQuantityChange(item.quantity - 1);
    } else {
      onRemove();
    }
  };

  const getOptionsText = () => {
    if (!item.selectedOptions || typeof item.selectedOptions !== 'object') return '';
    return Object.entries(item.selectedOptions)
      .map(([key, value]) => {
        if (value == null || value === '') return '';
        if (Array.isArray(value)) {
          const listStr = value
            .map((v) => {
              if (typeof v === 'object' && v !== null) {
                const p = Number(v.price ?? v.priceDelta ?? 0);
                return `${v.name || v.label || ''}${p > 0 ? ` (+R${p.toFixed(2)})` : ''}`;
              }
              return String(v);
            })
            .filter(Boolean)
            .join(', ');
          return listStr ? `${key}: ${listStr}` : '';
        }
        if (typeof value === 'object') {
          const p = Number(value.price ?? value.priceDelta ?? 0);
          const name = value.name || value.label || '';
          return name ? `${key}: ${name}${p > 0 ? ` (+R${p.toFixed(2)})` : ''}` : '';
        }
        return `${key}: ${value}`;
      })
      .filter(Boolean)
      .join(' • ');
  };

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <Feather name="coffee" size={24} color={colors.gray400} />
          </View>
        )}
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <TouchableOpacity onPress={onRemove}>
            <Feather name="x" size={20} color={colors.gray400} />
          </TouchableOpacity>
        </View>
        
        {getOptionsText() ? (
          <Text style={styles.options} numberOfLines={3}>
            {getOptionsText()}
          </Text>
        ) : null}
        
        {item.specialInstructions && (
          <Text style={styles.instructions} numberOfLines={2}>
            Note: {item.specialInstructions}
          </Text>
        )}
        
        {item.allergenNotes && (
          <Text style={styles.allergenNotes} numberOfLines={1}>
            ⚠️ {item.allergenNotes}
          </Text>
        )}
        
        <View style={styles.footer}>
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={handleDecrease}
            >
              <Feather name="minus" size={16} color={colors.primary} />
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{item.quantity}</Text>
            
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={handleIncrease}
            >
              <Feather name="plus" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.price}>
            R{(item.price * item.quantity).toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  imageContainer: {
    width: 70,
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  options: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  instructions: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  allergenNotes: {
    fontSize: 12,
    color: colors.error,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quantityButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
});

export default CartItem;