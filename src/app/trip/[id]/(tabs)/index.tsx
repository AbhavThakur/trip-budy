import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddStopSheet } from '@/components/add-stop';
import { DayHeader, DayPills, NowNextHud, StopRow, useNow } from '@/components/timeline';
import { JoinedStack, MeChip, useJoinStates, useOpenWhoAmI } from '@/components/identity';
import { SyncLine } from '@/components/sync-dot';
import { Card, IconButton, Pill, Ring, Row, Txt } from '@/components/ui';
import { clockIn, nowAndNext, stopsForDay, todayIn, tripPhase } from '@/lib/time';
import { shareDay, useReadiness } from '@/lib/trip';
import { useTripId } from '@/lib/trip-context';
import { useSyncRefresh } from '@/lib/use-sync-refresh';
import { bundledById, useTrip, useTrips } from '@/store/trips';
import { colors, space } from '@/theme';

export default function Expedition() {
  const id = useTripId();
  const refreshControl = useSyncRefresh();
  const trip = useTrip(id)!;
  const insets = useSafeAreaInsets();
  const now = useNow();
  const ready = useReadiness(trip);

  const initialDay = useMemo(() => {
    const today = todayIn(trip.timezone);
    const phase = tripPhase(trip);
    if (phase === 'active') return trip.days.find((d) => d.date === today)?.index ?? trip.days[0].index;
    return trip.days[0].index;
  }, [trip]);
  const [dayIndex, setDayIndex] = useState(initialDay);
  const day = trip.days.find((d) => d.index === dayIndex) ?? trip.days[0];
  const stops = stopsForDay(trip, day);
  const nowStopId = nowAndNext(trip, now).now?.id;
  const away = trip.timezone !== trip.homeTimezone;
  const phase = tripPhase(trip, now);
  const openWho = useOpenWhoAmI();
  const [adding, setAdding] = useState(false);
  // bundled trips are rebuilt from the app on every update, so hand edits only stick on trips made in the app
  const editable = !bundledById()[trip.id];
  const deleteStop = (stopId: string) =>
    useTrips.getState().editTrip(trip.id, (t) => ({ ...t, days: t.days.map((d) => ({ ...d, stops: d.stops.filter((x) => x.id !== stopId) })) }));
  const states = useJoinStates(trip);
  const joined = Object.values(states).filter((s) => s !== 'not-joined').length;

  return (
    <ScrollView refreshControl={refreshControl} style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: space.xxl }}>
      <Row style={{ paddingHorizontal: space.lg, justifyContent: 'space-between' }}>
        <Row gap={space.md} style={{ flex: 1 }}>
          <IconButton icon="chevron-back" onPress={() => router.replace('/')} label="All trips" />
          <View style={{ flex: 1 }}>
            <Txt v="h1" numberOfLines={1}>
              {trip.flag} {trip.title}
            </Txt>
            <Txt v="small" color={colors.textDim}>
              {away ? `${trip.flag} ${clockIn(trip.timezone, now)}  ·  🇮🇳 ${clockIn(trip.homeTimezone, now)}` : `Local ${clockIn(trip.timezone, now)}`}
            </Txt>
          </View>
        </Row>
        <MeChip trip={trip} onPress={openWho} />
      </Row>

      <View style={{ paddingHorizontal: space.lg, marginTop: space.sm }}>
        <SyncLine />
      </View>

      <View style={{ paddingHorizontal: space.lg, marginTop: space.md }}>
        <NowNextHud trip={trip} />
        <Row style={{ marginTop: space.md, alignItems: 'stretch' }}>
          {phase !== 'completed' && (
            <Card onPress={() => router.push(`/trip/${trip.id}/readiness`)} style={{ flex: 1, padding: space.md }}>
              <Row>
                <Ring pct={ready.pct} size={44} stroke={5} color={ready.pct >= 0.99 ? colors.emerald : colors.gold}>
                  <Txt v="small" style={{ fontWeight: '800', fontSize: 11 }}>
                    {Math.round(ready.pct * 100)}%
                  </Txt>
                </Ring>
                <View style={{ flex: 1 }}>
                  <Txt v="h3">Ready</Txt>
                  <Txt v="small" color={colors.textDim} style={{ fontSize: 11 }}>
                    {ready.docsDone}/{ready.docsTotal} docs · {ready.itemsDone}/{ready.itemsTotal} tasks
                  </Txt>
                </View>
              </Row>
            </Card>
          )}
          <Card onPress={() => router.push(`/trip/${trip.id}/invite`)} style={{ flex: 1, padding: space.md }}>
            <Txt v="h3">Family</Txt>
            <Row style={{ marginTop: 4, justifyContent: 'space-between' }}>
              <JoinedStack trip={trip} size={22} />
              <Txt v="small" color={colors.gold} style={{ fontSize: 11 }}>
                {joined}/{trip.travelers.length} · {joined > 1 ? 'Family' : 'Invite'}
              </Txt>
            </Row>
          </Card>
        </Row>
      </View>

      <View style={{ marginTop: space.xl }}>
        <DayPills days={trip.days} selected={day.index} onSelect={setDayIndex} />
      </View>

      <DayHeader trip={trip} day={day} onShare={() => shareDay(trip, day.index)} />

      <View style={{ paddingHorizontal: space.lg }}>
        {stops.length === 0 ? (
          <Txt v="small" color={colors.textDim}>
            Nothing scheduled yet.
          </Txt>
        ) : (
          stops.map((s, i) => <StopRow key={s.id} trip={trip} stop={s} last={i === stops.length - 1} isNow={s.id === nowStopId} onDelete={() => deleteStop(s.id)} />)
        )}
        {editable && (
          <View style={{ alignSelf: 'flex-start', marginTop: space.sm }}>
            <Pill icon="add" label="Add a stop" onPress={() => setAdding(true)} />
          </View>
        )}
      </View>
      {editable && <AddStopSheet trip={trip} day={day} visible={adding} onClose={() => setAdding(false)} />}
    </ScrollView>
  );
}
