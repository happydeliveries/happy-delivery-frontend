import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Text, TouchableOpacity, Image, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import Input from '../../../../../../../../components/common/Input';
import Button from '../../../../../../../../components/common/Button';
import { managerService } from '../../../../../../../../services/manager';
import api from '../../../../../../../../services/api';
import { colors } from '../../../../../../../../constants/colors';

export default function EditMenuItemScreen() {
  const { id, menuId, itemId } = useLocalSearchParams<{ id: string, menuId: string, itemId: string }>();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    image_url: '',
    is_veg: false,
    is_available: true,
    calories: '',
    preparation_time_minutes: '',
    ingredients: '',
    tags: ''
  });

  useEffect(() => {
    fetchItemDetails();
  }, []);

  const fetchItemDetails = async () => {
    try {
      const response = await managerService.getMenuItem(id, menuId, itemId);
      const item = response.data || response;
      
      setForm({
        name: item.name,
        description: item.description || '',
        price: String(item.price),
        image_url: item.image_url || '',
        is_veg: item.is_veg || false,
        is_available: item.is_available ?? true,
        calories: String(item.calories || ''),
        preparation_time_minutes: String(item.preparation_time_minutes || ''),
        // Convert arrays back to comma-separated strings for editing
        ingredients: Array.isArray(item.ingredients) ? item.ingredients.join(', ') : '',
        tags: Array.isArray(item.tags) ? item.tags.join(', ') : ''
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load item details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    const formData = new FormData();
    // @ts-ignore
    formData.append('image', { uri, type: 'image/jpeg', name: 'food.jpg' });

    try {
      const response = await api.post('/restaurants/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = response.data?.url || response.url;
      setForm(prev => ({ ...prev, image_url: url }));
    } catch (error) {
      Alert.alert('Error', 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return Alert.alert('Error', 'Name and Price required');
    setSaving(true);
    
    const payload = {
      ...form,
      price: parseFloat(form.price),
      calories: parseInt(form.calories) || 0,
      preparation_time_minutes: parseInt(form.preparation_time_minutes) || 15,
      ingredients: form.ingredients.split(',').map(i => i.trim()).filter(i => i),
      tags: form.tags.split(',').map(t => t.trim()).filter(t => t)
    };

    try {
      await managerService.updateMenuItem(id, menuId, itemId, payload);
      Alert.alert('Success', 'Item Updated!');
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to update item');
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
          <Text style={styles.title}>Edit Item</Text>
          <View style={{width: 24}} />
        </View>

        <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={colors.primary} />
          ) : form.image_url ? (
            <Image source={{ uri: form.image_url }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="camera" size={32} color={colors.gray400} />
              <Text style={styles.phText}>Change Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Basic Info</Text>
          <Input label="Item Name" value={form.name} onChangeText={t => setForm({...form, name: t})} />
          <Input label="Price (R)" value={form.price} onChangeText={t => setForm({...form, price: t})} keyboardType="numeric" />
          <Input label="Description" value={form.description} onChangeText={t => setForm({...form, description: t})} multiline />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Details</Text>
          <Input label="Ingredients (comma separated)" value={form.ingredients} onChangeText={t => setForm({...form, ingredients: t})} />
          <Input label="Tags (comma separated)" value={form.tags} onChangeText={t => setForm({...form, tags: t})} />
          
          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 8}}>
              <Input label="Calories" value={form.calories} onChangeText={t => setForm({...form, calories: t})} keyboardType="numeric" />
            </View>
            <View style={{flex: 1, marginLeft: 8}}>
              <Input label="Prep Time" value={form.preparation_time_minutes} onChangeText={t => setForm({...form, preparation_time_minutes: t})} keyboardType="numeric" />
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Vegetarian?</Text>
            <Switch value={form.is_veg} onValueChange={v => setForm({...form, is_veg: v})} trackColor={{true: colors.success}} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>In Stock (Available)</Text>
            <Switch value={form.is_available} onValueChange={v => setForm({...form, is_available: v})} trackColor={{true: colors.primary}} />
          </View>
        </View>

        <Button title="Save Changes" onPress={handleSave} loading={saving} style={{ marginVertical: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 'bold' },
  imagePicker: { height: 200, backgroundColor: '#fff', borderRadius: 12, marginBottom: 20, overflow: 'hidden', elevation: 2 },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  phText: { color: colors.gray400, marginTop: 5, fontWeight: '600' },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 20, elevation: 1 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: colors.primary },
  row: { flexDirection: 'row' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  switchLabel: { fontSize: 16, fontWeight: '500' }
});