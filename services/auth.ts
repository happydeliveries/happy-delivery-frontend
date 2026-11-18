import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authService = {
  async register(data: {
    email: string;
    password: string;
    role: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    [key: string]: any;
  }) {
    return api.post('/auth/register', data);
  },

  async login(email: string, password: string) {
    return api.post('/auth/login', { email, password });
  },

  async uploadAvatar(uri: string) {
    const cleanName = uri.split('/').pop() || `selfie-${Date.now()}.jpg`;
    const ext = cleanName.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const formData = new FormData();
    formData.append('image', {
      uri,
      name: cleanName.includes('.') ? cleanName : `${cleanName}.jpg`,
      type: mimeType,
    } as any);
    return api.post('/auth/upload-avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    });
  },

  async verifyEmail(payload: { email?: string; code?: string; token?: string }) {
    return api.post('/auth/verify-email', payload);
  },

  async resendVerification(email: string) {
    return api.post('/auth/resend-verification', { email });
  },

  async getCurrentUser() {
    return api.get('/auth/me');
  },

  async getProfile() {
    return api.get('/auth/me');
  },

  async updateProfile(data: any) {
    return api.put('/users/profile', data);
  },

  async updateRoleProfile(data: any) {
    return api.put('/users/role-profile', data);
  },

  async getAddresses() {
    return api.get('/users/addresses');
  },

  async addAddress(address: {
    label?: string;
    street: string;
    city?: string;
    postal_code?: string;
    instructions?: string;
    latitude?: number;
    longitude?: number;
    is_default?: boolean;
  }) {
    return api.post('/users/addresses', address);
  },

  async removeAddress(addressId: string) {
    return api.delete(`/users/addresses/${encodeURIComponent(addressId)}`);
  },

  async setDefaultAddress(addressId: string) {
    return api.patch(`/users/addresses/${encodeURIComponent(addressId)}/default`);
  },

  async geocodeAddress(address: {
    street?: string;
    city?: string;
    postal_code?: string;
    formattedAddress?: string;
  }) {
    return api.post('/restaurants/geocode-address', address);
  },

  async logout() {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    return Promise.resolve();
  },
};

export const userService = {
  updateProfile: authService.updateProfile,
  updateRoleProfile: authService.updateRoleProfile,
  getAddresses: authService.getAddresses,
  addAddress: authService.addAddress,
  removeAddress: authService.removeAddress,
  setDefaultAddress: authService.setDefaultAddress,
  geocodeAddress: authService.geocodeAddress,
};