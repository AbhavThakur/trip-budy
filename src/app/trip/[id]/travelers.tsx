import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Avatar, Button, Card, Icon, Pill, Row, SectionTitle, Sheet, Txt } from '@/components/ui';
import { uid } from '@/lib/storage';
import { liveRows, useLedger } from '@/store/ledger';
import { useSession } from '@/store/session';
import { setMyTraveler } from '@/sync/engine';
import { useTrip, useTrips } from '@/store/trips';
import { colors, radius, space } from '@/theme';
import type { Traveler } from '@/types/trip';

const PALETTE = ['#F59E0B', '#EC4899', '#10B981', '#8B5CF6', '#3B82F6', '#F97316', '#14B8A6', '#EF4444', '#84CC16', '#06B6D4'];

export default function Travelers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id)!;
  const setTravelers = useTrips((s) => s.setTravelers);
  const me = useSession((s) => s.me[trip.id]);

  const expenses = useLedger((s) => s.expenses);
  const [editing, setEditing] = useState<Traveler | null>(null);

  const save = (t: Traveler) => {
    const exists = trip.travelers.some((x) => x.id === t.id);
    setTravelers(trip.id, exists ? trip.travelers.map((x) => (x.id === t.id ? t : x)) : [...trip.travelers, t]);
    setEditing(null);
  };

  const removeTraveler = (t: Traveler) => {
    const used = liveRows(expenses, trip.id).some((e) => e.paidBy === t.id || e.splitWith.includes(t.id));
    if (used) {
      Alert.alert('Can’t remove yet', `${t.shortName} is part of existing expenses. Edit or delete those first so balances stay correct.`);
      return;
    }
    Alert.alert(`Remove ${t.shortName}?`, 'They will disappear from this trip on every phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setTravelers(trip.id, trip.travelers.filter((x) => x.id !== t.id));
          setEditing(null);
        },
      },
    ]);
  };

  return (
    <Screen
      title="Travelers"
      subtitle={`${trip.travelers.length} on this trip`}
      right={<Pill small icon="person-add" label="Invite" onPress={() => router.push(`/trip/${trip.id}/invite`)} />}
      footer={
        <Button
          label="Add traveler"
          icon="person-add"
          onPress={() => setEditing({ id: uid('p-'), name: '', shortName: '', color: PALETTE[trip.travelers.length % PALETTE.length] })}
        />
      }>
      {trip.travelers.map((t) => (
        <Card key={t.id} onPress={() => setEditing(t)} style={{ marginBottom: space.sm }}>
          <Row gap={space.md}>
            <Avatar t={t} size={44} />
            <View style={{ flex: 1 }}>
              <Row gap={6}>
                <Txt v="h3">{t.name}</Txt>
                {me === t.id && (
                  <View style={{ paddingHorizontal: 6, borderRadius: 6, backgroundColor: colors.goldSoft }}>
                    <Txt v="tiny" color={colors.gold} style={{ fontSize: 9 }}>
                      This phone
                    </Txt>
                  </View>
                )}
              </Row>
              <Txt v="small" color={t.phone?.includes('00000') ? colors.rose : colors.textDim}>
                {[t.role, t.homeCity, t.phone].filter(Boolean).join(' · ')}
              </Txt>
              {t.passportNo && (
                <Txt v="small" color={colors.textMute} style={{ fontSize: 11 }}>
                  Passport {t.passportNo} · exp {t.passportExpiry}
                </Txt>
              )}
            </View>
            <Icon name="create-outline" color={colors.textDim} />
          </Row>
        </Card>
      ))}

      <SectionTitle title="Who is using this phone?" />
      <Row style={{ flexWrap: 'wrap' }}>
        {trip.travelers.map((t) => (
          <Pressable key={t.id} onPress={() => void setMyTraveler(trip.id, t.id)} style={{ alignItems: 'center', gap: 4, padding: space.sm, borderRadius: radius.md, backgroundColor: me === t.id ? colors.goldSoft : 'transparent' }}>
            <Avatar t={t} size={36} />
            <Txt v="small">{t.shortName}</Txt>
          </Pressable>
        ))}
      </Row>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing && trip.travelers.some((x) => x.id === editing.id) ? 'Edit traveler' : 'New traveler'}>
        {editing && <Editor initial={editing} onSave={save} onRemove={trip.travelers.some((x) => x.id === editing.id) ? () => removeTraveler(editing) : undefined} />}
      </Sheet>
    </Screen>
  );
}

function Editor({ initial, onSave, onRemove }: { initial: Traveler; onSave: (t: Traveler) => void; onRemove?: () => void }) {
  const [t, setT] = useState(initial);
  const field = (key: 'name' | 'phone' | 'role' | 'homeCity', label: string, keyboard: 'default' | 'phone-pad' = 'default') => (
    <View style={{ marginBottom: space.md }}>
      <Txt v="tiny" color={colors.textDim}>
        {label}
      </Txt>
      <TextInput
        value={t[key] ?? ''}
        onChangeText={(v) => setT((x) => ({ ...x, [key]: v, ...(key === 'name' ? { shortName: v.trim().split(/\s+/)[0] ?? '' } : {}) }))}
        keyboardType={keyboard}
        placeholderTextColor={colors.textMute}
        style={{ color: colors.text, fontSize: 16, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: colors.borderStrong }}
      />
    </View>
  );
  return (
    <View>
      {field('name', 'Full name')}
      {field('phone', 'Phone (with country code)', 'phone-pad')}
      {field('role', 'Role (e.g. Parent, Trip lead)')}
      {field('homeCity', 'Home city')}
      <Txt v="tiny" color={colors.textDim}>
        Color
      </Txt>
      <Row style={{ flexWrap: 'wrap', marginVertical: space.md }}>
        {PALETTE.map((c) => (
          <Pressable key={c} onPress={() => setT((x) => ({ ...x, color: c }))} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: t.color === c ? 3 : 0, borderColor: colors.text }} />
        ))}
      </Row>
      <Button label="Save" icon="checkmark" disabled={!t.name.trim()} onPress={() => onSave({ ...t, name: t.name.trim(), shortName: t.shortName || t.name.trim() })} />
      {onRemove && <Button kind="ghost" label="Remove from trip" icon="trash-outline" onPress={onRemove} style={{ marginTop: space.sm }} />}
    </View>
  );
}
