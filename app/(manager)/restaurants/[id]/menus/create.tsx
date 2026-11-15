import React, { useState } from 'react';
import { View, StyleSheet, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Input from '../../../../../components/common/Input';
import Button from '../../../../../components/common/Button';
import { managerService } from '../../../../../services/manager';
import { colors } from '../../../../../constants/colors';

export default function CreateMenuCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name) return Alert.alert('Error', 'Category name is required');
    setLoading(true);
    try {
      await managerService.createMenu(id, { name, description });
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>New Menu Category</Text>
        <Text style={styles.subtitle}>e.g. Breakfast, Drinks, Specials</Text>
        
        <Input label="Category Name" value={name} onChangeText={setName} placeholder="Breakfast" />
        <Input label="Description (Optional)" value={description} onChangeText={setDescription} placeholder="Served until 11am" />
        
        <Button title="Create Category" onPress={handleCreate} loading={loading} style={{ marginTop: 20 }} />
        <Button title="Cancel" variant="outline" onPress={() => router.back()} style={{ marginTop: 10 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 30, marginTop: 5 }
});