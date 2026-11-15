import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Text, TouchableOpacity, Modal, ActivityIndicator, Image } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import { managerService } from '../../../services/manager';
import { colors } from '../../../constants/colors';
import api from '../../../services/api';

export default function CreateRestaurantScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [form, setForm] = useState({
    name: '',
    cuisine_type: '',
    description: '',
    address: '',
    phone_number: '',
    opening_hours: '08:00 - 21:00',
    preparation_time: '20',
    latitude: -23.9430,
    longitude: 31.1410,
    logo_url: '',
    cover_url: ''
  });

  // --- IMAGE UPLOAD LOGIC ---
  const pickImage = async (type: 'logo' | 'cover') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Gallery access is needed for photos.');
        return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.7,
    });

    if (!result.canceled) {
        uploadImage(result.assets[0].uri, type);
    }
  };

  const uploadImage = async (uri: string, type: 'logo' | 'cover') => {
    const isLogo = type === 'logo';
    isLogo ? setUploadingLogo(true) : setUploadingCover(true);

    const formData = new FormData();
    // @ts-ignore
    formData.append('image', {
        uri,
        type: 'image/jpeg',
        name: `${type}.jpg`,
    });

    try {
        const response = await api.post('/restaurants/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        
        const imageUrl = response?.data?.url || response?.url;
        
        if (imageUrl) {
            setForm(prev => ({
                ...prev,
                [isLogo ? 'logo_url' : 'cover_url']: imageUrl
            }));
        } else {
            throw new Error('No URL returned from server');
        }
    } catch (error) {
        console.error('Upload error:', error);
        Alert.alert('Upload Failed', 'Could not save image to cloud storage.');
    } finally {
        isLogo ? setUploadingLogo(false) : setUploadingCover(false);
    }
  };

  // --- MAP LOGIC ---
  const handleMapPress = async (coords: { latitude: number, longitude: number }) => {
    setForm(prev => ({ ...prev, ...coords }));
    
    // Auto-fetch address from coordinates (Reverse Geocoding)
    try {
      const reverse = await Location.reverseGeocodeAsync(coords);
      if (reverse.length > 0) {
        const { street, streetNumber, city, region } = reverse[0];
        const fullAddress = `${streetNumber || ''} ${street || ''}, ${city || ''}, ${region || ''}`.trim();
        setForm(prev => ({ ...prev, address: fullAddress }));
      }
    } catch (e) {
      console.log("Geocoding failed");
    }
  };

  // --- FINAL SUBMISSION ---
  const handleCreate = async () => {
    if (!form.name || !form.address || !form.description) {
      return Alert.alert('Missing Info', 'Please provide a name, description, and address.');
    }

    setLoading(true);
    try {
      await managerService.createRestaurant(form);
      Alert.alert('Success', 'Restaurant created successfully!', [
        { text: 'OK', onPress: () => router.replace('/(manager)/restaurants') }
      ]);
    } catch (error: any) {
      console.error('Create restaurant error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to establish restaurant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headerTitle}>Establish Restaurant</Text>

        <Input 
          label="Business Name" 
          value={form.name} 
          onChangeText={(t) => setForm({...form, name: t})} 
        />
        
        <Input 
          label="Description" 
          placeholder="Tell customers about your kitchen..." 
          multiline 
          numberOfLines={4} 
          textAlignVertical="top"
          value={form.description} 
          onChangeText={(t) => setForm({...form, description: t})} 
        />

        <Input 
          label="Cuisine Type" 
          placeholder="e.g. Traditional African, Italian" 
          value={form.cuisine_type} 
          onChangeText={(t) => setForm({...form, cuisine_type: t})} 
        />

        {/* --- IMAGE PICKERS --- */}
        <Text style={styles.label}>Branding</Text>
        <View style={styles.imageRow}>
          <TouchableOpacity 
            style={styles.logoPicker} 
            onPress={() => pickImage('logo')} 
            disabled={uploadingLogo}
          >
            {uploadingLogo ? (
                <ActivityIndicator color={colors.primary} />
            ) : form.logo_url ? (
                <Image source={{ uri: form.logo_url }} style={styles.previewImage} />
            ) : (
                <>
                    <Ionicons name="camera" size={24} color={colors.primary} />
                    <Text style={styles.imageLabel}>Logo</Text>
                </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.coverPicker} 
            onPress={() => pickImage('cover')} 
            disabled={uploadingCover}
          >
            {uploadingCover ? (
                <ActivityIndicator color={colors.primary} />
            ) : form.cover_url ? (
                <Image source={{ uri: form.cover_url }} style={styles.previewImage} />
            ) : (
                <>
                    <Ionicons name="images" size={24} color={colors.primary} />
                    <Text style={styles.imageLabel}>Cover Photo</Text>
                </>
            )}
          </TouchableOpacity>
        </View>

        {/* --- LOCATION --- */}
        <Text style={styles.label}>Location Details</Text>
        <View style={styles.locationControls}>
          <TouchableOpacity style={styles.mapBtn} onPress={() => setShowMap(true)}>
            <MaterialIcons name="add-location-alt" size={20} color={colors.primary} />
            <Text style={styles.mapBtnText}>Pin on Map</Text>
          </TouchableOpacity>
        </View>
        
        <Input 
          label="Address" 
          multiline 
          value={form.address} 
          onChangeText={(t) => setForm({...form, address: t})} 
        />

        <View style={styles.row}>
          <Input 
            label="Opening Hours" 
            placeholder="08:00 - 20:00" 
            style={{flex: 1.5}} 
            value={form.opening_hours} 
            onChangeText={(t) => setForm({...form, opening_hours: t})} 
          />
          <View style={{width: 10}} />
          <Input 
            label="Prep Time (m)" 
            placeholder="20" 
            keyboardType="numeric" 
            style={{flex: 1}} 
            value={form.preparation_time} 
            onChangeText={(t) => setForm({...form, preparation_time: t})} 
          />
        </View>

        <Button 
          title="Save Restaurant" 
          onPress={handleCreate} 
          loading={loading} 
          style={styles.submitBtn} 
        />

        {/* --- MAP PICKER MODAL --- */}
        <Modal visible={showMap} animationType="fade">
          <View style={styles.modalContainer}>
            <MapView 
              provider={PROVIDER_GOOGLE} 
              style={styles.fullMap} 
              initialRegion={{
                latitude: form.latitude, 
                longitude: form.longitude, 
                latitudeDelta: 0.005, 
                longitudeDelta: 0.005,
              }} 
              onPress={(e) => handleMapPress(e.nativeEvent.coordinate)}
            >
              <Marker 
                draggable 
                coordinate={{ latitude: form.latitude, longitude: form.longitude }} 
                onDragEnd={(e) => handleMapPress(e.nativeEvent.coordinate)} 
              />
            </MapView>
            <View style={styles.mapFooter}>
              <Text style={styles.previewAddress}>{form.address || "Select a location..."}</Text>
              <Button title="Confirm Location" onPress={() => setShowMap(false)} />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', marginVertical: 10, color: colors.textPrimary },
  imageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  logoPicker: { 
    flex: 0.3, 
    height: 80, 
    borderStyle: 'dashed', 
    borderWidth: 1, 
    borderColor: colors.primary, 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: colors.primary + '05', 
    overflow: 'hidden' 
  },
  coverPicker: { 
    flex: 0.65, 
    height: 80, 
    borderStyle: 'dashed', 
    borderWidth: 1, 
    borderColor: colors.primary, 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: colors.primary + '05', 
    overflow: 'hidden' 
  },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageLabel: { fontSize: 11, color: colors.primary, marginTop: 4, fontWeight: '600' },
  locationControls: { marginBottom: 10 },
  mapBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 10, 
    backgroundColor: colors.primary + '10', 
    borderStyle: 'dashed', 
    borderWidth: 1, 
    borderColor: colors.primary 
  },
  mapBtnText: { marginLeft: 8, color: colors.primary, fontWeight: 'bold' },
  row: { flexDirection: 'row' },
  submitBtn: { marginTop: 30, marginBottom: 50 },
  modalContainer: { flex: 1 },
  fullMap: { ...StyleSheet.absoluteFillObject },
  mapFooter: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: '#fff', 
    padding: 20, 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    elevation: 10 
  },
  previewAddress: { textAlign: 'center', marginBottom: 15, fontSize: 14, color: colors.textSecondary }
});