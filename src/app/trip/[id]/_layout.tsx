import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import { useTrip } from '@/store/trips';
import { colors } from '@/theme';

export default function TripLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id);
  if (!trip) return <Redirect href="/" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="expense" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="card" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="doc/[docId]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
    </Stack>
  );
}
