import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

export default function ManagerLayout() {
  return (
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
              <Ionicons name={focused ? 'grid' : 'grid-outline'} size={size} color={color} />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="restaurants/index"
        options={{
          title: 'Restaurants',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={size} color={color} />
            </View>
          ),
        }}
      />
      
      {/* <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders/index',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <MaterialIcons name={focused ? 'receipt' : 'receipt'} size={size} color={color} />
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="analytics/index"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <Feather name={focused ? 'bar-chart-2' : 'bar-chart-2'} size={size} color={color} />
            </View>
          ),
        }}
      /> */}
      
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
        name="restaurants/create" 
        options={{ 
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }} 
      />

      <Tabs.Screen 
        name="restaurants/[id]/menus/[menuId]/add-item" 
        options={{ 
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }} 
      />

      <Tabs.Screen 
        name="restaurants/[id]/edit" 
        options={{ 
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }} 
      />

      <Tabs.Screen 
        name="restaurants/[id]/index" 
        options={{ 
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }} 
      />

      <Tabs.Screen 
        name="restaurants/[id]/menus/index" 
        options={{ 
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }} 
      />

      <Tabs.Screen 
        name="restaurants/[id]/menus/create" 
        options={{ 
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }} 
      />

      <Tabs.Screen 
        name="restaurants/[id]/menus/[menuId]/items/[itemId]/edit" 
        options={{ 
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }} 
      />

    </Tabs>
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