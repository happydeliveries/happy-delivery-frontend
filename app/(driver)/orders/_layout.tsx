import { Stack } from 'expo-router';

export const unstable_settings = {
  anchor: 'index',
};

/**
 * Stack navigator for the Driver Orders tab.
 * Keeps `orders` as a single visible tab in `(driver)/_layout.tsx` so navigating
 * to `[id]` or `scan` pushes onto the stack instead of triggering a tab redirect.
 */
export default function DriverOrdersLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="scan" />
    </Stack>
  );
}
