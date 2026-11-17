import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../hooks/useLocation';
import { useAddressStore, formatAddressSummary, DeliveryAddressItem } from '../../store/addressStore';
import { useFeedbackStore } from '../../store/feedbackStore';
import { colors } from '../../constants/colors';

interface AddressPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onAddressApplied?: () => void;
}

export default function AddressPickerModal({
  visible,
  onClose,
  onAddressApplied,
}: AddressPickerModalProps) {
  const { user } = useAuth();
  const { location, locationStatus, getCurrentLocation, openLocationSettings } = useLocation();
  const mode = useAddressStore((s) => s.mode);
  const selectedAddress = useAddressStore((s) => s.selectedAddress);
  const savedAddresses = useAddressStore((s) => s.savedAddresses);
  const loadingSaved = useAddressStore((s) => s.loadingSaved);
  const syncSavedAddresses = useAddressStore((s) => s.syncSavedAddresses);
  const useGpsLocation = useAddressStore((s) => s.useGpsLocation);
  const selectAddress = useAddressStore((s) => s.selectAddress);
  const saveNewAddress = useAddressStore((s) => s.saveNewAddress);

  const showToast = useFeedbackStore((s) => s.showToast);
  const showPopup = useFeedbackStore((s) => s.showPopup);
  const showFriendlyError = useFeedbackStore((s) => s.showFriendlyError);

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [label, setLabel] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);

  useEffect(() => {
    if (visible && user) {
      syncSavedAddresses();
    }
  }, [visible, user?.id, syncSavedAddresses]);

  const handleUseGps = async () => {
    setApplyingKey('gps');
    try {
      const current = location?.coords ? location : await getCurrentLocation();
      if (!current?.coords) {
        showPopup({
          type: 'warning',
          title: 'Device Location Is Off',
          message:
            'Please turn on Location Services in settings, or pick any saved address below to browse and order.',
          primaryLabel: 'Open Settings',
          onPrimary: openLocationSettings,
          secondaryLabel: 'Pick Address',
        });
        return;
      }
      useGpsLocation();
      showToast({
        type: 'success',
        message: 'Using your current GPS location',
      });
      onAddressApplied?.();
      onClose();
    } finally {
      setApplyingKey(null);
    }
  };

  const handleSelectSaved = async (addr: DeliveryAddressItem, keyId: string) => {
    setApplyingKey(keyId);
    try {
      const resolved = await selectAddress(addr);
      if (!resolved) {
        showPopup({
          type: 'warning',
          title: "Couldn't Pin That Address",
          message:
            'Please add a clear street name and town/city in South Africa so we can find nearby restaurants.',
          primaryLabel: 'OK',
        });
        return;
      }
      showToast({
        type: 'success',
        message: `Browsing near ${resolved.label || resolved.city || resolved.street}`,
      });
      onAddressApplied?.();
      onClose();
    } catch (err) {
      showFriendlyError(err, { context: 'location' });
    } finally {
      setApplyingKey(null);
    }
  };

  const handleApplyCustomArea = async () => {
    const cleanCity = city.trim();
    const cleanStreet = street.trim();
    const cleanLabel = label.trim() || cleanCity || cleanStreet;

    if (!cleanCity && !cleanStreet) {
      showPopup({
        type: 'info',
        title: 'Enter a Town or Street',
        message: 'Type a city or delivery street (for example, "Nelspruit" or "12 Ferreira St, Nelspruit").',
        primaryLabel: 'Got It',
      });
      return;
    }

    setApplyingKey('custom');
    try {
      if (user && saveToProfile && cleanStreet && cleanCity) {
        const { saved } = await saveNewAddress(
          {
            label: cleanLabel || 'Recipient',
            street: cleanStreet,
            city: cleanCity,
            is_default: savedAddresses.length === 0,
          },
          { selectAfterSave: true }
        );
        if (!saved?.latitude || !saved?.longitude) {
          // Try explicit selection geocode if server returned saved item without coords
          const resolved = await selectAddress({
            ...(saved || {}),
            label: cleanLabel,
            street: cleanStreet,
            city: cleanCity,
          });
          if (!resolved) {
            showPopup({
              type: 'warning',
              title: 'Address Saved, Location Unclear',
              message: 'We saved the address, though we could not pinpoint the exact area on the map yet.',
            });
            return;
          }
        }
      } else {
        const resolved = await selectAddress({
          label: cleanLabel,
          street: cleanStreet || cleanCity,
          city: cleanCity || cleanStreet,
        });
        if (!resolved) {
          showPopup({
            type: 'warning',
            title: "Couldn't Find That Area",
            message: 'Try adding the town or suburb name (for example, "Nelspruit" or "Sandton, Johannesburg").',
            primaryLabel: 'Try Again',
          });
          return;
        }
      }

      setLabel('');
      setStreet('');
      setCity('');
      setShowCustomForm(false);
      showToast({
        type: 'success',
        message: `Now showing restaurants near ${cleanLabel}`,
      });
      onAddressApplied?.();
      onClose();
    } catch (err) {
      showFriendlyError(err, { context: 'location' });
    } finally {
      setApplyingKey(null);
    }
  };

  const gpsActive = mode === 'gps' && Boolean(location?.coords);
  const gpsOff = locationStatus === 'disabled' || locationStatus === 'denied';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Where are we delivering?</Text>
              <Text style={styles.sheetSubtitle}>
                Choose your location or order for someone in another city
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#1E293B" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Current GPS Option */}
            <TouchableOpacity
              style={[styles.optionCard, gpsActive && styles.optionCardActive]}
              onPress={handleUseGps}
              disabled={applyingKey !== null}
            >
              <View style={[styles.optionIcon, gpsActive && styles.optionIconActive]}>
                <Ionicons
                  name={gpsOff ? 'location-outline' : 'navigate'}
                  size={20}
                  color={gpsActive ? '#FFFFFF' : colors.primary}
                />
              </View>
              <View style={styles.optionBody}>
                <Text style={styles.optionTitle}>Use Current GPS Location</Text>
                <Text style={styles.optionDesc}>
                  {gpsOff
                    ? 'Location services are off · Tap to enable'
                    : 'Use your live device location'}
                </Text>
              </View>
              {applyingKey === 'gps' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : gpsActive ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              )}
            </TouchableOpacity>

            {/* Saved Addresses Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Saved Addresses</Text>
              {loadingSaved && <ActivityIndicator size="small" color={colors.primary} />}
            </View>

            {savedAddresses.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="bookmark-outline" size={20} color="#94A3B8" />
                <Text style={styles.emptyText}>
                  {user
                    ? 'No saved addresses yet. Add one below (for yourself or someone you are ordering for).'
                    : 'Sign in to access saved profile addresses, or enter an area below.'}
                </Text>
              </View>
            ) : (
              savedAddresses.map((addr, idx) => {
                const keyId = addr.id || `${addr.street}_${idx}`;
                const isSelected =
                  mode === 'address' &&
                  selectedAddress &&
                  ((addr.id && selectedAddress.id === addr.id) ||
                    formatAddressSummary(selectedAddress) === formatAddressSummary(addr));

                return (
                  <TouchableOpacity
                    key={keyId}
                    style={[styles.optionCard, isSelected && styles.optionCardActive]}
                    onPress={() => handleSelectSaved(addr, keyId)}
                    disabled={applyingKey !== null}
                  >
                    <View style={[styles.optionIcon, isSelected && styles.optionIconActive]}>
                      <Ionicons
                        name="bookmark"
                        size={18}
                        color={isSelected ? '#FFFFFF' : colors.primary}
                      />
                    </View>
                    <View style={styles.optionBody}>
                      <View style={styles.titleRow}>
                        <Text style={styles.optionTitle}>
                          {addr.label || addr.city || 'Saved Address'}
                        </Text>
                        {addr.is_default && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.optionDesc} numberOfLines={2}>
                        {formatAddressSummary(addr)}
                      </Text>
                    </View>
                    {applyingKey === keyId ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            {/* Custom Area / Order for Someone Else */}
            <TouchableOpacity
              style={styles.toggleCustomBtn}
              onPress={() => setShowCustomForm((prev) => !prev)}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.toggleCustomText}>
                {showCustomForm
                  ? 'Hide custom address form'
                  : 'Deliver to another address or city (e.g. Nelspruit)'}
              </Text>
            </TouchableOpacity>

            {showCustomForm && (
              <View style={styles.customFormCard}>
                <Text style={styles.formTip}>
                  Enter a full street + city to save for checkout, or just a city/town name to browse restaurants there.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Label (e.g., Mom - Nelspruit, Office)"
                  placeholderTextColor="#94A3B8"
                  value={label}
                  onChangeText={setLabel}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Street Address (e.g., 12 Ferreira St)"
                  placeholderTextColor="#94A3B8"
                  value={street}
                  onChangeText={setStreet}
                />
                <TextInput
                  style={styles.input}
                  placeholder="City / Town * (e.g., Nelspruit)"
                  placeholderTextColor="#94A3B8"
                  value={city}
                  onChangeText={setCity}
                />

                {Boolean(user && street.trim() && city.trim()) && (
                  <View style={styles.saveSwitchRow}>
                    <Text style={styles.saveSwitchLabel}>Save address to my profile</Text>
                    <Switch
                      value={saveToProfile}
                      onValueChange={setSaveToProfile}
                      trackColor={{ false: '#CBD5E1', true: colors.primary }}
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={handleApplyCustomArea}
                  disabled={applyingKey !== null}
                >
                  {applyingKey === 'custom' ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.applyBtnText}>Use This Location</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
    gap: 12,
  },
  optionCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7ED',
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFEAD5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconActive: {
    backgroundColor: colors.primary,
  },
  optionBody: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionDesc: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  defaultBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  emptyText: {
    flex: 1,
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  toggleCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  toggleCustomText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
  },
  customFormCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formTip: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 17,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 10,
  },
  saveSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  saveSwitchLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#334155',
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
});
