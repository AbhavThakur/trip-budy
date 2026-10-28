import { Ionicons } from '@expo/vector-icons';
import { Tabs, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WhoAmIContext, WhoAmISheet } from '@/components/identity';
import { tap } from '@/lib/haptics';
import { TripIdContext } from '@/lib/trip-context';
import { requestSync } from '@/sync/engine';
import { requestNotifications, rescheduleReminders } from '@/lib/notify';
import { useSession } from '@/store/session';
import { useTrip } from '@/store/trips';
import { colors } from '@/theme';

const ICONS = {
  index: ['compass', 'compass-outline'],
  map: ['map', 'map-outline'],
  wallet: ['wallet', 'wallet-outline'],
  vault: ['shield-checkmark', 'shield-checkmark-outline'],
} as const;

export default function TripTabs() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const trip = useTrip(id)!;
  const me = useSession((s) => s.me[id]);
  const [whoOpen, setWhoOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const asked = useSession((s) => s.reminders.asked);
  useEffect(() => {
    void requestSync();
  }, [id]);
  useEffect(() => {
    if (me && !asked) void requestNotifications().then(() => rescheduleReminders());
  }, [me, asked]);
  return (
    <TripIdContext.Provider value={id}>
      <WhoAmIContext.Provider value={() => setWhoOpen(true)}>
        <Tabs
          screenListeners={{ tabPress: () => tap() }}
          screenOptions={({ route }) => ({
            headerShown: false,
            sceneStyle: { backgroundColor: colors.bg },
            tabBarActiveTintColor: colors.gold,
            tabBarInactiveTintColor: colors.textMute,
            tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: 62 + insets.bottom,
              paddingTop: 6,
              paddingBottom: insets.bottom + 6,
            },
            tabBarIcon: ({ focused, color, size }) => {
              const pair = ICONS[route.name as keyof typeof ICONS];
              return <Ionicons name={pair ? pair[focused ? 0 : 1] : 'ellipse'} color={String(color)} size={size} />;
            },
          })}>
          <Tabs.Screen name="index" options={{ title: 'Expedition' }} />
          <Tabs.Screen name="map" options={{ title: 'Radar' }} />
          <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
          <Tabs.Screen name="vault" options={{ title: 'Vault' }} />
        </Tabs>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: colors.bg,
          }}
        />
        <WhoAmISheet
          trip={trip}
          visible={whoOpen || (!me && !dismissed)}
          onClose={() => {
            setWhoOpen(false);
            setDismissed(true);
          }}
        />
      </WhoAmIContext.Provider>
    </TripIdContext.Provider>
  );
}
