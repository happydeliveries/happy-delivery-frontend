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

interface RestaurantCardProps {
  restaurant: {
    id: string;
    name: string;
    description?: string;
    cuisine_type?: string[];
    address?: string;
    distance_meters?: number;
    average_rating?: number;
    logo_url?: string;
    is_accepting_orders?: boolean;
    availability_status?: string;
  };
  onPress: () => void;
}

const RestaurantCard: React.FC<RestaurantCardProps> = ({ restaurant, onPress }) => {
  const getDistanceText = () => {
    if (!restaurant.distance_meters) return '';
    if (restaurant.distance_meters < 1000) {
      return `${Math.round(restaurant.distance_meters)}m away`;
    }
    return `${(restaurant.distance_meters / 1000).toFixed(1)}km away`;
  };

  const getStatusColor = () => {
    if (!restaurant.is_accepting_orders) return colors.error;
    if (restaurant.availability_status === 'out_of_range') return colors.warning;
    return colors.success;
  };

  const getStatusText = () => {
    if (!restaurant.is_accepting_orders) return 'Closed';
    if (restaurant.availability_status === 'out_of_range') return 'Out of range';
    return 'Open';
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.imageContainer}>
        {restaurant.logo_url ? (
          <Image
            source={{ uri: restaurant.logo_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Feather name="coffee" size={32} color={colors.gray400} />
          </View>
        )}
        
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
          
          {restaurant.average_rating && (
            <View style={styles.ratingContainer}>
              <Feather name="star" size={14} color={colors.warning} />
              <Text style={styles.ratingText}>
                {restaurant.average_rating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>
        
        {/* FIX: Use Optional Chaining (?.) and check for array length to prevent crashes */}
        {restaurant.cuisine_type && restaurant.cuisine_type.length > 0 ? (
          <Text style={styles.cuisine} numberOfLines={1}>
            {Array.isArray(restaurant.cuisine_type) 
              ? restaurant.cuisine_type.join(', ') 
              : restaurant.cuisine_type}
          </Text>
        ) : (
          <Text style={styles.cuisine}>General</Text> 
        )}
        
        {restaurant.description && (
          <Text style={styles.description} numberOfLines={2}>
            {restaurant.description}
          </Text>
        )}
        
        <View style={styles.footer}>
          {restaurant.distance_meters && (
            <View style={styles.distanceContainer}>
              <Feather name="map-pin" size={14} color={colors.primary} />
              <Text style={styles.distanceText}>{getDistanceText()}</Text>
            </View>
          )}
          
          {restaurant.address && (
            <Text style={styles.address} numberOfLines={1}>
              {restaurant.address}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ... Styles remain identical to your original file ...
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  imageContainer: { height: 150, position: 'relative' },
  image: { width: '100%', height: '100%' },
  placeholderImage: { width: '100%', height: '100%', backgroundColor: colors.gray100, justifyContent: 'center', alignItems: 'center' },
  statusBadge: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  content: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  name: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, flex: 1, marginRight: 8 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray100, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  ratingText: { fontSize: 12, fontWeight: '600', color: colors.gray700, marginLeft: 4 },
  cuisine: { fontSize: 14, color: colors.primary, fontWeight: '500', marginBottom: 8 },
  description: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  distanceContainer: { flexDirection: 'row', alignItems: 'center' },
  distanceText: { fontSize: 12, color: colors.textTertiary, marginLeft: 4 },
  address: { fontSize: 12, color: colors.textTertiary, flex: 1, marginLeft: 12, textAlign: 'right' },
});

export default RestaurantCard;