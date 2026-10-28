import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { UpdateGate } from '@/components/update-gate';
import { startReminders } from '@/lib/notify';
import { useTrips } from '@/store/trips';
import { startSync } from '@/sync/engine';
import { colors } from '@/theme';

export { ErrorBoundary } from 'expo-router';

void SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, border: colors.border, primary: colors.gold, text: colors.text },
};

export default function RootLayout() {
  useEffect(() => {
    useTrips.getState().reseedFromBundle();
    void SplashScreen.hideAsync();
    const stopSync = startSync();
    const stopReminders = startReminders();
    return () => {
      stopSync();
      stopReminders();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="join" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="new-trip" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="import-trip" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="trip/[id]" />
        </Stack>
        <UpdateGate />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
