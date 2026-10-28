import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Avatar, Button, Row, SectionTitle, Txt } from '@/components/ui';
import { success } from '@/lib/haptics';
import { cloudConfigured } from '@/lib/supabase';
import { joinTrip, setMyTraveler } from '@/sync/engine';
import { colors, font, radius, space } from '@/theme';
import type { Trip } from '@/types/trip';

export default function Join() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState((params.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState<Trip | null>(null);

  const submit = async () => {
    setBusy(true);
    try {
      const trip = await joinTrip(code.trim().toUpperCase(), null);
      success();
      setJoined(trip);
    } catch (e) {
      Alert.alert('Could not join', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (joined) {
    return (
      <Screen title={`${joined.flag} ${joined.title}`} subtitle="Joined! Who are you?">
        <Row style={{ flexWrap: 'wrap' }} gap={space.md}>
          {joined.travelers.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => {
                void setMyTraveler(joined.id, t.id);
                router.replace(`/trip/${joined.id}`);
              }}
              style={{ alignItems: 'center', gap: 6, width: 92, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface }}>
              <Avatar t={t} size={48} />
              <Txt v="small">{t.shortName}</Txt>
            </Pressable>
          ))}
        </Row>
      </Screen>
    );
  }

  return (
    <Screen title="Join a trip" footer={<Button label={busy ? 'Joining…' : 'Join'} icon="enter-outline" onPress={submit} disabled={busy || code.trim().length < 6 || !cloudConfigured} />}>
      <Txt v="body" color={colors.textDim}>
        Ask the trip lead for the 6-letter code (Settings → Family sync on their phone).
      </Txt>
      <TextInput
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        autoCapitalize="characters"
        autoFocus
        returnKeyType="go"
        onSubmitEditing={() => code.trim().length === 6 && cloudConfigured && !busy && submit()}
        placeholder="ABC123"
        placeholderTextColor={colors.textMute}
        style={[{ marginTop: space.xl, color: colors.text, fontSize: 40, fontWeight: '800', letterSpacing: 8, textAlign: 'center', padding: space.lg, backgroundColor: colors.surface, borderRadius: radius.lg }, font.mono]}
      />
      {!cloudConfigured && (
        <View style={{ marginTop: space.lg }}>
          <SectionTitle title="Cloud not configured" />
          <Txt v="small" color={colors.rose}>
            This build has no Supabase keys, so joining is disabled. Trips bundled with the app still work fully offline.
          </Txt>
        </View>
      )}
    </Screen>
  );
}
