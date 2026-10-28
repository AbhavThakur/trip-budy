import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Avatar, Button, Card, Icon, Pill, Row, SectionTitle, Txt } from '@/components/ui';
import { success } from '@/lib/haptics';
import { addDays, buildTrip, PRESETS, validateNewTrip, type Preset } from '@/lib/new-trip';
import { shortDate, todayIn } from '@/lib/time';
import { variantTripId } from '@/lib/variant';
import { useTrips } from '@/store/trips';
import { setMyTraveler } from '@/sync/engine';
import { colors, radius, space } from '@/theme';

const input = { color: colors.text, fontSize: 16, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border } as const;

export default function NewTrip() {
  const setTrip = useTrips((s) => s.setTrip);
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [start, setStart] = useState(() => addDays(todayIn('Asia/Kolkata'), 30));
  const [days, setDays] = useState(5);
  const [people, setPeople] = useState<string[]>(['', '']);
  const [touched, setTouched] = useState(false);

  const input_ = { title, destination, preset, startDate: start, days, travelers: people };
  const error = useMemo(() => validateNewTrip(input_), [title, destination, preset, start, days, people]); // eslint-disable-line react-hooks/exhaustive-deps
  const end = addDays(start, days - 1);

  const create = () => {
    setTouched(true);
    if (error) return;
    const built = buildTrip(input_);
    const trip = { ...built, id: variantTripId(built.id) };
    setTrip(trip, { source: 'local', version: 0, dirty: false });
    void setMyTraveler(trip.id, trip.travelers[0].id);
    success();
    router.replace(`/trip/${trip.id}`);
  };

  return (
    <Screen title="New trip" subtitle="Takes a minute — add details later" footer={<Button label="Create trip" icon="checkmark" onPress={create} disabled={touched && Boolean(error)} />}>
      <Txt v="tiny" color={colors.textDim}>
        Where to?
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, marginTop: space.sm }}>
        {PRESETS.map((p) => (
          <Pill key={p.key} label={`${p.flag} ${p.label}`} active={preset.key === p.key} onPress={() => setPreset(p)} />
        ))}
      </ScrollView>
      <Txt v="small" color={colors.textMute} style={{ marginTop: space.sm }}>
        {preset.currency.code} · {preset.timezone.replace('_', ' ')} · emergency {preset.emergency[0].phone}/{preset.emergency[1].phone} pre-filled
      </Txt>

      <TextInput value={title} onChangeText={setTitle} placeholder={`Trip name, e.g. ${preset.label} family trip`} placeholderTextColor={colors.textMute} style={[input, { marginTop: space.lg }]} />
      <TextInput value={destination} onChangeText={setDestination} placeholder="Places (optional), e.g. Bangkok · Phuket" placeholderTextColor={colors.textMute} style={[input, { marginTop: space.sm }]} />

      <SectionTitle title="Dates" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="small" color={colors.textDim}>
            Starts
          </Txt>
          <Row>
            <Pill small label="−7" onPress={() => setStart(addDays(start, -7))} />
            <Pill small label="−1" onPress={() => setStart(addDays(start, -1))} />
            <Txt v="h3" style={{ minWidth: 118, textAlign: 'center' }}>
              {shortDate(start)}
            </Txt>
            <Pill small label="+1" onPress={() => setStart(addDays(start, 1))} />
            <Pill small label="+7" onPress={() => setStart(addDays(start, 7))} />
          </Row>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
          <Txt v="small" color={colors.textDim}>
            Length
          </Txt>
          <Row>
            <Pill small label="−" onPress={() => setDays(Math.max(1, days - 1))} />
            <Txt v="h3" style={{ minWidth: 118, textAlign: 'center' }}>
              {days} day{days > 1 ? 's' : ''}
            </Txt>
            <Pill small label="+" onPress={() => setDays(Math.min(60, days + 1))} />
          </Row>
        </Row>
        <Txt v="small" color={colors.textMute} style={{ marginTop: space.sm, textAlign: 'right' }}>
          Ends {shortDate(end)}
        </Txt>
      </Card>

      <SectionTitle title="Who's going" />
      {people.map((name, i) => (
        <Row key={i} style={{ marginBottom: space.sm }}>
          <Avatar t={{ shortName: name.trim() || String(i + 1), color: ['#F59E0B', '#EC4899', '#10B981', '#8B5CF6', '#3B82F6'][i % 5] }} size={34} />
          <TextInput
            value={name}
            onChangeText={(v) => setPeople((p) => p.map((x, k) => (k === i ? v : x)))}
            placeholder={i === 0 ? 'You (trip lead)' : `Traveler ${i + 1}`}
            placeholderTextColor={colors.textMute}
            style={[input, { flex: 1 }]}
          />
          {people.length > 1 && (
            <Pressable onPress={() => setPeople((p) => p.filter((_, k) => k !== i))} hitSlop={8}>
              <Icon name="close-circle" size={22} color={colors.textMute} />
            </Pressable>
          )}
        </Row>
      ))}
      <Pill small icon="person-add" label="Add traveler" onPress={() => setPeople((p) => [...p, ''])} />

      {touched && error && (
        <Txt v="small" color={colors.rose} style={{ marginTop: space.lg }}>
          {error}
        </Txt>
      )}

      <Card style={{ marginTop: space.xl }} onPress={() => router.push('/import-trip')}>
        <Row>
          <Icon name="sparkles" color={colors.gold} size={22} />
          <View style={{ flex: 1 }}>
            <Txt v="h3">Already have tickets & plans?</Txt>
            <Txt v="small" color={colors.textDim}>
              Let an AI turn them into a full trip (flights, hotels, daily plan) and import it.
            </Txt>
          </View>
          <Icon name="chevron-forward" color={colors.textDim} />
        </Row>
      </Card>
    </Screen>
  );
}
