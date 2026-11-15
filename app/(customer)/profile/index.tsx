import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import Button from '../../../components/common/Button';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const comingSoon = () =>
    Alert.alert('Coming Soon', 'This feature will be available in a future update.');
  
  const menuItems = [
    {
      title: 'Account',
      icon: 'person-outline',
      items: [
        { label: 'Personal Information', icon: 'person', action: comingSoon },
        { label: 'Delivery Addresses', icon: 'location', action: comingSoon },
        { label: 'Payment Methods', icon: 'card', action: comingSoon },
      ],
    },
    {
      title: 'Settings',
      icon: 'settings-outline',
      items: [
        { 
          label: 'Push Notifications', 
          icon: 'notifications',
          action: () => {},
          switch: (
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.gray300, true: colors.primary }}
            />
          ),
        },
        { 
          label: 'Location Services', 
          icon: 'location',
          action: () => {},
          switch: (
            <Switch
              value={locationEnabled}
              onValueChange={setLocationEnabled}
              trackColor={{ false: colors.gray300, true: colors.primary }}
            />
          ),
        },
        { 
          label: 'Dark Mode', 
          icon: 'moon',
          action: () => {},
          switch: (
            <Switch
              value={darkModeEnabled}
              onValueChange={setDarkModeEnabled}
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
        { label: 'Help Center', icon: 'help-circle', action: comingSoon },
        { label: 'Contact Us', icon: 'chatbubble', action: comingSoon },
        { label: 'Privacy Policy', icon: 'shield-checkmark', action: comingSoon },
        { label: 'Terms of Service', icon: 'document-text', action: comingSoon },
      ],
    },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/(auth)/welcome');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileInfo}>
            {user?.profile_image_url ? (
              <Image 
                source={{ uri: user.profile_image_url }} 
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileInitials}>
                  {user?.first_name?.[0] || 'S'}{user?.last_name?.[0] || 'N'}
                </Text>
              </View>
            )}
            
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>
                {getGreeting()}, {user?.first_name || 'Customer'}
              </Text>
              <Text style={styles.profileEmail}>{user?.email || 'No email provided'}</Text>
              <Text style={styles.profilePhone}>{user?.phone_number || 'No phone number provided'}</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.editButton}
            onPress={comingSoon}
          >
            <Feather name="edit-2" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        {/* <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>R245.50</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>4.8</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View> */}

        {/* Menu Sections */}
        {menuItems.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon as any} size={20} color={colors.primary} />
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

        {/* Promo Section */}
        <View style={styles.promoSection}>
          <View style={styles.promoCard}>
            <View style={styles.promoContent}>
              <Text style={styles.promoTitle}>Get 20% Off</Text>
              <Text style={styles.promoText}>On your next order</Text>
              <TouchableOpacity style={styles.promoButton}>
                <Text style={styles.promoButtonText}>APPLY NOW</Text>
              </TouchableOpacity>
            </View>
            <Ionicons name="gift" size={60} color="#fff" style={styles.promoIcon} />
          </View>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <Button
            title="Logout"
            onPress={handleLogout}
            variant="outline"
            leftIcon={<Ionicons name="log-out-outline" size={20} color={colors.error} />}
            buttonStyle={styles.logoutButton}
            textStyle={styles.logoutButtonText}
          />
          
          <Text style={styles.appVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>
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
    color: '#fff',
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
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginTop: 1,
    paddingVertical: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  promoText: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 16,
  },
  promoButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  promoButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  promoIcon: {
    opacity: 0.8,
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
});