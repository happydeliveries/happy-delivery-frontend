import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Button from '../common/Button';
import { colors } from '../../constants/colors';

export interface NormalizedOptionChoice {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
}

export interface NormalizedCustomizationGroup {
  id: string;
  name: string;
  required: boolean;
  type: 'single' | 'multiple';
  min_select: number;
  max_select: number;
  options: NormalizedOptionChoice[];
}

export function normalizeCustomizations(raw: any): NormalizedCustomizationGroup[] {
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];

  return list
    .map((g: any, gIdx: number) => {
      const type: 'single' | 'multiple' =
        g?.type === 'multiple' || Number(g?.max_select) > 1 ? 'multiple' : 'single';
      const options: NormalizedOptionChoice[] = Array.isArray(g?.options)
        ? g.options
            .map((opt: any, oIdx: number) => {
              if (typeof opt === 'string') {
                return {
                  id: `opt_${gIdx}_${oIdx}`,
                  name: opt,
                  price: 0,
                  is_available: true,
                };
              }
              return {
                id: opt?.id || `opt_${gIdx}_${oIdx}`,
                name: String(opt?.name || opt?.label || '').trim(),
                price: Number(opt?.price ?? opt?.priceDelta ?? 0) || 0,
                is_available: opt?.is_available !== false,
              };
            })
            .filter((o: NormalizedOptionChoice) => o.name.length > 0 && o.is_available)
        : [];

      return {
        id: g?.id || `grp_${gIdx}`,
        name: String(g?.name || '').trim(),
        required: Boolean(g?.required),
        type,
        min_select: g?.required ? 1 : 0,
        max_select: type === 'multiple' ? Math.max(1, Number(g?.max_select) || options.length || 1) : 1,
        options,
      };
    })
    .filter((g) => g.name.length > 0 && g.options.length > 0);
}

interface MenuItemProps {
  item: {
    id: string;
    name: string;
    description: string;
    price: number;
    discounted_price?: number;
    image_url?: string;
    category: string;
    tags: string[];
    ingredients: any[];
    customizations: any[];
    is_available: boolean;
    is_veg?: boolean;
    is_popular?: boolean;
    calories?: number;
    preparation_time_minutes?: number;
  };
  restaurantId: string;
  onAddToCart: (cartItem: any) => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ item, restaurantId, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, NormalizedOptionChoice[]>
  >({});

  const customizationGroups = useMemo(
    () => normalizeCustomizations(item.customizations),
    [item.customizations]
  );

  const handleIncrement = () => setQuantity((prev) => prev + 1);
  const handleDecrement = () => setQuantity((prev) => (prev > 1 ? prev - 1 : 1));

  const basePrice =
    item.discounted_price && Number(item.discounted_price) < Number(item.price)
      ? Number(item.discounted_price)
      : Number(item.price);

  const extraOptionsPrice = useMemo(() => {
    let sum = 0;
    Object.values(selectedOptions).forEach((choices) => {
      if (Array.isArray(choices)) {
        choices.forEach((c) => {
          sum += Number(c.price || 0);
        });
      }
    });
    return sum;
  }, [selectedOptions]);

  const unitPrice = basePrice + extraOptionsPrice;

  const handleToggleOption = (
    group: NormalizedCustomizationGroup,
    choice: NormalizedOptionChoice
  ) => {
    setSelectedOptions((prev) => {
      const current = prev[group.name] || [];
      const exists = current.some((c) => c.name === choice.name);

      if (group.type === 'single') {
        if (exists && !group.required) {
          const next = { ...prev };
          delete next[group.name];
          return next;
        }
        return {
          ...prev,
          [group.name]: [choice],
        };
      } else {
        if (exists) {
          const filtered = current.filter((c) => c.name !== choice.name);
          const next = { ...prev };
          if (filtered.length > 0) {
            next[group.name] = filtered;
          } else {
            delete next[group.name];
          }
          return next;
        } else {
          if (current.length >= group.max_select) {
            Alert.alert(
              'Maximum Reached',
              `You can select up to ${group.max_select} option${group.max_select > 1 ? 's' : ''} for "${group.name}".`
            );
            return prev;
          }
          return {
            ...prev,
            [group.name]: [...current, choice],
          };
        }
      }
    });
  };

