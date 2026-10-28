import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOta } from '@/lib/updates';
import { colors, radius, space } from '@/theme';

import { Icon, Txt } from './ui';

/** Floating "update ready" pill shown when a new OTA bundle has been downloaded. */
export function UpdateBanner() {
  const { state, restart } = useOta();
  const insets = useSafeAreaInsets();
  if (state !== 'ready') return null;
  return (
    <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={{ position: 'absolute', bottom: insets.bottom + 76, left: space.lg, right: space.lg, zIndex: 50 }}>
      <Pressable
        onPress={() => void restart()}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.emerald, elevation: 8 }}>
        <Icon name="sparkles" color={colors.bg} />
        <View style={{ flex: 1 }}>
          <Txt v="h3" color={colors.bg}>
            Trip update ready
          </Txt>
          <Txt v="small" color={colors.bg}>
            Tap to restart and load the latest itinerary
          </Txt>
        </View>
        <Icon name="refresh" color={colors.bg} />
      </Pressable>
    </Animated.View>
  );
}
