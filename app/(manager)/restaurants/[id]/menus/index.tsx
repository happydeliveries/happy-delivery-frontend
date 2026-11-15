import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  Alert, 
  ActivityIndicator, 
  LayoutAnimation, 
  Platform, 
  UIManager 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../../../../constants/colors';
import { managerService } from '../../../../../services/manager';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function MenuManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      fetchMenus();
    }, [])
  );

  const fetchMenus = async () => {
    try {
      const response: any = await managerService.getRestaurantMenus(id);
      const menus = response.data || [];
      setCategories(menus);
      
      // Auto-expand the first category for better UX
      if (menus.length > 0 && expandedCategoryIds.size === 0) {
        setExpandedCategoryIds(new Set([menus[0].id]));
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load menus');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newExpanded = new Set(expandedCategoryIds);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategoryIds(newExpanded);
  };

  const handleDeleteItem = (itemId: string, itemName: string) => {
    Alert.alert(
      "Delete Item",
      `Are you sure you want to delete "${itemName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => console.log("Delete item logic here") }
      ]
    );
  };

  const renderFoodItem = (item: any, categoryId: string) => (
    <TouchableOpacity 
      key={item.id} 
      style={styles.foodItemCard}
      onPress={() => router.push(`/(manager)/restaurants/${id}/menus/${categoryId}/items/${item.id}/edit` as any)}
    >
      <View style={styles.foodImageContainer}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.foodImage} />
        ) : (
          <View style={styles.foodPlaceholder}>
            <Ionicons name="fast-food-outline" size={24} color={colors.gray400} />
          </View>
        )}
      </View>
      
      <View style={styles.foodContent}>
        <View style={styles.foodHeader}>
          <Text style={styles.foodName}>{item.name}</Text>
          <Text style={styles.foodPrice}>R{Number(item.price).toFixed(2)}</Text>
        </View>
        
        <Text style={styles.foodDesc} numberOfLines={2}>{item.description}</Text>
        
        <View style={styles.foodFooter}>
          <View style={styles.tagsContainer}>
            {!item.is_available && (
              <View style={styles.badgeUnavailable}>
                <Text style={styles.badgeTextUnavailable}>Sold Out</Text>
              </View>
            )}
            {item.is_veg && (
              <View style={styles.badgeVeg}>
                <Text style={styles.badgeTextVeg}>Veg</Text>
              </View>
            )}
          </View>
          
          <View style={styles.foodActions}>
            <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleDeleteItem(item.id, item.name)}>
              <Feather name="trash-2" size={16} color={colors.error} />
            </TouchableOpacity>
            <Feather name="chevron-right" size={16} color={colors.gray400} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCategory = ({ item }: { item: any }) => {
    const isExpanded = expandedCategoryIds.has(item.id);
    const itemCount = item.items ? item.items.length : 0;

    return (
      <View style={styles.categoryCard}>
        {/* Category Header (Clickable) */}
        <TouchableOpacity 
          style={[styles.categoryHeader, isExpanded && styles.categoryHeaderExpanded]} 
          onPress={() => toggleCategory(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryTitle}>{item.name}</Text>
            <Text style={styles.categorySubtitle}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.headerActionBtn}
              onPress={(e) => {
                e.stopPropagation();
                Alert.alert("Manage Category", "Edit or Delete this category options would go here.");
              }}
            >
              <Feather name="more-horizontal" size={20} color={colors.gray500} />
            </TouchableOpacity>
            <View style={styles.chevronBox}>
              <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Category Body (Items) */}
        {isExpanded && (
          <View style={styles.categoryBody}>
            {item.description ? (
              <Text style={styles.categoryDesc}>{item.description}</Text>
            ) : null}

            {item.items && item.items.length > 0 ? (
              item.items.map((food: any) => renderFoodItem(food, item.id))
            ) : (
              <View style={styles.emptyCategory}>
                <Text style={styles.emptyCategoryText}>This category is empty.</Text>
                <Text style={styles.emptyCategorySub}>Add delicious items to sell.</Text>
              </View>
            )}

            {/* Add Item Button inside Category */}
            <TouchableOpacity 
              style={styles.addItemBtn}
              onPress={() => router.push(`/(manager)/restaurants/${id}/menus/${item.id}/add-item`)}
            >
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <Text style={styles.addItemText}>Add Item to {item.name}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Menu Management</Text>
        <TouchableOpacity 
          style={styles.addCategoryHeaderBtn}
          onPress={() => router.push(`/(manager)/restaurants/${id}/menus/create`)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {categories.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <MaterialCommunityIcons name="silverware-clean" size={60} color={colors.gray300} />
          </View>
          <Text style={styles.emptyText}>No Categories Yet</Text>
          <Text style={styles.subEmpty}>Organize your menu by creating sections like "Breakfast", "Mains", or "Drinks".</Text>
          <TouchableOpacity 
            style={styles.createBtn}
            onPress={() => router.push(`/(manager)/restaurants/${id}/menus/create`)}
          >
            <Text style={styles.createBtnText}>Create First Category</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Header
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#F0F0F0',
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2
  },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  addCategoryHeaderBtn: { 
    backgroundColor: colors.primary, 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 2
  },

  listContent: { padding: 16 },

  // Category Card
  categoryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    overflow: 'hidden'
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff'
  },
  categoryHeaderExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  categoryInfo: { flex: 1 },
  categoryTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  categorySubtitle: { fontSize: 12, color: colors.textTertiary, fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerActionBtn: { padding: 8, marginRight: 4 },
  chevronBox: { 
    width: 32, height: 32, 
    backgroundColor: colors.primary + '10', 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  // Category Body
  categoryBody: { backgroundColor: '#FBFCFD' },
  categoryDesc: { paddingHorizontal: 16, paddingTop: 12, fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
  
  // Food Item
  foodItemCard: {
    flexDirection: 'row',
    padding: 12,
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  foodImageContainer: { marginRight: 12 },
  foodImage: { width: 70, height: 70, borderRadius: 10 },
  foodPlaceholder: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  foodContent: { flex: 1, justifyContent: 'space-between' },
  foodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  foodName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flex: 1, marginRight: 8 },
  foodPrice: { fontSize: 14, fontWeight: '700', color: colors.primary },
  foodDesc: { fontSize: 12, color: colors.textTertiary, marginTop: 2, marginBottom: 6 },
  
  foodFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagsContainer: { flexDirection: 'row' },
  badgeUnavailable: { backgroundColor: colors.error + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 6 },
  badgeTextUnavailable: { fontSize: 10, fontWeight: 'bold', color: colors.error },
  badgeVeg: { backgroundColor: colors.success + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeTextVeg: { fontSize: 10, fontWeight: 'bold', color: colors.success },
  
  foodActions: { flexDirection: 'row', alignItems: 'center' },
  actionIconBtn: { padding: 6, marginRight: 4 },

  // Empty Category State
  emptyCategory: { alignItems: 'center', padding: 24 },
  emptyCategoryText: { fontSize: 14, color: colors.gray500, fontWeight: '600' },
  emptyCategorySub: { fontSize: 12, color: colors.gray400, marginTop: 4 },

  // Add Item Button inside Category
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed'
  },
  addItemText: { marginLeft: 8, color: colors.primary, fontWeight: '600', fontSize: 14 },

  // Global Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', flex: 1, padding: 30, marginTop: 60 },
  emptyIconContainer: { width: 100, height: 100, backgroundColor: '#fff', borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 },
  subEmpty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 30, lineHeight: 20 },
  createBtn: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 30, elevation: 4, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  createBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});