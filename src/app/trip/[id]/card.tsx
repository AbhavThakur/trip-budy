import { router, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SpeakButton } from '@/components/speech';
import { IconButton, Row, Txt } from '@/components/ui';
import { useTrip } from '@/store/trips';
import { colors, space } from '@/theme';

/** Full-screen, high-contrast card to show a driver / shopkeeper / stranger. */
export default function ShowCard() {
  useKeepAwake();
  const { id, title, local, sub, english } = useLocalSearchParams<{ id: string; title?: string; local: string; sub?: string; english?: string }>();
  const trip = useTrip(id)!;
  const insets = useSafeAreaInsets();
  const isAddress = Boolean(title);
  const prefix = trip.speechLocale.startsWith('vi') && isAddress ? 'Làm ơn chở tôi đến:' : '';
  const spoken = `${prefix} ${local}`.trim();

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBEB', paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg }}>
      <StatusBar style="dark" />
      <Row style={{ paddingHorizontal: space.lg, justifyContent: 'space-between' }}>
        <IconButton icon="close" onPress={() => router.back()} bg="#0F172A" label="Close" />
        <SpeakButton text={spoken} locale={trip.speechLocale} size={52} />
      </Row>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl }}>
        {prefix ? (
          <Txt style={{ fontSize: 22, fontWeight: '700', color: '#78350F', marginBottom: space.md }}>{prefix}</Txt>
        ) : null}
        <Txt style={{ fontSize: 40, lineHeight: 50, fontWeight: '900', color: '#0F172A' }} selectable>
          {local}
        </Txt>
        {title ? (
          <Txt style={{ fontSize: 22, fontWeight: '800', color: '#1E293B', marginTop: space.xl }}>{title}</Txt>
        ) : null}
        {sub || english ? (
          <Txt style={{ fontSize: 17, color: '#475569', marginTop: space.sm }}>{sub || english}</Txt>
        ) : null}
      </ScrollView>
      <Txt v="small" color="#92400E" style={{ textAlign: 'center' }}>
        Show this screen · tap ▶ to play aloud
      </Txt>
      <View style={{ height: 4, backgroundColor: colors.gold, marginTop: space.sm }} />
    </View>
  );
}
