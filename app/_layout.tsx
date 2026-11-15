import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from '../hooks/useAuth';
import { CartProvider } from '../store/cartStore';
import { theme } from '../constants/theme';

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <CartProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(customer)" />
            <Stack.Screen name="(driver)" />
            <Stack.Screen name="(manager)" />
          </Stack>
        </CartProvider>
      </AuthProvider>
    </PaperProvider>
  );
}