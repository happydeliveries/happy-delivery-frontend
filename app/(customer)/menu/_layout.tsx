import { Stack } from 'expo-router';

/**
 * Stack navigator for the Menu tab (accessed via deals / discount items).
 * - [id]  → individual menu item detail
 */
export default function MenuLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
