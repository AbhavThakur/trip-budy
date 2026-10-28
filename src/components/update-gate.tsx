import { ActivityIndicator, Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOta, useOtaLifecycle } from '@/lib/updates';
import { colors, radius, space } from '@/theme';

import { Button, Icon, Txt } from './ui';

/**
 * Blocking full-screen update screen. It cannot be dismissed (back button is swallowed) —
 * the only way forward is to install the update. Shown while an update downloads and once it is ready.
 */
export function UpdateGate() {
  useOtaLifecycle();
  const { state, restart } = useOta();
  const insets = useSafeAreaInsets();
  const visible = state === 'downloading' || state === 'ready';
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => undefined}>
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.xxl, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.gold }}>
          {state === 'ready' ? <Icon name="sparkles" size={44} color={colors.gold} /> : <ActivityIndicator size="large" color={colors.gold} />}
        </View>
        <Txt v="h1" style={{ marginTop: space.xl, textAlign: 'center' }}>
          {state === 'ready' ? 'Update required' : 'Downloading update…'}
        </Txt>
        <Txt v="body" color={colors.textDim} style={{ marginTop: space.sm, textAlign: 'center' }}>
          {state === 'ready'
            ? 'A new version of Trip Buddy with important fixes is ready. Install it to continue — it takes a few seconds and keeps all your data.'
            : 'Please keep the app open. This only takes a moment.'}
        </Txt>
        {state === 'ready' && (
          <View style={{ alignSelf: 'stretch', marginTop: space.xxl, borderRadius: radius.md }}>
            <Button label="Install update" icon="refresh" onPress={() => void restart()} />
          </View>
        )}
      </View>
    </Modal>
  );
}
