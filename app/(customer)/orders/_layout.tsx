import { Stack } from 'expo-router';

/**
 * Stack navigator for the Orders tab.
 * - index     → orders list (tab root)
 * - [id]      → order details
 * - tracking  → live tracking map
 */
export default function OrdersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="tracking" />
    </Stack>
  );
}
