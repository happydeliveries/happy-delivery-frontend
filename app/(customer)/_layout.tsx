import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useCartStore } from '../../store/cartStore';

export default function CustomerLayout() {
  const cartCount = useCartStore((state) =>
    state.items.reduce((count, item) => count + item.quantity, 0)
  );

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
      {/* ── Visible Tab Screens ── */}
      {/* Each name maps to a sub-folder that has its own _layout.tsx (Stack) */}

      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <Ionicons name={focused ? 'search' : 'search-outline'} size={size} color={color} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <MaterialIcons name="receipt-long" size={size} color={color} />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <Ionicons name={focused ? 'cart' : 'cart-outline'} size={size} color={color} />
            </View>
          ),
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeIcon : null}>
              <Feather name="user" size={size} color={color} />
            </View>
          ),
        }}
      />

      {/* ── Hidden "tab" slots for folders that should not appear in the tab bar ── */}
      <Tabs.Screen
        name="menu"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          tabBarStyle: { display: 'none' },
        }}
      />

      <Tabs.Screen
        name="checkout"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
          tabBarStyle: { display: 'none' },
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
