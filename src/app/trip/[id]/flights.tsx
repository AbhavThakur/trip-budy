import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Icon, Pill, Row, SectionTitle, StatusBadge, Txt } from '@/components/ui';
import { success } from '@/lib/haptics';
import { flightDuration, localTime, shortDate } from '@/lib/time';
import { travelerName } from '@/lib/trip';
import { useTrip } from '@/store/trips';
import { colors, font, space } from '@/theme';

export default function Flights() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id)!;
  const flights = [...trip.flights].sort((a, b) => Date.parse(a.depart) - Date.parse(b.depart));

  return (
    <Screen title="Flights & transfers" subtitle={`${flights.length} flights · times are local at each airport`}>
      {flights.map((f) => (
        <Card key={f.id} style={{ marginBottom: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt v="tiny" color={colors.sky}>
              {shortDate(f.depart.slice(0, 10))} · {f.airline} {f.flightNo}
            </Txt>
            <StatusBadge status={f.status} />
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
            <View>
              <Txt v="display">{f.from.code}</Txt>
              <Txt v="h3">{localTime(f.depart)}</Txt>
              <Txt v="small" color={colors.textDim}>
                {f.from.city}
                {f.from.terminal ? ` · ${f.from.terminal}` : ''}
              </Txt>
            </View>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Icon name="airplane" color={colors.sky} />
              <Txt v="small" color={colors.textDim}>
                {flightDuration(f)}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt v="display">{f.to.code}</Txt>
              <Txt v="h3">
                {localTime(f.arrive)}
                {f.arrive.slice(0, 10) !== f.depart.slice(0, 10) ? ' +1' : ''}
              </Txt>
              <Txt v="small" color={colors.textDim}>
                {f.to.city}
                {f.to.terminal ? ` · ${f.to.terminal}` : ''}
              </Txt>
            </View>
          </Row>

          {f.bookings.map((b) => (
            <View key={b.pnr} style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderColor: colors.border }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="h2" style={font.mono} selectable>
                  {b.pnr}
                </Txt>
                <Pill
                  small
                  icon="copy"
                  label="Copy PNR"
                  onPress={async () => {
                    await Clipboard.setStringAsync(b.pnr);
                    success();
                  }}
                />
              </Row>
              <Txt v="small" color={colors.textDim}>
                {b.travelerIds.map((t) => travelerName(trip, t)).join(', ')}
              </Txt>
              {b.bookedVia && (
                <Txt v="small" color={colors.textMute}>
                  {b.bookedVia}
                  {b.bookingId ? ` · ${b.bookingId}` : ''}
                </Txt>
              )}
              {b.eTickets && (
                <Txt v="small" color={colors.textMute}>
                  e-tickets: {Object.entries(b.eTickets).map(([t, n]) => `${travelerName(trip, t)} ${n}`).join(' · ')}
                </Txt>
              )}
            </View>
          ))}

          <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
            <Pill small icon="briefcase" label={`${f.checkinKg} kg check-in`} />
            <Pill small icon="bag" label={`${f.cabinKg} kg cabin`} />
            {f.checkinUrl && <Pill small icon="open-outline" label="Web check-in" color={colors.sky} onPress={() => Linking.openURL(f.checkinUrl!)} />}
          </Row>
          {f.notes && (
            <Txt v="small" color={colors.textDim} style={{ marginTop: space.sm }}>
              {f.notes}
            </Txt>
          )}
        </Card>
      ))}

      {trip.transfers.length > 0 && <SectionTitle title="Ground transfers" />}
      {trip.transfers.map((t) => (
        <Row key={t.id} style={{ paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.border, alignItems: 'flex-start' }} gap={space.md}>
          <View style={{ width: 64 }}>
            <Txt v="small" style={{ fontWeight: '700' }}>
              {t.when ? localTime(t.when) : '—'}
            </Txt>
            <Txt v="small" color={colors.textMute} style={{ fontSize: 11 }}>
              {t.when ? shortDate(t.when.slice(0, 10)) : ''}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <Txt v="h3">{t.label}</Txt>
              <StatusBadge status={t.status} />
            </Row>
            <Txt v="small" color={colors.textDim}>
              {t.route}
            </Txt>
            {t.vehicle && (
              <Txt v="small" color={colors.textMute}>
                {t.vehicle}
                {t.costLocal ? ` · ~${t.costLocal.toLocaleString()} ${trip.currency.code}` : ''}
              </Txt>
            )}
          </View>
        </Row>
      ))}
    </Screen>
  );
}
