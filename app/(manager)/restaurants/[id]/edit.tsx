import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Input from '../../../../components/common/Input';
import Button from '../../../../components/common/Button';
import { colors } from '../../../../constants/colors';
import api from '../../../../services/api';

export default function EditRestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    phone_number: '',
    cuisine_type: '',
    opening_hours: '',
    preparation_time_minutes: '',
    logo_url: '',
    cover_image_url: ''
  });

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    try {
      const response = await api.get(`/restaurants/${id}`);
      const data = response.data.data || response.data;
      setForm({
        ...data,
        cuisine_type: Array.isArray(data.cuisine_type) ? data.cuisine_type.join(', ') : data.cuisine_type || '',
        preparation_time_minutes: String(data.preparation_time_minutes || '20'),
        // Handle JSON opening hours if needed, assuming string for now based on your previous messages
        opening_hours: typeof data.opening_hours === 'object' ? data.opening_hours.display : data.opening_hours
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (field: 'logo_url' | 'cover_image_url') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: field === 'logo_url' ? [1, 1] : [16, 9],
      quality: 0.7,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri, field);
    }
  };

  const uploadImage = async (uri: string, field: string) => {
    setUploading(true);
    const formData = new FormData();
    // @ts-ignore
    formData.append('image', { uri, type: 'image/jpeg', name: 'upload.jpg' });

    try {
      const response = await api.post('/restaurants/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = response.data?.url || response.url;
      setForm(prev => ({ ...prev, [field]: url }));
    } catch (error) {
      Alert.alert('Error', 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/restaurants/${id}`, form);
      Alert.alert('Success', 'Restaurant updated!');
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} /></TouchableOpacity>
          <Text style={styles.title}>Edit Info</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Cover Image */}
        <TouchableOpacity style={styles.coverContainer} onPress={() => pickImage('cover_image_url')}>
          {form.cover_image_url ? (
            <Image source={{ uri: form.cover_image_url }} style={styles.coverImage} />
          ) : (
            <View style={styles.placeholderCover}><Text style={styles.phText}>Tap to add Cover</Text></View>
          )}
          <View style={styles.editIconBadge}><MaterialIcons name="edit" size={16} color="#fff" /></View>
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoRow}>
          <TouchableOpacity style={styles.logoContainer} onPress={() => pickImage('logo_url')}>
            {form.logo_url ? (
              <Image source={{ uri: form.logo_url }} style={styles.logo} />
            ) : (
              <View style={styles.placeholderLogo}><Ionicons name="camera" size={24} color={colors.gray500} /></View>
            )}
          </TouchableOpacity>
          <Text style={styles.hintText}>Tap images to update</Text>
        </View>

        <View style={styles.form}>
          <Input label="Restaurant Name" value={form.name} onChangeText={t => setForm({ ...form, name: t })} />
          <Input label="Description" value={form.description} onChangeText={t => setForm({ ...form, description: t })} multiline />
          <Input label="Address" value={form.address} onChangeText={t => setForm({ ...form, address: t })} />
          <Input label="Phone Number" value={form.phone_number} onChangeText={t => setForm({ ...form, phone_number: t })} keyboardType="phone-pad" />
          
          <Input 
            label="Cuisines (comma separated)" 
            value={form.cuisine_type} 
            onChangeText={t => setForm({ ...form, cuisine_type: t })} 
            placeholder="Burger, American, Fast Food"
          />
          
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input label="Opening Hours" value={form.opening_hours} onChangeText={t => setForm({ ...form, opening_hours: t })} />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Input label="Prep Time (mins)" value={form.preparation_time_minutes} onChangeText={t => setForm({ ...form, preparation_time_minutes: t })} keyboardType="numeric" />
            </View>
          </View>

          <Button title="Save Changes" onPress={handleSave} loading={saving} style={{ marginTop: 20 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold' },
  coverContainer: { height: 180, width: '100%', position: 'relative', marginBottom: 40 },
  coverImage: { width: '100%', height: '100%' },
  placeholderCover: { width: '100%', height: '100%', backgroundColor: colors.gray100, justifyContent: 'center', alignItems: 'center' },
  phText: { color: colors.gray500, fontWeight: '600' },
  editIconBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 20 },
  logoRow: { alignItems: 'center', marginTop: -50, marginBottom: 20 },
  logoContainer: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff', elevation: 4, overflow: 'hidden', backgroundColor: '#fff' },
  logo: { width: '100%', height: '100%' },
  placeholderLogo: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.gray100 },
  hintText: { fontSize: 12, color: colors.gray400, marginTop: 8 },
  form: { padding: 20 },
  row: { flexDirection: 'row' }
});