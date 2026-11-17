import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, Feather } from '@expo/vector-icons';
import Button from '../../../components/common/Button';
import { customerColors as colors } from '../../../constants/customerTheme';
import { APP_CONFIG } from '../../../constants/config';
import { useAuth } from '../../../hooks/useAuth';
import { useLocation } from '../../../hooks/useLocation';
import { authService, userService } from '../../../services/auth';
import { useAddressStore, formatAddressSummary, DeliveryAddressItem } from '../../../store/addressStore';
import { useFeedbackStore } from '../../../store/feedbackStore';

type SavedAddress = {
  id?: string;
  label?: string;
  street?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  is_default?: boolean;
};

type ActiveModal =
  | null
  | 'edit_profile'
  | 'addresses'
  | 'payment_method'
  | 'help'
  | 'contact'
  | 'privacy'
  | 'terms';

type ProfileMenuItem = {
  label: string;
  icon: string;
  action: () => void;
  switch?: React.ReactNode;
};

type ProfileMenuSection = {
  title: string;
  icon: string;
  items: ProfileMenuItem[];
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const { getCurrentLocation, getAddressDetailsFromCoords, openLocationSettings } = useLocation();
  const mode = useAddressStore((s) => s.mode);
  const selectedAddress = useAddressStore((s) => s.selectedAddress);
  const storeSavedAddresses = useAddressStore((s) => s.savedAddresses);
  const syncSavedAddresses = useAddressStore((s) => s.syncSavedAddresses);
  const saveNewAddressToStore = useAddressStore((s) => s.saveNewAddress);
  const selectAddressInStore = useAddressStore((s) => s.selectAddress);
  const removeSavedAddressFromStore = useAddressStore((s) => s.removeSavedAddress);
  const setDefaultSavedAddressInStore = useAddressStore((s) => s.setDefaultSavedAddress);
  const showPopup = useFeedbackStore((s) => s.showPopup);
  const showToast = useFeedbackStore((s) => s.showToast);
  const showFriendlyError = useFeedbackStore((s) => s.showFriendlyError);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  // Edit profile form
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Addresses state
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [newLabel, setNewLabel] = useState('Home');
  const [newStreet, setNewStreet] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newPostalCode, setNewPostalCode] = useState('');
  const [locatingAddress, setLocatingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // Payment preference state
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<'card' | 'mobile_money'>('card');
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.SETTINGS)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (typeof parsed.notificationsEnabled === 'boolean') {
          setNotificationsEnabled(parsed.notificationsEnabled);
        }
        if (typeof parsed.locationEnabled === 'boolean') {
          setLocationEnabled(parsed.locationEnabled);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setFirstName(user?.first_name || '');
    setLastName(user?.last_name || '');
    setPhoneNumber(user?.phone_number || '');
    if (user) {
      authService
        .getCurrentUser()
        .then((res: any) => {
          const prof = res?.profile ?? res?.data?.profile;
          if (prof?.default_payment_method === 'mobile_money') {
            setDefaultPaymentMethod('mobile_money');
          } else if (prof?.default_payment_method === 'card') {
            setDefaultPaymentMethod('card');
          }
          if (Array.isArray(prof?.delivery_addresses)) {
            setAddresses(prof.delivery_addresses);
          }
        })
        .catch(() => {});
    }
  }, [user?.id]);

  const persistSetting = (key: 'notificationsEnabled' | 'locationEnabled', value: boolean) => {
    if (key === 'notificationsEnabled') setNotificationsEnabled(value);
    if (key === 'locationEnabled') setLocationEnabled(value);
    const next = {
      notificationsEnabled: key === 'notificationsEnabled' ? value : notificationsEnabled,
      locationEnabled: key === 'locationEnabled' ? value : locationEnabled,
    };
    AsyncStorage.setItem(APP_CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(next)).catch(() => {});
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const requireSignedIn = (onOk: () => void) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to manage your account settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    onOk();
  };

  const openEditProfile = () => {
    requireSignedIn(() => {
      setFirstName(user?.first_name || '');
      setLastName(user?.last_name || '');
      setPhoneNumber(user?.phone_number || '');
      setActiveModal('edit_profile');
    });
  };

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim() || !phoneNumber.trim()) {
      Alert.alert('Required Fields', 'Please enter your first name, last name, and phone number.');
      return;
    }
    setSavingProfile(true);
    try {
      const res: any = await userService.updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phoneNumber.trim(),
      });
      const updated = res?.data ?? res;
      updateUser({
        first_name: updated?.first_name ?? firstName.trim(),
        last_name: updated?.last_name ?? lastName.trim(),
        phone_number: updated?.phone_number ?? phoneNumber.trim(),
      });
      setActiveModal(null);
      Alert.alert('Profile Updated', 'Your personal details have been saved.');
    } catch (err: any) {
      Alert.alert('Update Failed', err?.response?.data?.error || err?.message || 'Could not update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const openAddresses = async () => {
    requireSignedIn(async () => {
      setActiveModal('addresses');
      setLoadingAddresses(true);
      try {
        const list = await syncSavedAddresses();
        setAddresses(list);
      } catch {
        setAddresses(storeSavedAddresses);
      } finally {
        setLoadingAddresses(false);
      }
    });
  };

  const handleFillAddressFromGps = async () => {
    setLocatingAddress(true);
    try {
      const current = await getCurrentLocation();
      if (!current?.coords) {
        showPopup({
          type: 'warning',
          title: 'Device Location Is Off',
          message:
            'Please turn on device location to auto-fill, or simply type the street and town below.',
          primaryLabel: 'Open Settings',
          onPrimary: openLocationSettings,
          secondaryLabel: 'Type Manually',
        });
        return;
      }
      const geo = await getAddressDetailsFromCoords(current.coords.latitude, current.coords.longitude);
      if (geo) {
        setNewStreet(geo.street || geo.name || geo.formattedAddress || '');
        setNewCity(geo.city || geo.district || '');
        setNewPostalCode(geo.postalCode || '');
      }
    } catch {
      showPopup({
        type: 'info',
        title: 'Enter Address Manually',
        message: 'We could not read GPS details right now. Please type the street and city below.',
      });
    } finally {
      setLocatingAddress(false);
    }
  };

  const handleAddAddress = async () => {
    if (!newStreet.trim() || !newCity.trim()) {
      showPopup({
        type: 'info',
        title: 'Missing Details',
        message: 'Please enter both a street address and a city/town.',
      });
      return;
    }
    setSavingAddress(true);
    try {
      const { list } = await saveNewAddressToStore(
        {
          label: newLabel.trim() || 'Home',
          street: newStreet.trim(),
          city: newCity.trim(),
          postal_code: newPostalCode.trim(),
          is_default: addresses.length === 0,
        },
        { selectAfterSave: false }
      );
      setAddresses(list);
      setNewStreet('');
      setNewCity('');
      setNewPostalCode('');
      showToast({
        type: 'success',
        message: 'Address saved! Tap "Order Here" anytime to browse restaurants there.',
      });
    } catch (err: any) {
      showFriendlyError(err);
    } finally {
      setSavingAddress(false);
    }
  };

  const handleUseAddressForOrdering = async (addr: DeliveryAddressItem) => {
    const resolved = await selectAddressInStore(addr);
    if (!resolved) {
      showPopup({
        type: 'warning',
        title: "Couldn't Locate Address",
        message: 'Please make sure this saved address has a valid South African street and town.',
      });
      return;
    }
    setActiveModal(null);
    showToast({
      type: 'success',
      message: `Now browsing restaurants near ${resolved.label || resolved.city || resolved.street}`,
    });
  };

  const handleSetDefaultAddress = async (identifier: string) => {
    try {
      const updated = await setDefaultSavedAddressInStore(identifier);
      setAddresses(updated);
      showToast({ type: 'success', message: 'Default delivery address updated' });
    } catch (err) {
      showFriendlyError(err);
    }
  };

  const handleRemoveAddress = async (identifier: string) => {
    try {
      const updated = await removeSavedAddressFromStore(identifier);
      setAddresses(updated);
    } catch (err: any) {
      showFriendlyError(err);
    }
  };

  const handleSavePaymentPreference = async (method: 'card' | 'mobile_money') => {
    setDefaultPaymentMethod(method);
    setSavingPayment(true);
    try {
      await userService.updateRoleProfile({ default_payment_method: method });
      setActiveModal(null);
      showToast({ type: 'success', message: 'Default payment preference updated.' });
    } catch (err: any) {
      showFriendlyError(err);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/(auth)/welcome');
    } catch {
      router.replace('/(auth)/welcome');
    }
  };

  const menuItems: ProfileMenuSection[] = [
    {
      title: 'Account',
      icon: 'person-outline',
      items: [
        { label: 'Personal Information', icon: 'person', action: openEditProfile },
        { label: 'Delivery Addresses', icon: 'location', action: openAddresses },
        {
          label: 'Payment Preference',
          icon: 'card',
          action: () => requireSignedIn(() => setActiveModal('payment_method')),
        },
      ],
    },
    {
      title: 'Preferences',
      icon: 'settings-outline',
      items: [
        {
          label: 'Push Notifications',
          icon: 'notifications',
          action: () => persistSetting('notificationsEnabled', !notificationsEnabled),
          switch: (
            <Switch
              value={notificationsEnabled}
              onValueChange={(v) => persistSetting('notificationsEnabled', v)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
            />
          ),
        },
        {
          label: 'Location Services',
          icon: 'navigate',
          action: () => persistSetting('locationEnabled', !locationEnabled),
          switch: (
            <Switch
              value={locationEnabled}
              onValueChange={(v) => persistSetting('locationEnabled', v)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
            />
          ),
        },
      ],
    },
    {
      title: 'Support',
      icon: 'help-circle-outline',
      items: [
        { label: 'Help Center', icon: 'help-circle', action: () => setActiveModal('help') },
        { label: 'Contact Us', icon: 'chatbubble', action: () => setActiveModal('contact') },
        { label: 'Privacy Policy', icon: 'shield-checkmark', action: () => setActiveModal('privacy') },
        { label: 'Terms of Service', icon: 'document-text', action: () => setActiveModal('terms') },
      ],
    },
  ];

  const renderInfoModalContent = () => {
    if (activeModal === 'help') {
      return {
        title: 'Help Center',
        body:
          '• Placing an Order: Pick any restaurant, customize your meal, and request your order.\n\n' +
          '• Paying via Paystack: Once the restaurant accepts your order, complete payment securely in Orders.\n\n' +
          '• Cancelling an Order: You can cancel and receive an automatic refund anytime before the driver picks up your food.\n\n' +
          '• Live Tracking & Delivery Code: Watch your driver live on the map and show the QR / 6-digit code at delivery.',
      };
    }
    if (activeModal === 'privacy') {
      return {
        title: 'Privacy Policy',
        body:
          'Happy Deliveries only uses your contact information, saved addresses, and live location during active orders to connect you with restaurants and drivers. Payments are processed securely through Paystack and card numbers are never stored on our servers.',
      };
    }
    return {
      title: 'Terms of Service',
      body:
        'Orders sent to participating restaurants are subject to availability. Customers may cancel before pickup for an automatic refund of completed Paystack payments. Drivers verify handoff using the customer delivery verification code.',
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileInfo}>
            {user?.profile_image_url ? (
              <Image source={{ uri: user.profile_image_url }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileInitials}>
                  {user?.first_name?.[0]?.toUpperCase() || 'G'}
                  {user?.last_name?.[0]?.toUpperCase() || (user ? '' : '')}
                </Text>
              </View>
            )}

            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>
                {getGreeting()}, {user?.first_name || 'Guest'}
              </Text>
              <Text style={styles.profileEmail}>
                {user?.email || 'Sign in to save addresses and track orders'}
              </Text>
              {!!user?.phone_number && (
                <Text style={styles.profilePhone}>{user.phone_number}</Text>
              )}
            </View>
          </View>

          {user && (
            <TouchableOpacity style={styles.editButton} onPress={openEditProfile}>
              <Feather name="edit-2" size={20} color={colors.primaryText} />
            </TouchableOpacity>
          )}
        </View>

        {!user && (
          <View style={styles.guestCtaCard}>
            <Text style={styles.guestCtaTitle}>Browsing as a Guest</Text>
            <Text style={styles.guestCtaSub}>
              Sign in or create an account to checkout, pay via Paystack, cancel orders, and track drivers live.
            </Text>
            <Button
              title="Sign In / Create Account"
              onPress={() => router.push('/(auth)/login')}
              variant="primary"
              tone="customer"
            />
          </View>
        )}

        {/* Menu Sections */}
        {menuItems.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon as any} size={20} color={colors.primaryText} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>

            <View style={styles.sectionContent}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={styles.menuItem}
                  onPress={item.action}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons name={item.icon as any} size={20} color={colors.textTertiary} />
                    <Text style={styles.menuItemText}>{item.label}</Text>
                  </View>

                  {item.switch ? (
                    item.switch
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Promo / Discovery Banner */}
        <View style={styles.promoSection}>
          <View style={styles.promoCard}>
            <View style={styles.promoContent}>
              <Text style={styles.promoTitle}>Hungry now?</Text>
              <Text style={styles.promoText}>Browse top-rated local favorites nearby</Text>
              <TouchableOpacity
                style={styles.promoButton}
                onPress={() => router.push('/(customer)/search')}
              >
                <Text style={styles.promoButtonText}>EXPLORE FOOD</Text>
              </TouchableOpacity>
            </View>
            <Ionicons name="fast-food" size={56} color={colors.onPrimary} style={styles.promoIcon} />
          </View>
        </View>

        {/* Logout / Sign In Footer */}
        <View style={styles.logoutContainer}>
          {user && (
            <Button
              title="Logout"
              onPress={handleLogout}
              variant="outline"
              leftIcon={<Ionicons name="log-out-outline" size={20} color={colors.error} />}
              buttonStyle={styles.logoutButton}
              textStyle={styles.logoutButtonText}
            />
          )}

          <Text style={styles.appVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>

      {/* Edit Personal Information Modal */}
      <Modal
        visible={activeModal === 'edit_profile'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Personal Information</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>First Name</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />

            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />

            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />

            <View style={styles.modalActions}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="outline" tone="customer" onPress={() => setActiveModal(null)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={savingProfile ? 'Saving...' : 'Save Changes'}
                  tone="customer"
                  loading={savingProfile}
                  onPress={handleSaveProfile}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Saved Delivery Addresses Modal */}
      <Modal
        visible={activeModal === 'addresses'}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delivery Addresses</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {loadingAddresses ? (
                <ActivityIndicator color={colors.primaryText} style={{ marginVertical: 20 }} />
              ) : addresses.length > 0 ? (
                addresses.map((addr, idx) => {
                  const keyId = addr.id || String(idx);
                  const isActiveBrowsing =
                    mode === 'address' &&
                    selectedAddress &&
                    ((addr.id && selectedAddress.id === addr.id) ||
                      formatAddressSummary(selectedAddress) ===
                        formatAddressSummary(addr as DeliveryAddressItem));

                  return (
                    <View key={keyId} style={styles.savedAddrRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.savedAddrLabel}>
                          {addr.label || 'Saved'} {addr.is_default ? '(Default)' : ''}
                        </Text>
                        <Text style={styles.savedAddrText}>
                          {addr.street || addr.address}
                          {addr.city ? `, ${addr.city}` : ''}
                        </Text>
                        <View style={styles.addrActionsRow}>
                          <TouchableOpacity
                            style={[styles.addrPillBtn, isActiveBrowsing && styles.addrPillBtnActive]}
                            onPress={() =>
                              handleUseAddressForOrdering({
                                ...(addr as DeliveryAddressItem),
                                street: addr.street || addr.address || '',
                              })
                            }
                          >
                            <Text
                              style={[
                                styles.addrPillBtnText,
                                isActiveBrowsing && styles.addrPillBtnTextActive,
                              ]}
                            >
                              {isActiveBrowsing ? '✓ Browsing Here' : 'Order Here'}
                            </Text>
                          </TouchableOpacity>
                          {!addr.is_default && addr.id && (
                            <TouchableOpacity
                              style={styles.addrPillBtn}
                              onPress={() => handleSetDefaultAddress(addr.id!)}
                            >
                              <Text style={styles.addrPillBtnText}>Set Default</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => handleRemoveAddress(keyId)}>
                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyAddressText}>No saved delivery addresses yet.</Text>
              )}

              <View style={styles.addAddrHeaderRow}>
                <Text style={styles.addAddrHeading}>Add New Address</Text>
                <TouchableOpacity
                  style={styles.gpsFillBtn}
                  onPress={handleFillAddressFromGps}
                  disabled={locatingAddress}
                >
                  {locatingAddress ? (
                    <ActivityIndicator size="small" color={colors.primaryText} />
                  ) : (
                    <>
                      <Ionicons name="locate" size={14} color={colors.primaryText} />
                      <Text style={styles.gpsFillText}>Use GPS</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Label (e.g. Home, Work)"
                value={newLabel}
                onChangeText={setNewLabel}
              />
              <TextInput
                style={styles.input}
                placeholder="Street Address"
                value={newStreet}
                onChangeText={setNewStreet}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="City"
                  value={newCity}
                  onChangeText={setNewCity}
                />
                <TextInput
                  style={[styles.input, { width: 100 }]}
                  placeholder="Postal"
                  value={newPostalCode}
                  onChangeText={setNewPostalCode}
                />
              </View>

              <Button
                title={savingAddress ? 'Saving...' : 'Save Address'}
                tone="customer"
                loading={savingAddress}
                onPress={handleAddAddress}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Default Payment Method Modal */}
      <Modal
        visible={activeModal === 'payment_method'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Preference</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Choose your preferred Paystack payment option at checkout.
            </Text>

            {([
              { key: 'card', label: 'Debit / Credit Card (Paystack)', icon: 'card-outline' },
              { key: 'mobile_money', label: 'Instant EFT / SnapScan / QR', icon: 'qr-code-outline' },
            ] as const).map((opt) => {
              const active = defaultPaymentMethod === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  disabled={savingPayment}
                  style={[styles.paymentChoice, active && styles.paymentChoiceActive]}
                  onPress={() => handleSavePaymentPreference(opt.key)}
                >
                  <Ionicons
                    name={opt.icon}
                    size={22}
                    color={active ? colors.primaryText : colors.textSecondary}
                  />
                  <Text style={[styles.paymentChoiceText, active && styles.paymentChoiceTextActive]}>
                    {opt.label}
                  </Text>
                  {active && <Ionicons name="checkmark-circle" size={22} color={colors.primaryText} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Contact Us Modal */}
      <Modal
        visible={activeModal === 'contact'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact Support</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBody}>
              Need help with an active order, refund, or restaurant question? Reach our support team directly:
            </Text>
            <TouchableOpacity
              style={styles.contactRow}
              onPress={() => Linking.openURL('mailto:support@happydeliveries.co.za')}
            >
              <Ionicons name="mail-outline" size={20} color={colors.primaryText} />
              <Text style={styles.contactLink}>support@happydeliveries.co.za</Text>
            </TouchableOpacity>
            <Button title="Close" onPress={() => setActiveModal(null)} variant="outline" tone="customer" />
          </View>
        </View>
      </Modal>

      {/* Help / Privacy / Terms Modal */}
      <Modal
        visible={activeModal === 'help' || activeModal === 'privacy' || activeModal === 'terms'}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{renderInfoModalContent().title}</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBody}>{renderInfoModalContent().body}</Text>
            <Button title="Got It" tone="customer" onPress={() => setActiveModal(null)} />
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
  profileHeader: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 16,
  },
  profileImagePlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInitials: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.onPrimary,
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestCtaCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  guestCtaTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  guestCtaSub: {
    fontSize: 13.5,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 12,
  },
  sectionContent: {
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: colors.textPrimary,
    marginLeft: 16,
  },
  promoSection: {
    padding: 20,
  },
  promoCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.onPrimary,
    marginBottom: 4,
  },
  promoText: {
    fontSize: 14,
    color: colors.onPrimary,
    opacity: 0.85,
    marginBottom: 16,
  },
  promoButton: {
    backgroundColor: colors.onPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  promoButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primary,
  },
  promoIcon: {
    opacity: 0.85,
  },
  logoutContainer: {
    padding: 20,
    alignItems: 'center',
  },
  logoutButton: {
    width: '100%',
    borderColor: colors.error,
    marginBottom: 20,
  },
  logoutButtonText: {
    color: colors.error,
  },
  appVersion: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13.5,
    color: colors.textSecondary,
    marginBottom: 14,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  savedAddrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  savedAddrLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  savedAddrText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addrActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  addrPillBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  addrPillBtnActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
  },
  addrPillBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  addrPillBtnTextActive: {
    color: colors.primaryText,
    fontWeight: '700',
  },
  emptyAddressText: {
    fontSize: 13.5,
    color: colors.textTertiary,
    textAlign: 'center',
    marginVertical: 12,
  },
  addAddrHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  addAddrHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  gpsFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gpsFillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryText,
  },
  paymentChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    gap: 12,
  },
  paymentChoiceActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySoft,
  },
  paymentChoiceText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  paymentChoiceTextActive: {
    color: colors.primaryText,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  contactLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryText,
  },
});
