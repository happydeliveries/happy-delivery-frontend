import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../services/auth';
import { router } from 'expo-router';
import { releaseDriverOrderAlertResources } from '../services/driverAlertSound';
import { useDriverAlertStore } from '../store/driverAlertStore';
import { useAddressStore } from '../store/addressStore';

type User = {
  id: string;
  email: string;
  role: 'customer' | 'driver' | 'restaurant_manager';
  first_name: string;
  last_name: string;
  phone_number: string;
  profile_image_url?: string;
  email_verified?: boolean;
};

type AuthContextType = {
  user: User | null;
  token?: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  verifyEmail: (payload: { email: string; code: string }) => Promise<{ verified: boolean; pendingApproval: boolean }>;
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

  const navigateByRole = (role?: string) => {
    switch (role) {
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

  const applyAuthenticatedSession = async (nextToken: string, nextUser: User) => {
    await AsyncStorage.setItem('token', nextToken);
    await AsyncStorage.setItem('user', JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    if (nextUser.role === 'customer') {
      useAddressStore.getState().syncSavedAddresses().catch(() => {});
    }
    navigateByRole(nextUser.role);
  };

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUserRaw = await AsyncStorage.getItem('user');

      if (storedToken && storedUserRaw) {
        const storedUser = JSON.parse(storedUserRaw);
        setToken(storedToken);
        setUser(storedUser);

        try {
          const currentUser = await authService.getProfile();
          const freshUser = (currentUser as any)?.user ?? (currentUser as any)?.data?.user ?? currentUser;
          if (freshUser?.id) {
            setUser(freshUser);
            await AsyncStorage.setItem('user', JSON.stringify(freshUser));
            if (freshUser.role === 'customer') {
              useAddressStore.getState().syncSavedAddresses().catch(() => {});
            }
          }
        } catch (err: any) {
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
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
    const nextToken = (response as any)?.token ?? (response as any)?.data?.token;
    const nextUser = (response as any)?.user ?? (response as any)?.data?.user;

    if (!nextToken || !nextUser) throw new Error('Invalid login response from server');
    await applyAuthenticatedSession(nextToken, nextUser);
  };

  const register = async (data: any) => {
    const response: any = await authService.register(data);
    const requiresVerify =
      Boolean(response?.requires_email_verification) ||
      Boolean(response?.data?.requires_email_verification);
    const pendingApproval =
      Boolean(response?.pending_approval) ||
      Boolean(response?.data?.pending_approval);
    const registeredUser = response?.user ?? response?.data?.user;

    if (requiresVerify) {
      const emailParam = encodeURIComponent(String(registeredUser?.email || data?.email || ''));
      const roleParam = encodeURIComponent(String(registeredUser?.role || data?.role || 'customer'));
      router.replace(
        `/(auth)/verify-email?email=${emailParam}&role=${roleParam}&pendingApproval=${pendingApproval ? '1' : '0'}`
      );
      return;
    }

    const nextToken = response?.token ?? response?.data?.token;
    const nextUser = response?.user ?? response?.data?.user;
    if (!nextToken || !nextUser) throw new Error('Invalid register response from server');
    await applyAuthenticatedSession(nextToken, nextUser);
  };

  const verifyEmail = async ({ email, code }: { email: string; code: string }) => {
    const res: any = await authService.verifyEmail({ email, code });
    const data = res?.data ?? res;
    const nextToken = data?.token;
    const nextUser = data?.user;
    const pendingApproval = Boolean(data?.pending_approval ?? res?.pending_approval);

    if (nextToken && nextUser && !pendingApproval) {
      await applyAuthenticatedSession(nextToken, nextUser);
      return { verified: true, pendingApproval: false };
    }

    return { verified: true, pendingApproval };
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
        verifyEmail,
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
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
