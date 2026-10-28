import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Avatar, Card, Icon, Ring, Row, SectionTitle, Txt } from '@/components/ui';
import { tap } from '@/lib/haptics';
import { useMe, useReadiness } from '@/lib/trip';
import { checklistKey, useLedger } from '@/store/ledger';
import { useTrip } from '@/store/trips';
import { colors, radius, space } from '@/theme';
import type { ChecklistItem, Trip } from '@/types/trip';

export default function Readiness() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id)!;
  const r = useReadiness(trip);
  const [open, setOpen] = useState<string | null>(trip.checklist[0]?.id ?? null);
  const checklist = useLedger((s) => s.checklist);

  const intl = trip.flights.filter((f) => f.checkinKg > 0 && f.status === 'confirmed');
  const minCheckin = intl.length ? Math.min(...intl.map((f) => f.checkinKg)) : 0;

  return (
    <Screen title="Pre-departure" subtitle="Shared with everyone in the trip">
      <Card style={{ alignItems: 'center', gap: space.md }}>
        <Ring pct={r.pct} size={150} stroke={12} color={r.pct >= 0.99 ? colors.emerald : colors.gold}>
          <Txt v="display">{Math.round(r.pct * 100)}%</Txt>
          <Txt v="tiny" color={colors.textDim}>
            Ready
          </Txt>
        </Ring>
        <Row gap={space.xl}>
          <Stat label="Documents" value={`${r.docsDone}/${r.docsTotal}`} />
          <Stat label="Checklist" value={`${r.itemsDone}/${r.itemsTotal}`} />
        </Row>
      </Card>

      {minCheckin > 0 && (
        <Card style={{ marginTop: space.md, borderColor: colors.gold }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <Icon name="briefcase" color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Txt v="h3">Pack to {minCheckin} kg checked + 7 kg cabin per person</Txt>
              <Txt v="small" color={colors.textDim}>
                Your tightest leg sets the limit:{' '}
                {intl
                  .filter((f) => f.checkinKg === minCheckin)
                  .map((f) => f.flightNo)
                  .join(', ')}
                . Power banks in cabin only; liquids ≤ 100 ml.
              </Txt>
            </View>
          </Row>
        </Card>
      )}

      {trip.travelers.some((t) => t.passportExpiry) && <PassportCheck trip={trip} />}

      {trip.openQuestions && trip.openQuestions.length > 0 && (
        <>
          <SectionTitle title="Still to confirm" />
          <Card style={{ borderColor: colors.rose }}>
            {trip.openQuestions.map((q, i) => (
              <Row key={i} style={{ alignItems: 'flex-start', paddingVertical: 4 }}>
                <Icon name="alert-circle" size={16} color={colors.rose} />
                <Txt v="small" style={{ flex: 1 }}>
                  {q}
                </Txt>
              </Row>
            ))}
          </Card>
        </>
      )}

      <SectionTitle title="Checklist" />
      {trip.checklist.map((sec) => {
        const keys = sec.items.flatMap((it) => (it.perTraveler ? trip.travelers.map((t) => checklistKey(trip.id, it.id, t.id)) : [checklistKey(trip.id, it.id, '')]));
        const done = keys.filter((k) => checklist[k]?.done).length;
        const isOpen = open === sec.id;
        return (
          <Card key={sec.id} style={{ marginBottom: space.sm, padding: 0 }}>
            <Pressable onPress={() => setOpen(isOpen ? null : sec.id)} style={{ padding: space.lg }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="h3" style={{ flex: 1 }}>
                  {sec.title}
                </Txt>
                <Txt v="small" color={done === keys.length ? colors.emerald : colors.textDim}>
                  {done}/{keys.length}
                </Txt>
                <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} color={colors.textDim} />
              </Row>
            </Pressable>
            {isOpen && (
              <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
                {sec.items.map((it) => (
                  <CheckRow key={it.id} trip={trip} item={it} />
                ))}
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

/** Most countries (incl. Vietnam) require 6 months of passport validity after the trip ends. */
function PassportCheck({ trip }: { trip: Trip }) {
  const [y, m, d] = trip.endDate.split('-').map(Number);
  const needed = new Date(Date.UTC(y, m - 1 + 6, d)).toISOString().slice(0, 10);
  return (
    <>
      <SectionTitle title="Passport validity (6 months after return)" />
      <Card>
        {trip.travelers.map((t) => {
          const ok = t.passportExpiry ? t.passportExpiry >= needed : undefined;
          return (
            <Row key={t.id} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
              <Row>
                <Avatar t={t} size={24} />
                <Txt v="small">{t.shortName}</Txt>
              </Row>
              <Row gap={6}>
                <Txt v="small" color={colors.textDim}>
                  {t.passportExpiry ? `expires ${t.passportExpiry}` : 'unknown'}
                </Txt>
                <Icon name={ok ? 'checkmark-circle' : 'alert-circle'} size={18} color={ok ? colors.emerald : colors.rose} />
              </Row>
            </Row>
          );
        })}
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Txt v="h2">{value}</Txt>
      <Txt v="small" color={colors.textDim}>
        {label}
      </Txt>
    </View>
  );
}

function CheckRow({ trip, item }: { trip: Trip; item: ChecklistItem }) {
  const marks = useLedger((s) => s.checklist);
  const put = useLedger((s) => s.put);
  const me = useMe(trip);
  const toggle = (travelerId: string) => {
    tap();
    const id = checklistKey(trip.id, item.id, travelerId);
    put('checklist', { id, tripId: trip.id, itemId: item.id, travelerId, done: !marks[id]?.done, updatedBy: me?.id });
  };

  if (item.perTraveler) {
    return (
      <View style={{ paddingVertical: space.sm, borderTopWidth: 1, borderColor: colors.border }}>
        <Txt v="body">{item.text}</Txt>
        {item.detail && (
          <Txt v="small" color={colors.textDim}>
            {item.detail}
          </Txt>
        )}
        <Row style={{ marginTop: space.sm, flexWrap: 'wrap' }}>
          {trip.travelers.map((t) => {
            const done = marks[checklistKey(trip.id, item.id, t.id)]?.done;
            return (
              <Pressable key={t.id} onPress={() => toggle(t.id)} style={{ alignItems: 'center', opacity: done ? 1 : 0.4 }}>
                <View>
                  <Avatar t={t} size={34} />
                  {done && (
                    <View style={{ position: 'absolute', right: -3, bottom: -3, backgroundColor: colors.emerald, borderRadius: 8 }}>
                      <Icon name="checkmark" size={14} color={colors.bg} />
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </Row>
      </View>
    );
  }

  const done = marks[checklistKey(trip.id, item.id, '')]?.done;
  return (
    <Pressable onPress={() => toggle('')} style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderColor: colors.border }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.sm / 2,
          borderWidth: 2,
          borderColor: done ? colors.emerald : colors.borderStrong,
          backgroundColor: done ? colors.emerald : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}>
        {done && <Icon name="checkmark" size={16} color={colors.bg} />}
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="body" color={done ? colors.textDim : colors.text} style={done && { textDecorationLine: 'line-through' }}>
          {item.text}
        </Txt>
        {item.detail && (
          <Txt v="small" color={colors.textMute}>
            {item.detail}
          </Txt>
        )}
      </View>
    </Pressable>
  );
}
