import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, KeyValue, Row, StatusBadge, Txt } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { localTime, shortDate } from '@/lib/time';
import { call, openNavigation, travelerName } from '@/lib/trip';
import { useTrip } from '@/store/trips';
import { colors, space } from '@/theme';

export default function Stays() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id)!;

  return (
    <Screen title="Stays" subtitle={`${trip.stays.length} basecamps`}>
      {trip.stays.map((s) => (
        <Card key={s.id} style={{ marginBottom: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="tiny" color={colors.sky}>
              {s.kind} · {s.city}
            </Txt>
            <StatusBadge status={s.status} />
          </Row>
          <Txt v="h2" style={{ marginTop: 4 }}>
            {s.name}
          </Txt>
          <Txt v="small" color={colors.textDim}>
            {s.address}
          </Txt>
          {s.addressLocal && (
            <Txt v="small" color={colors.gold}>
              {s.addressLocal}
            </Txt>
          )}

          <Row style={{ marginTop: space.md, justifyContent: 'space-between' }}>
            <View>
              <Txt v="tiny" color={colors.textDim}>
                Check in
              </Txt>
              <Txt v="h3">
                {shortDate(s.checkIn.slice(0, 10))} · {localTime(s.checkIn)}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt v="tiny" color={colors.textDim}>
                Check out
              </Txt>
              <Txt v="h3">
                {shortDate(s.checkOut.slice(0, 10))} · {localTime(s.checkOut)}
              </Txt>
            </View>
          </Row>

          <View style={{ marginTop: space.md }}>
            {s.rooms.map((r, i) => (
              <View key={i} style={{ paddingVertical: space.sm, borderTopWidth: 1, borderColor: colors.border }}>
                <Txt v="h3">{r.type}</Txt>
                <Txt v="small" color={colors.textDim}>
                  {r.guests} guests{r.travelerIds ? ` · ${r.travelerIds.map((t) => travelerName(trip, t)).join(', ')}` : ''}
                </Txt>
                <KeyValue k="Confirmation" v={r.confirmation} mono />
                {r.priceLocal ? <KeyValue k="Price" v={formatMoney(r.priceLocal, trip.currency)} /> : null}
              </View>
            ))}
          </View>
          <KeyValue k="Booked via" v={s.bookedVia} />
          <KeyValue k="Payment" v={s.payment} />
          <KeyValue k="Cancellation" v={s.cancellation} />
          <KeyValue k="Phone" v={s.phone} onPress={s.phone ? () => call(s.phone!) : undefined} />
          {s.notes && (
            <Txt v="small" color={colors.textDim} style={{ marginTop: space.sm }}>
              {s.notes}
            </Txt>
          )}
          <Row style={{ marginTop: space.md }}>
            <Button kind="ghost" label="Navigate" icon="navigate" onPress={() => openNavigation(s)} style={{ flex: 1 }} />
            <Button
              label="Driver card"
              icon="car"
              onPress={() => router.push({ pathname: '/trip/[id]/card', params: { id: trip.id, title: s.name, local: s.addressLocal ?? s.address, sub: s.address } })}
              style={{ flex: 1 }}
            />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
