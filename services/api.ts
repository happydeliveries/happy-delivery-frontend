import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../constants/api';

const api = axios.create({
  baseURL: API_CONFIG.API_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    let errorMessage = 'Something went wrong';

    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }

    if (error.response) {
      // Server responded with an error (e.g., 400, 500, 503)
      errorMessage = error.response.data?.error || error.response.data?.message || errorMessage;
    } else if (error.request) {
      // Request was made but no response was received (Server is down, timeout, or ECONNRESET)
      errorMessage = 'Network error: Cannot reach the server';
    } else {
      errorMessage = error.message;
    }

    console.error(`[API ERROR] ${error.config?.method?.toUpperCase()} ${error.config?.baseURL}${error.config?.url}:`, errorMessage);
    if (error && typeof error === 'object') {
      error.message = errorMessage;
      error.toString = () => errorMessage;
      return Promise.reject(error);
    }
    return Promise.reject(errorMessage);
  }
);

export default api;