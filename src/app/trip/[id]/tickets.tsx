import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Linking, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Icon, Pill, Row, SectionTitle, StatusBadge, Txt } from '@/components/ui';
import { tap } from '@/lib/haptics';
import { formatMoney, INR } from '@/lib/money';
import { shortDate } from '@/lib/time';
import { passKey, useMe } from '@/lib/trip';
import { attachDocument } from '@/lib/vault';
import { liveRows, useLedger } from '@/store/ledger';
import { useTrip } from '@/store/trips';
import { colors, space } from '@/theme';
import type { Pass } from '@/types/trip';

const BUY_LABEL: Record<Pass['buy'], { label: string; color: string }> = {
  online: { label: 'Book online', color: colors.sky },
  gate: { label: 'Pay at gate', color: colors.textDim },
  included: { label: 'Included', color: colors.emerald },
  free: { label: 'Free', color: colors.emerald },
};

export default function Tickets() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id)!;
  const me = useMe(trip);
  const marks = useLedger((s) => s.checklist);
  const docsRec = useLedger((s) => s.docs);
  const put = useLedger((s) => s.put);
  const files = useMemo(() => liveRows(docsRec, trip.id), [docsRec, trip.id]);
  const passes = trip.passes ?? [];
  const pax = trip.travelers.length;

  const paid = passes.filter((p) => p.pricePerPerson);
  const total = paid.reduce((n, p) => n + (p.pricePerPerson ?? 0) * pax, 0);
  const toBook = passes.filter((p) => p.bookAhead && !marks[passKey(trip.id, p.id)]?.done);

  const byDay = trip.days.map((d) => ({ day: d, items: passes.filter((p) => p.dayIndex === d.index) })).filter((g) => g.items.length);

  return (
    <Screen title="Day tickets" subtitle={`${passes.length} entries · ${pax} travelers`}>
      <Card style={{ backgroundColor: colors.surface2 }}>
        <Txt v="tiny" color={colors.textDim}>
          Entry tickets for the family
        </Txt>
        <Txt v="display">{formatMoney(total, trip.currency, { compact: true })}</Txt>
        <Txt v="small" color={colors.textDim}>
          ≈ {formatMoney(total * trip.currency.inrPerUnit, INR)} for {pax} people · estimates until booked
        </Txt>
        {toBook.length > 0 ? (
          <Row style={{ marginTop: space.md, alignItems: 'flex-start' }}>
            <Icon name="alert-circle" color={colors.gold} size={18} />
            <Txt v="small" color={colors.gold} style={{ flex: 1 }}>
              Book before you fly: {toBook.map((p) => p.title).join(', ')}
            </Txt>
          </Row>
        ) : (
          <Row style={{ marginTop: space.md }}>
            <Icon name="checkmark-circle" color={colors.emerald} size={18} />
            <Txt v="small" color={colors.emerald}>
              Nothing left to pre-book
            </Txt>
          </Row>
        )}
      </Card>

      {byDay.map(({ day, items }) => (
        <View key={day.index}>
          <SectionTitle title={`Day ${day.index} · ${shortDate(day.date)}`} />
          {items.map((p) => {
            const booked = Boolean(marks[passKey(trip.id, p.id)]?.done);
            const slotId = `pass-${p.id}`;
            const file = files.find((f) => f.slotId === slotId);
            const buy = BUY_LABEL[p.buy];
            const needsTicket = p.buy === 'online' || p.buy === 'gate';
            return (
              <Card key={p.id} style={{ marginBottom: space.sm, borderColor: booked ? colors.emerald : p.bookAhead ? colors.gold : colors.border }}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: booked ? colors.emeraldSoft : colors.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={booked ? 'checkmark' : 'ticket'} color={booked ? colors.emerald : colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Row gap={6}>
                      <Txt v="h3" style={{ flexShrink: 1 }}>
                        {p.title}
                      </Txt>
                      <StatusBadge status={p.status} />
                    </Row>
                    <Txt v="small" color={colors.textDim}>
                      {p.place}
                    </Txt>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt v="h3">{p.pricePerPerson ? formatMoney(p.pricePerPerson, trip.currency, { compact: true }) : '—'}</Txt>
                    {p.pricePerPerson ? (
                      <Txt v="small" color={colors.textMute} style={{ fontSize: 11 }}>
                        per person
                      </Txt>
                    ) : null}
                  </View>
                </Row>
                {(p.note || p.priceNote) && (
                  <Txt v="small" color={colors.textDim} style={{ marginTop: space.sm }}>
                    {[p.priceNote, p.note].filter(Boolean).join(' · ')}
                  </Txt>
                )}
                <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
                  <Pill small label={buy.label} color={buy.color} icon={p.buy === 'online' ? 'globe-outline' : p.buy === 'gate' ? 'cash-outline' : 'checkmark'} />
                  {p.bookAhead && !booked && <Pill small label="Book ahead" icon="time-outline" color={colors.gold} />}
                  {needsTicket && (
                    <Pill
                      small
                      active={booked}
                      color={colors.emerald}
                      icon={booked ? 'checkmark-circle' : 'ellipse-outline'}
                      label={booked ? 'Booked' : 'Mark booked'}
                      onPress={() => {
                        tap();
                        put('checklist', { id: passKey(trip.id, p.id), tripId: trip.id, itemId: `pass:${p.id}`, travelerId: '', done: !booked, updatedBy: me?.id });
                      }}
                    />
                  )}
                  {p.bookUrl && !booked && <Pill small icon="open-outline" label="Book" color={colors.sky} onPress={() => Linking.openURL(p.bookUrl!)} />}
                  {needsTicket &&
                    (file ? (
                      <Pill small icon="document-text" label="View ticket" color={colors.emerald} onPress={() => router.push({ pathname: '/trip/[id]/doc/[docId]', params: { id: trip.id, docId: file.id } })} />
                    ) : (
                      <Pill
                        small
                        icon="attach"
                        label="Attach ticket"
                        onPress={() => {
                          const slot = trip.docSlots.find((s) => s.id === slotId);
                          void attachDocument(trip, { slot, me: me?.id });
                        }}
                      />
                    ))}
                </Row>
              </Card>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}
