import { Redirect } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  // Redirect based on user role
  switch (user.role) {
    case 'customer':
      return <Redirect href="/(customer)/home" />;
    case 'driver':
      return <Redirect href="/(driver)/dashboard" />;
    case 'restaurant_manager':
      return <Redirect href="/(manager)/dashboard" />;
    default:
      return <Redirect href="/(auth)/welcome" />;
  }
}