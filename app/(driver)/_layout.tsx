import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { Alert, Vibration } from 'react-native'; // Import Vibration
import { Tabs, Stack, router } from 'expo-router';

import { useSocket } from '../../hooks/useSocket';
// ... other imports

export default function DriverLayout() {
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    // Listen for the 'new_order' event
    socket.on('new_order', (data) => {

      // 1. Vibrate phone to get attention (500ms)
      Vibration.vibrate(500);

      // 2. Show Alert Popup
      Alert.alert(
        "🔔 New Order Available!",
        `Pickup from ${data.restaurantName} - R${data.total}`,
        [
          { text: "Ignore", style: "cancel" },
          { 
            text: "View Order", 
            onPress: () => router.push(`/(driver)/orders/${data.orderId}`) 
          }
        ]
      );
    });

    // Cleanup listener
    return () => {
      socket.off('new_order');
    };
  }, [socket]);

  return (
    // <Stack>
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray500,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <Ionicons name={focused ? 'speedometer' : 'speedometer-outline'} size={size} color={color} />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="orders/index"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <MaterialIcons name={focused ? 'delivery-dining' : 'delivery-dining'} size={size} color={color} />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="earnings/index"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <FontAwesome5 name={focused ? 'money-bill-alt' : 'money-bill-alt'} size={size} color={color} />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile/vehicle"
        options={{ 
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />

      <Tabs.Screen
        name="orders/[id]"
        options={{ 
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />

    </Tabs>
    // </Stack>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopColor: '#eee',
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  activeIcon: {
    color: colors.primary + '20',
    borderRadius: 20,
  },
});