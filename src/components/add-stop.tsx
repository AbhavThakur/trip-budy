import { useState } from 'react';
import { ScrollView, TextInput } from 'react-native';

import { success } from '@/lib/haptics';
import { zonedIso } from '@/lib/time';
import { useTrips } from '@/store/trips';
import { colors, radius, space } from '@/theme';
import type { Day, StopCategory, Trip } from '@/types/trip';

import { Button, Pill, Sheet, Txt } from './ui';

const CATS: { key: StopCategory; label: string }[] = [
  { key: 'sight', label: 'Sight' },
  { key: 'food', label: 'Food' },
  { key: 'activity', label: 'Activity' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'transit', label: 'Transit' },
];

const field = { color: colors.text, fontSize: 16, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: space.sm } as const;

/** Adds a user-made stop (id "u-…") to one day of a trip. */
export function AddStopSheet({ trip, day, visible, onClose }: { trip: Trip; day: Day; visible: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [category, setCategory] = useState<StopCategory>('sight');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const timeOk = time === '' || /^([01]?\d|2[0-3]):[0-5]\d$/.test(time.trim());

  const save = () => {
    if (!title.trim() || !timeOk) return;
    const hhmm = time.trim() ? time.trim().padStart(5, '0') : '';
    const stop = {
      id: `u-${Date.now().toString(36)}`,
      title: title.trim(),
      category,
      ...(hhmm ? { start: zonedIso(day.date, hhmm, trip.timezone) } : {}),
      ...(address.trim() ? { address: address.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    useTrips.getState().editTrip(trip.id, (t) => ({ ...t, days: t.days.map((d) => (d.index === day.index ? { ...d, stops: [...d.stops, stop] } : d)) }));
    success();
    setTitle('');
    setTime('');
    setAddress('');
    setNotes('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Add to ${day.title}`}>
      <TextInput value={title} onChangeText={setTitle} placeholder="What are you doing?" placeholderTextColor={colors.textMute} style={field} autoFocus />
      <TextInput value={time} onChangeText={setTime} placeholder="Time, 24h (optional) e.g. 14:30" placeholderTextColor={colors.textMute} style={field} keyboardType="numbers-and-punctuation" maxLength={5} />
      {!timeOk && (
        <Txt v="small" color={colors.rose}>
          Use 24-hour time like 09:30
        </Txt>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, marginTop: space.md }}>
        {CATS.map((c) => (
          <Pill key={c.key} small label={c.label} active={category === c.key} onPress={() => setCategory(c.key)} />
        ))}
      </ScrollView>
      <TextInput value={address} onChangeText={setAddress} placeholder="Address (optional, enables Navigate)" placeholderTextColor={colors.textMute} style={field} />
      <TextInput value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor={colors.textMute} style={[field, { minHeight: 70, textAlignVertical: 'top' }]} multiline />
      <Button label="Add stop" icon="checkmark" onPress={save} disabled={!title.trim() || !timeOk} style={{ marginTop: space.lg }} />
    </Sheet>
  );
}
