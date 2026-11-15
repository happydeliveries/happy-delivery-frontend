import { Stack } from 'expo-router';

/**
 * Stack navigator for the Home tab.
 * - index              → the main home screen (tab root)
 * - restaurant-details → restaurant & menu details pushed on top
 */
export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="restaurant-details" />
    </Stack>
  );
}
