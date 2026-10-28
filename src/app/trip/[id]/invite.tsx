import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Share, Switch, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useJoinStates } from '@/components/identity';
import { Screen } from '@/components/screen';
import { Avatar, Button, Card, Icon, Pill, Row, SectionTitle, Txt } from '@/components/ui';
import { success } from '@/lib/haptics';
import { cloudConfigured } from '@/lib/supabase';
import { joinLink } from '@/lib/variant';
import { familySyncAvailable, setDiscoverable, shareTrip } from '@/sync/engine';
import { useSession } from '@/store/session';
import { useTrip } from '@/store/trips';
import { colors, font, radius, space } from '@/theme';

export default function Invite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id)!;
  const code = useSession((s) => s.joinCodes[trip.id]);
  const states = useJoinStates(trip);
  const [busy, setBusy] = useState(false);
  const isOwner = useSession((s) => s.members[trip.id]?.find((m) => m.isMe)?.role === 'owner');
  const codeOnly = useSession((s) => Boolean(s.codeOnly[trip.id]));
  const joined = trip.travelers.filter((t) => states[t.id] !== 'not-joined');
  const pending = trip.travelers.filter((t) => states[t.id] === 'not-joined');

  const message = (c: string) =>
    `${trip.flag} Join our ${trip.title} trip on Trip Buddy!\n\n1. Install the Trip Buddy app (APK I sent)\n2. Tap “Join a trip” and enter code: *${c}*\n\nOr open: ${joinLink(c)}`;

  const start = async () => {
    setBusy(true);
    try {
      await shareTrip(trip.id);
      success();
    } catch (e) {
      Alert.alert('Could not start family sync', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const whatsapp = (c: string) =>
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message(c))}`).catch(() => Share.share({ message: message(c) }));

  return (
    <Screen title="Invite family" subtitle={`${joined.length} of ${trip.travelers.length} on the app`}>
      {!code ? (
        <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="people" size={34} color={colors.gold} />
          </View>
          <Txt v="h2" style={{ textAlign: 'center' }}>
            Travel together, in sync
          </Txt>
          <Txt v="small" color={colors.textDim} style={{ textAlign: 'center' }}>
            Expenses, checklist ticks and tickets update on everyone’s phone. Your trip stays private — only people with the code can join.
          </Txt>
          <Button label={busy ? 'Starting…' : 'Start family sync'} icon="cloud-upload-outline" onPress={start} disabled={busy || !cloudConfigured} style={{ alignSelf: 'stretch' }} />
          {!cloudConfigured && (
            <Txt v="small" color={colors.rose}>
              This build has no cloud keys.
            </Txt>
          )}
        </Card>
      ) : (
        <Card style={{ alignItems: 'center', gap: space.md }}>
          <Txt v="tiny" color={colors.textDim}>
            Trip code
          </Txt>
          <Txt style={[{ fontSize: 40, lineHeight: 52, fontWeight: '900', letterSpacing: 8, color: colors.gold, paddingLeft: 8 }, font.mono]} selectable>
            {code}
          </Txt>
          <View style={{ padding: space.md, backgroundColor: '#fff', borderRadius: radius.lg }}>
            <QRCode value={joinLink(code)} size={180} />
          </View>
          <Txt v="small" color={colors.textDim} style={{ textAlign: 'center' }}>
            Scan with the phone camera (app installed) or enter the code on “Join a trip”.
          </Txt>
          <Row style={{ alignSelf: 'stretch' }}>
            <Button label="WhatsApp" icon="logo-whatsapp" kind="success" onPress={() => whatsapp(code)} style={{ flex: 1 }} />
            <Button
              label="Copy"
              icon="copy"
              kind="ghost"
              onPress={async () => {
                await Clipboard.setStringAsync(message(code));
                success();
              }}
              style={{ flex: 1 }}
            />
          </Row>
        </Card>
      )}

      {code && isOwner && familySyncAvailable && (
        <Card style={{ marginTop: space.md }}>
          <Row>
            <View style={{ flex: 1 }}>
              <Txt v="h3">Show up on family phones</Txt>
              <Txt v="small" color={colors.textDim}>
                {codeOnly ? 'Off — only people who enter the code can join.' : 'On — family phones with the app get this trip automatically.'}
              </Txt>
            </View>
            <Switch
              value={!codeOnly}
              onValueChange={(on) => setDiscoverable(trip.id, on).catch((e) => Alert.alert('Could not change that', e instanceof Error ? e.message : String(e)))}
              trackColor={{ true: colors.gold }}
            />
          </Row>
        </Card>
      )}

      <SectionTitle title={`On the app (${joined.length})`} />
      {joined.map((t) => (
        <Row key={t.id} style={{ paddingVertical: space.sm }} gap={space.md}>
          <Avatar t={t} size={36} />
          <Txt v="h3" style={{ flex: 1 }}>
            {t.name}
          </Txt>
          <Pill small icon="checkmark-circle" label={states[t.id] === 'this-phone' ? 'This phone' : 'Joined'} color={colors.emerald} active />
        </Row>
      ))}

      {pending.length > 0 && <SectionTitle title={`Not joined yet (${pending.length})`} />}
      {pending.map((t) => (
        <Row key={t.id} style={{ paddingVertical: space.sm, opacity: 0.85 }} gap={space.md}>
          <View style={{ opacity: 0.45 }}>
            <Avatar t={t} size={36} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="h3">{t.name}</Txt>
            <Txt v="small" color={colors.textMute}>
              Still in the trip for expenses & tickets
            </Txt>
          </View>
          {code && <Pill small icon="send" label="Invite" onPress={() => whatsapp(code)} />}
        </Row>
      ))}
    </Screen>
  );
}
