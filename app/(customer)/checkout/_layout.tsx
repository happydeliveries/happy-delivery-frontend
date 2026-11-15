import { Stack } from 'expo-router';

/**
 * Stack navigator for Checkout flow.
 */
export default function CheckoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
