import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { managerService } from '../../../services/manager';
import Button from '../../../components/common/Button';

export default function ManagerProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Refresh profile data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await managerService.getProfile();
      setProfile(response.data || response);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome');
      }},
    ]);
  };

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading manager profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{user?.first_name?.[0]}{user?.last_name?.[0]}</Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>Manager</Text>
            </View>
          </View>
          <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(manager)/profile/edit')}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={22} color={colors.primary} />
              <Text style={styles.menuItemText}>Edit Personal Info</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(manager)/restaurants/index')}>
            <View style={styles.menuItemLeft}>
              <MaterialIcons name="restaurant" size={22} color={colors.primary} />
              <Text style={styles.menuItemText}>Manage My Restaurants</Text>
            </View>
            <Text style={styles.badgeText}>{profile?.restaurant_ids?.length || 0}</Text>
          </TouchableOpacity>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.menuItemText}>Help Center</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <View style={styles.logoutContainer}>
          <Button 
            title="Logout" 
            onPress={handleLogout} 
            variant="outline" 
            textStyle={{ color: colors.error }} 
            buttonStyle={{ borderColor: colors.error }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', padding: 30, backgroundColor: '#fff' },
  avatarContainer: { position: 'relative', marginBottom: 15 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  roleBadge: { position: 'absolute', bottom: 0, backgroundColor: colors.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  roleText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  name: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary },
  email: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  section: { backgroundColor: '#fff', marginTop: 20, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: colors.textTertiary, marginVertical: 15, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuItemText: { marginLeft: 15, fontSize: 16, color: colors.textPrimary },
  badgeText: { backgroundColor: colors.gray100, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, fontSize: 12, color: colors.textSecondary },
  logoutContainer: { padding: 30 },
});