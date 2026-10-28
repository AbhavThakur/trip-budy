import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Switch, View } from 'react-native';

import { Screen } from '@/components/screen';
import { VoiceCheck } from '@/components/speech';
import { Button, Card, Icon, Pill, Row, SectionTitle, Txt } from '@/components/ui';
import { cloudConfigured } from '@/lib/supabase';
import { otaInfo, useOta } from '@/lib/updates';
import { notificationsGranted, requestNotifications, rescheduleReminders, sendTestNotification, upcomingReminders } from '@/lib/notify';
import { REMINDER_KINDS, type Reminder } from '@/lib/reminders';
import { syncNow } from '@/sync/engine';
import { useLedger } from '@/store/ledger';
import { useSession } from '@/store/session';
import { useTrips } from '@/store/trips';
import { colors, font, space } from '@/theme';

export default function Settings() {
  const trips = useTrips((s) => s.trips);
  const order = useTrips((s) => s.order);
  const sync = useSession((s) => s.sync);
  const codes = useSession((s) => s.joinCodes);
  const largeText = useSession((s) => s.largeText);
  const vaultLock = useSession((s) => s.vaultLock);
  const setPref = useSession((s) => s.setPref);
  const pending = useLedger((s) => s.outbox.length);
  const ota = useOta();
  const info = otaInfo();


  return (
    <Screen title="Settings">
      <SectionTitle title="Family sync" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="h3">Status</Txt>
          <Txt v="small" color={sync.status === 'error' ? colors.rose : colors.textDim}>
            {cloudConfigured ? (sync.status === 'local-only' ? 'not shared yet' : sync.status) : 'not configured'}
            {pending ? ` · ${pending} pending` : ''}
          </Txt>
        </Row>
        {sync.lastSyncAt && (
          <Txt v="small" color={colors.textMute}>
            Last sync {new Date(sync.lastSyncAt).toLocaleString()}
          </Txt>
        )}
        {sync.error && (
          <Txt v="small" color={colors.rose} style={{ marginTop: 4 }}>
            {sync.error}
          </Txt>
        )}
        {!cloudConfigured && (
          <Txt v="small" color={colors.textDim} style={{ marginTop: space.sm }}>
            Everything is saved on this phone. To sync between the five phones, add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env and rebuild (see README).
          </Txt>
        )}
        {cloudConfigured && <Button kind="ghost" label="Sync now" icon="sync" onPress={() => void syncNow()} style={{ marginTop: space.md }} />}
      </Card>

      {order.map((id) => {
        const t = trips[id];
        if (!t) return null;
        const code = codes[id];
        return (
          <Card key={id} style={{ marginTop: space.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="h3">
                {t.flag} {t.title}
              </Txt>
              <Pill small icon={code ? 'qr-code' : 'share-social'} label={code ?? 'Invite family'} onPress={() => router.push(`/trip/${id}/invite`)} />
            </Row>
            {code && (
              <Txt v="small" color={colors.textDim} style={{ marginTop: 4 }}>
                Others tap “Join a trip” on the home screen and enter <Txt v="small" style={font.mono}>{code}</Txt>
              </Txt>
            )}
          </Card>
        );
      })}

      <RemindersCard />

      <SectionTitle title="Comfort & privacy" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt v="h3">Large text</Txt>
            <Txt v="small" color={colors.textDim}>
              Easier reading for parents
            </Txt>
          </View>
          <Switch value={largeText} onValueChange={(v) => setPref({ largeText: v })} thumbColor={largeText ? colors.gold : undefined} />
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
          <View style={{ flex: 1 }}>
            <Txt v="h3">Lock documents</Txt>
            <Txt v="small" color={colors.textDim}>
              Fingerprint / phone PIN before showing passports & visas
            </Txt>
          </View>
          <Switch value={vaultLock} onValueChange={(v) => setPref({ vaultLock: v })} thumbColor={vaultLock ? colors.gold : undefined} />
        </Row>
      </Card>

      <SectionTitle title="Offline voice" />
      <VoiceCheck locale="vi-VN" />
      <Card>
        <Row>
          <Icon name="checkmark-circle" color={colors.emerald} />
          <Txt v="small" color={colors.textDim} style={{ flex: 1 }}>
            If no warning appears above, Vietnamese audio works offline on this phone.
          </Txt>
        </Row>
      </Card>

      <SectionTitle title="App updates" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="h3">Over-the-air updates</Txt>
          <Txt v="small" color={ota.state === 'error' ? colors.rose : ota.state === 'ready' ? colors.emerald : colors.textDim}>
            {info.enabled ? ota.state.replace('-', ' ') : 'off in this build'}
          </Txt>
        </Row>
        <Txt v="small" color={colors.textMute}>
          Channel {info.channel} · runtime {info.runtime} · bundle {info.updateId}
          {info.createdAt ? ` (${info.createdAt})` : ''}
        </Txt>
        <Row style={{ marginTop: space.md }}>
          <Button kind="ghost" label="Check now" icon="cloud-download-outline" onPress={() => void ota.check()} style={{ flex: 1 }} />
          {ota.state === 'ready' && <Button kind="success" label="Restart" icon="refresh" onPress={() => void ota.restart()} style={{ flex: 1 }} />}
        </Row>
      </Card>

      <Txt v="small" color={colors.textMute} style={{ textAlign: 'center', marginTop: space.xxl }}>
        Trip Buddy {Constants.expoConfig?.version ?? ''}
      </Txt>
    </Screen>
  );
}

function RemindersCard() {
  const rem = useSession((s) => s.reminders);
  const setReminders = useSession((s) => s.setReminders);
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    void notificationsGranted().then((g) => alive && setGranted(g));
    return () => {
      alive = false;
    };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo<Reminder[]>(() => upcomingReminders(), [rem]);

  const enable = async () => {
    const ok = await requestNotifications();
    setGranted(ok);
    if (ok) {
      setReminders({ on: true });
      rescheduleReminders();
      await sendTestNotification();
    } else Linking.openSettings();
  };

  return (
    <>
      <SectionTitle title="Reminders" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt v="h3">Trip reminders</Txt>
            <Txt v="small" color={colors.textDim}>
              Scheduled on this phone — they fire even in airplane mode.
            </Txt>
          </View>
          <Switch value={rem.on && granted !== false} onValueChange={(v) => (v && !granted ? void enable() : setReminders({ on: v }))} thumbColor={rem.on ? colors.gold : undefined} />
        </Row>
        {granted === false && <Button kind="ghost" label="Allow notifications" icon="notifications-outline" onPress={() => void enable()} style={{ marginTop: space.md }} />}
        {rem.on && granted && (
          <View style={{ marginTop: space.md }}>
            {REMINDER_KINDS.map((k) => (
              <Row key={k.kind} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <Txt v="body">{k.label}</Txt>
                  <Txt v="small" color={colors.textMute} style={{ fontSize: 11 }}>
                    {k.detail}
                  </Txt>
                </View>
                <Switch value={rem.kinds[k.kind]} onValueChange={(v) => setReminders({ kinds: { ...rem.kinds, [k.kind]: v } })} thumbColor={rem.kinds[k.kind] ? colors.gold : undefined} />
              </Row>
            ))}
            <Txt v="tiny" color={colors.textDim} style={{ marginTop: space.md }}>
              Next up ({list.length} scheduled)
            </Txt>
            {list.slice(0, 4).map((r) => (
              <Row key={r.id} style={{ paddingVertical: 4, alignItems: 'flex-start' }}>
                <Txt v="small" color={colors.gold} style={{ width: 92 }}>
                  {new Date(r.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Txt>
                <Txt v="small" style={{ flex: 1 }} numberOfLines={1}>
                  {r.title}
                </Txt>
              </Row>
            ))}
            <Button kind="ghost" label="Send a test notification" icon="notifications" onPress={() => void sendTestNotification()} style={{ marginTop: space.sm }} />
          </View>
        )}
      </Card>
    </>
  );
}
