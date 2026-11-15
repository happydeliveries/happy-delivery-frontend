import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Input from '../../../components/common/Input';
import Button from '../../../components/common/Button';
import { driverService } from '../../../services/driver';
import { colors } from '../../../constants/colors';

export default function EditVehicleScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    vehicle_model: '',
    vehicle_color: '',
    vehicle_registration: '',
    vehicle_type: 'Car',
    driver_license_number: '',
  });

  useEffect(() => {
    loadCurrentVehicle();
  }, []);

  const loadCurrentVehicle = async () => {
    try {
      const response = await driverService.getProfile();
      const data = response.data || response;
      setForm({
        vehicle_model: data.vehicle_model || '',
        vehicle_color: data.vehicle_color || '',
        vehicle_registration: data.vehicle_registration || '',
        vehicle_type: data.vehicle_type || 'Car',
        driver_license_number: data.driver_license_number || '',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to load vehicle info');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await driverService.updateVehicleInfo(form);
      Alert.alert('Success', 'Vehicle information updated successfully');
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to update information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Input
          label="Vehicle Model"
          value={form.vehicle_model}
          onChangeText={(text) => setForm({ ...form, vehicle_model: text })}
          placeholder="e.g. Toyota Corolla"
        />
        <Input
          label="Vehicle Color"
          value={form.vehicle_color}
          onChangeText={(text) => setForm({ ...form, vehicle_color: text })}
          placeholder="e.g. White"
        />
        <Input
          label="Registration (Plate Number)"
          value={form.vehicle_registration}
          onChangeText={(text) => setForm({ ...form, vehicle_registration: text })}
          placeholder="e.g. NSP 123 MP"
        />
        <Button 
          title="Save Changes" 
          onPress={handleSave} 
          loading={loading} 
          style={styles.button}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20 },
  button: { marginTop: 20 }
});