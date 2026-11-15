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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import Button from '../../../components/common/Button';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { driverService } from '../../../services/driver';
import { useCallback } from 'react';

type DriverProfile = {
  id: string;
  user_id: string;
  driver_license_number: string;
  vehicle_type: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_registration: string;
  current_status: string;
  total_deliveries: number;
  average_rating: number;
  total_earnings: number;
  service_radius_km: number;
  is_available: boolean;
  created_at: string;
};

export default function DriverProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  // useEffect(() => {
  //   if (user) {
  //     fetchDriverProfile();
  //   }
  // }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchDriverProfile();
      }
    }, [user])
  );

  const fetchDriverProfile = async () => {
    try {
      setLoading(true);
      const response = await driverService.getProfile();
      
      // FIX: Your backend returns { success: true, data: profile }
      // Ensure you are setting the .data portion to your state
      setProfile(response.data || response); 
    } catch (error) {
      console.error('Error fetching driver profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/welcome');
          }
        },
      ]
    );
  };

  const menuSections = [
    {
      title: 'Account',
      icon: 'person-outline',
      items: [
        { 
          label: 'Personal Information', 
          icon: 'person',
          action: () => router.push('/(driver)/profile/edit'),
        },
        { 
          label: 'Vehicle Information', 
          icon: 'car',
          action: () => router.push('/(driver)/profile/vehicle'),
        },
        { 
          label: 'Bank Details', 
          icon: 'card',
          action: () => router.push('/(driver)/profile/bank'),
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
          label: 'Service Radius', 
          icon: 'navigate-circle',
          action: () => router.push('/(driver)/profile/radius'),
          value: `${profile?.service_radius_km || 10} km`,
        },
      ],
    },
    {
      title: 'Support',
      icon: 'help-circle-outline',
      items: [
        { label: 'Help Center', icon: 'help-circle', action: () => router.push('/support/help') },
        { label: 'Contact Support', icon: 'chatbubble', action: () => router.push('/support/contact') },
        { label: 'Terms & Policies', icon: 'document-text', action: () => router.push('/support/terms') },
      ],
    },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileInfo}>
            <View style={styles.avatarContainer}>
              {user?.profile_image_url ? (
                <Image 
                  source={{ uri: user.profile_image_url }} 
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </Text>
                </View>
              )}
              
              <View style={[
                styles.statusBadge, 
                profile?.current_status === 'available' ? styles.statusOnline : styles.statusOffline
              ]}>
                <Text style={styles.statusText}>
                  {profile?.current_status === 'available' ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
            
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>
                {user?.first_name} {user?.last_name}
              </Text>
              <Text style={styles.profileRole}>Delivery Driver</Text>
              
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>
                  {Number(profile?.average_rating || 0).toFixed(1)}
                  <Text style={styles.ratingCount}> (200+)</Text>
                </Text>
              </View>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => router.push('/(driver)/profile/edit')}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Driver Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <MaterialIcons name="delivery-dining" size={24} color={colors.primary} />
            <Text style={styles.statValue}>{profile?.total_deliveries || 0}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <MaterialIcons name="payments" size={24} color={colors.money} />
            <Text style={styles.statValue}>R {Number(profile?.total_earnings || 0).toFixed(0)}</Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <MaterialIcons name="delivery-dining" size={24} color={colors.info} />
            <Text style={styles.statValue}>{profile?.vehicle_type || 'Motor Bike'}</Text>
            <Text style={styles.statLabel}>Bike</Text>
          </View>
        </View>

        {/* Vehicle Info Card */}
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleHeader}>
            <View style={styles.vehicleIcon}>
              <FontAwesome5 name="car" size={24} color={colors.primary} />
            </View>
            <Text style={styles.vehicleTitle}>Vehicle Information</Text>
          </View>
          
          <View style={styles.vehicleDetails}>
            <View style={styles.vehicleDetail}>
              <Text style={styles.vehicleLabel}>Model</Text>
              <Text style={styles.vehicleValue}>{profile?.vehicle_model || 'Not Set'}</Text>
            </View>
            
            <View style={styles.vehicleDetail}>
              <Text style={styles.vehicleLabel}>Color</Text>
              <Text style={styles.vehicleValue}>{profile?.vehicle_color || 'Not Set'}</Text>
            </View>
            
            <View style={styles.vehicleDetail}>
              <Text style={styles.vehicleLabel}>Registration</Text>
              <Text style={styles.vehicleValue}>{profile?.vehicle_registration || 'Not Set'}</Text>
            </View>
            
            <View style={styles.vehicleDetail}>
              <Text style={styles.vehicleLabel}>License</Text>
              <Text style={styles.vehicleValue}>{profile?.driver_license_number || 'Not Set'}</Text>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.editVehicleButton}
            onPress={() => router.push('/(driver)/profile/vehicle')}
          >
            <Text style={styles.editVehicleText}>Edit Vehicle Info</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Sections */}
        {menuSections.map((section, sectionIndex) => (
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
                  ) : item.value ? (
                    <View style={styles.menuItemRight}>
                      <Text style={styles.menuItemValue}>{item.value}</Text>
                      <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Emergency & Support */}
        <View style={styles.emergencySection}>
          <Text style={styles.emergencyTitle}>Emergency & Support</Text>
          
          <View style={styles.emergencyButtons}>
            <TouchableOpacity style={styles.emergencyButton}>
              <View style={[styles.emergencyIcon, { backgroundColor: colors.error + '20' }]}>
                <Ionicons name="shield" size={24} color={colors.error} />
              </View>
              <Text style={styles.emergencyButtonText}>Emergency</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.emergencyButton}>
              <View style={[styles.emergencyIcon, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="help-buoy" size={24} color={colors.warning} />
              </View>
              <Text style={styles.emergencyButtonText}>Support</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.emergencyButton}>
              <View style={[styles.emergencyIcon, { backgroundColor: colors.info + '20' }]}>
                <Ionicons name="document-text" size={24} color={colors.info} />
              </View>
              <Text style={styles.emergencyButtonText}>Documents</Text>
            </TouchableOpacity>
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
          
          <Text style={styles.appVersion}>Driver App v1.0.0</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusOnline: {
    backgroundColor: colors.success,
  },
  statusOffline: {
    backgroundColor: colors.error,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginLeft: 4,
  },
  ratingCount: {
    color: colors.textTertiary,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 8,
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
  vehicleCard: {
    backgroundColor: '#fff',
    marginTop: 16,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  vehicleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  vehicleDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  vehicleDetail: {
    width: '50%',
    marginBottom: 16,
  },
  vehicleLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  vehicleValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  editVehicleButton: {
    backgroundColor: colors.gray100,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editVehicleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemValue: {
    fontSize: 14,
    color: colors.textTertiary,
    marginRight: 8,
  },
  emergencySection: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 20,
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  emergencyButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emergencyButton: {
    alignItems: 'center',
    flex: 1,
    padding: 16,
  },
  emergencyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emergencyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
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