  const handleAddToCart = () => {
    // Validate required option groups
    for (const group of customizationGroups) {
      const picked = selectedOptions[group.name] || [];
      if (group.required && picked.length === 0) {
        Alert.alert(
          'Required Selection',
          `Please choose an option for "${group.name}".`
        );
        return;
      }
    }

    onAddToCart({
      ...item,
      unitPrice,
      quantity,
      specialInstructions: specialInstructions.trim(),
      selectedOptions,
    });
    setModalVisible(false);
    setQuantity(1);
    setSpecialInstructions('');
    setSelectedOptions({});
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, !item.is_available && styles.unavailableContainer]}
        onPress={() => {
          if (item.is_available) {
            router.push({
              pathname: '/(customer)/menu/[id]',
              params: { id: item.id, restaurantId },
            });
          }
        }}
        disabled={!item.is_available}
      >
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <View style={styles.badgeRow}>
              {item.is_veg && (
                <View style={styles.vegBadge}>
                  <Ionicons name="leaf" size={11} color="#166534" />
                  <Text style={styles.vegBadgeText}>Veg</Text>
                </View>
              )}
              {item.is_popular && (
                <View style={styles.popularBadge}>
                  <Ionicons name="flame" size={11} color="#9a3412" />
                  <Text style={styles.popularBadgeText}>Popular</Text>
                </View>
              )}
              {customizationGroups.length > 0 && (
                <View style={styles.customizableBadge}>
                  <Ionicons name="options-outline" size={11} color={colors.primary} />
                  <Text style={styles.customizableBadgeText}>Customizable</Text>
                </View>
              )}
            </View>

            <View style={styles.header}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {item.discounted_price && Number(item.discounted_price) < Number(item.price) ? (
                <View style={styles.priceContainer}>
                  <Text style={styles.originalPrice}>R{Number(item.price).toFixed(2)}</Text>
                  <Text style={styles.price}>R{basePrice.toFixed(2)}</Text>
                </View>
              ) : (
                <Text style={styles.price}>R{basePrice.toFixed(2)}</Text>
              )}
            </View>

            {!!item.description && (
              <Text style={styles.description} numberOfLines={2}>
                {item.description}
              </Text>
            )}

            <View style={styles.tagsContainer}>
              {(item.tags || []).slice(0, 3).map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
              {!!item.preparation_time_minutes && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{item.preparation_time_minutes} min</Text>
                </View>
              )}
            </View>

            {!item.is_available && (
              <Text style={styles.unavailableText}>Currently unavailable</Text>
            )}
          </View>

          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="fast-food" size={30} color={colors.gray400} />
            </View>
          )}
        </View>

        {item.is_available && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Customization Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.modalTitle}>{item.name}</Text>
                <Text style={styles.modalBasePrice}>Base Price: R{basePrice.toFixed(2)}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {!!item.description && (
                <Text style={styles.modalDescription}>{item.description}</Text>
              )}

              {customizationGroups.length > 0 && (
                <View style={styles.section}>
                  {customizationGroups.map((group) => {
                    const pickedList = selectedOptions[group.name] || [];
                    return (
                      <View key={group.id} style={styles.optionGroup}>
                        <View style={styles.optionGroupHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.optionLabel}>{group.name}</Text>
                            <Text style={styles.optionSubLabel}>
                              {group.type === 'multiple'
                                ? `Choose up to ${group.max_select}`
                                : 'Select 1 option'}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.reqBadge,
                              group.required ? styles.reqBadgeRequired : styles.reqBadgeOptional,
                            ]}
                          >
                            <Text
                              style={[
                                styles.reqBadgeText,
                                group.required
                                  ? styles.reqBadgeTextRequired
                                  : styles.reqBadgeTextOptional,
                              ]}
                            >
                              {group.required ? 'Required' : 'Optional'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.optionRowsList}>
                          {group.options.map((choice) => {
                            const isSelected = pickedList.some(
                              (c) => c.name === choice.name
                            );
                            return (
                              <TouchableOpacity
                                key={choice.id}
                                style={[
                                  styles.optionRow,
                                  isSelected && styles.optionRowSelected,
                                ]}
                                onPress={() => handleToggleOption(group, choice)}
                              >
                                <View style={styles.optionRowLeft}>
                                  <Ionicons
                                    name={
                                      group.type === 'multiple'
                                        ? isSelected
                                          ? 'checkbox'
                                          : 'square-outline'
                                        : isSelected
                                        ? 'radio-button-on'
                                        : 'radio-button-off'
                                    }
                                    size={20}
                                    color={isSelected ? colors.primary : colors.gray400}
                                  />
                                  <Text
                                    style={[
                                      styles.optionRowName,
                                      isSelected && styles.optionRowNameSelected,
                                    ]}
                                  >
                                    {choice.name}
                                  </Text>
                                </View>
                                <Text
                                  style={[
                                    styles.optionRowPrice,
                                    isSelected && styles.optionRowNameSelected,
                                  ]}
                                >
                                  {choice.price > 0
                                    ? `+R${choice.price.toFixed(2)}`
                                    : 'Free'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Special Instructions</Text>
                <TextInput
                  style={styles.instructionsTextInput}
                  placeholder="Add note (e.g., extra sauce on the side, no onions...)"
                  placeholderTextColor={colors.textTertiary}
                  value={specialInstructions}
                  onChangeText={setSpecialInstructions}
                  multiline
                  maxLength={250}
                />
              </View>

              <View style={styles.quantitySection}>
                <Text style={styles.sectionTitle}>Quantity</Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={handleDecrement}
                  >
                    <Ionicons name="remove" size={20} color={colors.primary} />
                  </TouchableOpacity>

                  <Text style={styles.quantityText}>{quantity}</Text>

                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={handleIncrement}
                  >
                    <Ionicons name="add" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={styles.totalContainer}>
                <View>
                  <Text style={styles.totalLabel}>Total</Text>
                  {extraOptionsPrice > 0 && (
                    <Text style={styles.extraPriceHint}>
                      Includes +R{extraOptionsPrice.toFixed(2)} in options
                    </Text>
                  )}
                </View>
                <Text style={styles.totalPrice}>
                  R{(unitPrice * quantity).toFixed(2)}
                </Text>
              </View>

              <Button
                title={`Add to Cart • R${(unitPrice * quantity).toFixed(2)}`}
                onPress={handleAddToCart}
                style={styles.addToCartButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unavailableContainer: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  vegBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  vegBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534',
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ffedd5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9a3412',
  },
  customizableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  customizableBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontSize: 13,
    color: colors.textTertiary,
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  tag: {
    backgroundColor: colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  unavailableText: {
    fontSize: 12,
    color: colors.error,
    fontStyle: 'italic',
    marginTop: 4,
  },
  image: {
    width: 84,
    height: 84,
    borderRadius: 10,
  },
  imagePlaceholder: {
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  modalBasePrice: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  optionGroup: {
    marginBottom: 20,
  },
  optionGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  optionSubLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reqBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  reqBadgeRequired: {
    backgroundColor: '#fef3c7',
  },
  reqBadgeOptional: {
    backgroundColor: colors.gray100,
  },
  reqBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reqBadgeTextRequired: {
    color: '#92400e',
  },
  reqBadgeTextOptional: {
    color: colors.textSecondary,
  },
  optionRowsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  optionRowSelected: {
    borderColor: colors.primary,
    backgroundColor: '#f0fdf4',
  },
  optionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  optionRowName: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  optionRowNameSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  optionRowPrice: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  instructionsTextInput: {
    backgroundColor: colors.gray100,
    padding: 14,
    borderRadius: 10,
    minHeight: 72,
    textAlignVertical: 'top',
    fontSize: 14,
    color: colors.textPrimary,
  },
  quantitySection: {
    padding: 20,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 180,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    minWidth: 40,
    textAlign: 'center',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  extraPriceHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  totalPrice: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
  },
  addToCartButton: {
    width: '100%',
  },
});

export default MenuItem;
