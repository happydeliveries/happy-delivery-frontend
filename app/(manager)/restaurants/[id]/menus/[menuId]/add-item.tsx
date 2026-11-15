import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Text, TouchableOpacity, Image, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import Input from '../../../../../../components/common/Input';
import Button from '../../../../../../components/common/Button';
import { managerService } from '../../../../../../services/manager'; //
import api from '../../../../../../services/api'; // Keeping API for direct upload utility
import { colors } from '../../../../../../constants/colors';

export default function AddMenuItemScreen() {
  const { id, menuId } = useLocalSearchParams<{ id: string, menuId: string }>();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    image_url: '',
    is_veg: false,
    calories: '',
    preparation_time_minutes: '15',
    ingredients: '', // Comma separated for input
    tags: '' // Comma separated for input
  });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission Denied', 'We need access to your gallery to upload food photos.');
    }

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
      // NOTE: Using api.post directly here is fine for file uploads as it requires specific headers
      const response = await api.post('/restaurants/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Handle the unwrapped response structure from api.ts
      const url = response.data?.url || response.url;
      setForm(prev => ({ ...prev, image_url: url }));
    } catch (error) {
      Alert.alert('Upload Failed', 'Could not upload image to server.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.price) {
      return Alert.alert('Missing Info', 'Name and Price are required.');
    }
    
    setLoading(true);
    
    // Prepare "Vast Data" payload
    const payload = {
      ...form,
      price: parseFloat(form.price),
      calories: parseInt(form.calories) || 0,
      preparation_time_minutes: parseInt(form.preparation_time_minutes) || 15,
      // Convert comma-separated strings to arrays
      ingredients: form.ingredients.split(',').map(i => i.trim()).filter(i => i),
      tags: form.tags.split(',').map(t => t.trim()).filter(t => t)
    };

    try {
      // Use the manager service
      await managerService.addMenuItem(id, menuId, payload);
      
      Alert.alert('Success', 'Food item added!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Add Item Error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add item to menu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Add Food Item</Text>
          <View style={{width: 24}} />
        </View>
        
        {/* Image Picker */}
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={colors.primary} />
          ) : form.image_url ? (
            <Image source={{ uri: form.image_url }} style={styles.image} />
          ) : (
            <View style={styles.placeholderContent}>
              <Ionicons name="camera" size={32} color={colors.gray400} />
              <Text style={styles.imageText}>Add Food Photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Basic Info</Text>
          <Input label="Item Name" placeholder="e.g. Double Cheese Burger" value={form.name} onChangeText={t => setForm({...form, name: t})} />
          <Input label="Price (R)" placeholder="85.00" value={form.price} onChangeText={t => setForm({...form, price: t})} keyboardType="numeric" />
          <Input label="Description" placeholder="Ingredients, taste, etc." value={form.description} onChangeText={t => setForm({...form, description: t})} multiline />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Details (Optional)</Text>
          <Input label="Ingredients (comma separated)" placeholder="Beef, Cheese, Tomato" value={form.ingredients} onChangeText={t => setForm({...form, ingredients: t})} />
          <Input label="Tags (comma separated)" placeholder="Spicy, Best Seller" value={form.tags} onChangeText={t => setForm({...form, tags: t})} />
          
          <View style={styles.row}>
            <View style={{flex: 1, marginRight: 8}}>
              <Input label="Calories" placeholder="600" value={form.calories} onChangeText={t => setForm({...form, calories: t})} keyboardType="numeric" />
            </View>
            <View style={{flex: 1, marginLeft: 8}}>
              <Input label="Prep Time (mins)" value={form.preparation_time_minutes} onChangeText={t => setForm({...form, preparation_time_minutes: t})} keyboardType="numeric" />
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Is this Vegetarian?</Text>
            <Switch 
              value={form.is_veg} 
              onValueChange={v => setForm({...form, is_veg: v})} 
              trackColor={{ false: colors.gray300, true: colors.success }}
            />
          </View>
        </View>

        <Button title="Save Item" onPress={handleSave} loading={loading} style={{ marginVertical: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  imagePicker: { height: 200, backgroundColor: '#fff', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: colors.gray100, borderStyle: 'dashed' },
  image: { width: '100%', height: '100%' },
  placeholderContent: { alignItems: 'center' },
  imageText: { color: colors.gray500, marginTop: 8, fontWeight: '600' },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 20, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  sectionHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: colors.primary },
  row: { flexDirection: 'row' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  switchLabel: { fontSize: 16, fontWeight: '500', color: colors.textPrimary }
});