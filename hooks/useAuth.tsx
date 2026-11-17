import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/auth';
import { router } from 'expo-router';
import { releaseDriverOrderAlertResources } from '../services/driverAlertSound';
import { useDriverAlertStore } from '../store/driverAlertStore';
import { useAddressStore } from '../store/addressStore';
import { useFeedbackStore } from '../store/feedbackStore';

type User = {
  id: string;
  email: string;
  role: 'customer' | 'driver' | 'restaurant_manager';
  first_name: string;
  last_name: string;
  phone_number: string;
  profile_image_url?: string;
};

type AuthContextType = {
  user: User | null;
  token?: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUserRaw = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUserRaw) {
        const storedUser = JSON.parse(storedUserRaw);
        setToken(storedToken);
        setUser(storedUser);
        
        // Verify token with backend
        try {
          const currentUser = await authService.getProfile();
          // API interceptor returns response.data directly.
          // Backend may return: { user: {...} } or { data: { user: {...} } } or just the user object
          const freshUser = (currentUser as any)?.user ?? (currentUser as any)?.data?.user ?? currentUser;
          if (freshUser?.id) {
            setUser(freshUser);
            await AsyncStorage.setItem('user', JSON.stringify(freshUser));
            if (freshUser.role === 'customer') {
              useAddressStore.getState().syncSavedAddresses().catch(() => {});
            }
          }
        } catch (err: any) {
          // Only clear token on 401 Unauthorized — not on network timeouts or 500/503 DB errors
          if (err?.response?.status === 401) {
            await authService.logout();
            useAddressStore.getState().resetForLogout();
            setToken(null);
            setUser(null);
          } else if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.log('Keeping cached auth session (profile check skipped due to connection)');
          }
        }
      }
    } catch {
      // Ignore AsyncStorage read glitches on boot
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authService.login(email, password);
    
    // API interceptor returns response.data directly
    // Backend returns: { token: "...", user: {...} }
    const nextToken = (response as any)?.token ?? (response as any)?.data?.token;
    const nextUser = (response as any)?.user ?? (response as any)?.data?.user;

    if (!nextToken || !nextUser) throw new Error('Invalid login response from server');

    await AsyncStorage.setItem('token', nextToken);
    await AsyncStorage.setItem('user', JSON.stringify(nextUser));
    
    setToken(nextToken);
    setUser(nextUser);
    if (nextUser.role === 'customer') {
      useAddressStore.getState().syncSavedAddresses().catch(() => {});
    }

    // Redirect based on role
    switch (nextUser.role) {
      case 'customer':
        router.replace('/(customer)/home');
        break;
      case 'driver':
        router.replace('/(driver)/dashboard');
        break;
      case 'restaurant_manager':
        router.replace('/(manager)/dashboard');
        break;
    }
  };

  const register = async (data: any) => {
    const response = await authService.register(data);

    // If registering a driver account, it requires manager approval before login
    if ((response as any)?.pending_approval || (response as any)?.data?.pending_approval) {
      useFeedbackStore.getState().showPopup({
        type: 'success',
        title: 'Application Pending Approval',
        message:
          (response as any)?.message ||
          'Your driver application has been submitted for manager review. You will receive an email once your account is approved and ready to sign in.',
        primaryLabel: 'OK',
        onPrimary: () => router.replace('/(auth)/login'),
      });
      router.replace('/(auth)/login');
      return;
    }
    
    // API interceptor returns response.data directly
    const nextToken = (response as any)?.token ?? (response as any)?.data?.token;
    const nextUser = (response as any)?.user ?? (response as any)?.data?.user;

    if (!nextToken || !nextUser) throw new Error('Invalid register response from server');

    await AsyncStorage.setItem('token', nextToken);
    await AsyncStorage.setItem('user', JSON.stringify(nextUser));
    
    setToken(nextToken);
    setUser(nextUser);
    if (nextUser.role === 'customer') {
      useAddressStore.getState().syncSavedAddresses().catch(() => {});
    }

    // Redirect based on role
    switch (nextUser.role) {
      case 'customer':
        router.replace('/(customer)/home');
        break;
      case 'driver':
        router.replace('/(driver)/dashboard');
        break;
      case 'restaurant_manager':
        router.replace('/(manager)/dashboard');
        break;
    }
  };

  const logout = async () => {
    await releaseDriverOrderAlertResources();
    useDriverAlertStore.getState().reset();
    useAddressStore.getState().resetForLogout();
    await authService.logout();
    setToken(null);
    setUser(null);
    router.replace('/(auth)/welcome');
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}