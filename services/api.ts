import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../constants/api';
import { getFriendlyError } from '../utils/errorMessages';

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

// Response interceptor to handle errors cleanly without triggering Expo LogBox
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    let rawMessage = 'Something went wrong';

    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }

    if (error.response) {
      rawMessage = error.response.data?.error || error.response.data?.message || rawMessage;
    } else if (error.request) {
      rawMessage = 'Network error: Cannot reach the server';
    } else if (error?.message) {
      rawMessage = error.message;
    }

    const friendly = getFriendlyError({
      status: error.response?.status,
      url: error.config?.url,
      rawMessage,
      message: rawMessage,
      response: error.response,
    });

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(
        `[API Notice] ${error.config?.method?.toUpperCase() || 'REQ'} ${error.config?.url || ''}: ${rawMessage}`
      );
    }

    if (error && typeof error === 'object') {
      error.rawMessage = rawMessage;
      error.friendlyTitle = friendly.title;
      error.friendlyMessage = friendly.message;
      error.message = friendly.message;
      error.toString = () => friendly.message;
      return Promise.reject(error);
    }
    return Promise.reject(friendly.message);
  }
);

export default api;