import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SyncDot } from '@/components/sync-dot';
import { JoinedStack } from '@/components/identity';
import { Button, Icon, IconButton, Ring, Row, Txt } from '@/components/ui';
import { dateRange, daysUntil, tripPhase } from '@/lib/time';
import { useReadiness } from '@/lib/trip';
import { useSyncRefresh } from '@/lib/use-sync-refresh';
import { isTestApp } from '@/lib/variant';
import { useSession } from '@/store/session';
import { useTrips } from '@/store/trips';
import { colors, radius, space } from '@/theme';
import type { Trip } from '@/types/trip';

type Item = { kind: 'trip'; trip: Trip } | { kind: 'add' };

const phaseRank = { active: 0, upcoming: 1, completed: 2 } as const;

export default function Home() {
  const insets = useSafeAreaInsets();
  const refreshControl = useSyncRefresh();
  const { width, height } = useWindowDimensions();
  const order = useTrips((s) => s.order);
  const trips = useTrips((s) => s.trips);
  const cardW = Math.min(width * 0.8, 380, (height - 260) / 1.42);
  const gap = space.lg;
  const step = cardW + gap;
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const items: Item[] = [
    ...order
      .map((id) => trips[id])
      .filter(Boolean)
      .sort((a, b) => {
        const pa = tripPhase(a);
        const pb = tripPhase(b);
        if (pa !== pb) return phaseRank[pa] - phaseRank[pb];
        return pa === 'completed' ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate);
      })
      .map((trip) => ({ kind: 'trip' as const, trip })),
    { kind: 'add' },
  ];

  return (
    <ScrollView
      refreshControl={refreshControl}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.md }}>
      <Row style={{ paddingHorizontal: space.xl, justifyContent: 'space-between' }}>
        <View>
          <Txt v="tiny" color={isTestApp ? colors.rose : colors.gold}>
            {isTestApp ? 'Trip Buddy · TEST app — data is separate' : 'Trip Buddy'}
          </Txt>
          <Txt v="h1">Your expeditions</Txt>
        </View>
        <Row>
          <SyncDot />
          <IconButton icon="settings-outline" onPress={() => router.push('/settings')} label="Settings" />
        </Row>
      </Row>

      <Animated.FlatList
        data={items}
        keyExtractor={(it) => (it.kind === 'trip' ? it.trip.id : 'add')}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: (width - cardW) / 2, paddingVertical: space.xxl, gap }}
        renderItem={({ item, index }) => (
          <Tilt index={index} step={step} scrollX={scrollX}>
            {item.kind === 'trip' ? <PassportCard trip={item.trip} width={cardW} /> : <AddCard width={cardW} />}
          </Tilt>
        )}
      />
      <View style={{ flex: 1 }} />
      <Txt v="small" color={colors.textMute} style={{ textAlign: 'center', marginBottom: insets.bottom + space.lg }}>
        Swipe to switch trips · pull down to sync · works fully offline
      </Txt>
    </ScrollView>
  );
}

function Tilt({ index, step, scrollX, children }: { index: number; step: number; scrollX: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => {
    const pos = scrollX.value / step - index;
    return {
      transform: [
        { perspective: 1200 },
        { rotateY: `${interpolate(pos, [-1, 0, 1], [-18, 0, 18], 'clamp')}deg` },
        { scale: interpolate(Math.abs(pos), [0, 1], [1, 0.9], 'clamp') },
      ],
      opacity: interpolate(Math.abs(pos), [0, 1.2], [1, 0.55], 'clamp'),
    };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

function PassportCard({ trip, width }: { trip: Trip; width: number }) {
  const ready = useReadiness(trip);
  const shared = useSession((s) => Boolean(s.joinCodes[trip.id]));
  const syncing = useSession((s) => s.sync.status === 'syncing');
  const phase = tripPhase(trip);
  const d = daysUntil(trip.startDate);
  const status = phase === 'active' ? 'On the road now' : phase === 'completed' ? 'Completed' : d === 1 ? 'Takeoff tomorrow' : `${d} days to takeoff`;
  const statusColor = phase === 'active' ? colors.emerald : phase === 'completed' ? colors.textDim : colors.gold;

  return (
    <Pressable onPress={() => router.push(`/trip/${trip.id}`)} style={({ pressed }) => [{ width, opacity: pressed ? 0.92 : 1 }]}>
      <LinearGradient colors={[trip.cover.from, trip.cover.to]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={[s.passport, { height: width * 1.42 }]}>
        <View style={s.stitch} pointerEvents="none" />
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="tiny" color={trip.cover.accent}>
            Passport · {trip.country}
          </Txt>
          <Txt style={{ fontSize: 30 }}>{trip.flag}</Txt>
        </Row>

        <View style={{ alignItems: 'center', marginTop: space.lg }}>
          <View style={[s.crest, { borderColor: trip.cover.accent }]}>
            <Txt style={{ fontSize: 38, lineHeight: 46, color: trip.cover.accent }}>{trip.cover.emblem}</Txt>
          </View>
          <Txt v="display" style={{ marginTop: space.lg, textAlign: 'center' }}>
            {trip.title}
          </Txt>
          <Txt v="small" color={colors.textDim} style={{ textAlign: 'center', marginTop: 4 }} numberOfLines={2}>
            {trip.subtitle}
          </Txt>
        </View>

        <View style={{ flex: 1 }} />

        <View style={[s.statusPill, { borderColor: statusColor }]}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor }} />
          <Txt v="small" color={statusColor}>
            {status}
          </Txt>
        </View>

        <Row style={{ justifyContent: 'space-between', marginTop: space.lg }}>
          <View style={{ gap: 6 }}>
            <Txt v="tiny" color={colors.textDim}>
              {dateRange(trip.startDate, trip.endDate)}
            </Txt>
            <JoinedStack trip={trip} />
            <Txt v="small" color={colors.textDim}>
              {trip.travelers.length} travelers{shared ? '' : syncing ? ' · connecting…' : ' · not shared yet'}
            </Txt>
          </View>
          <Pressable onPress={() => router.push(`/trip/${trip.id}/readiness`)} hitSlop={8}>
            {phase === 'completed' ? (
              <Ring pct={1} size={78} color={colors.emerald}>
                <Icon name="checkmark" size={26} color={colors.emerald} />
                <Txt v="tiny" color={colors.textDim} style={{ fontSize: 8 }}>
                  Done
                </Txt>
              </Ring>
            ) : (
              <Ring pct={ready.pct} size={78} color={ready.pct >= 0.99 ? colors.emerald : trip.cover.accent}>
                <Txt v="h3">{Math.round(ready.pct * 100)}%</Txt>
                <Txt v="tiny" color={colors.textDim} style={{ fontSize: 8 }}>
                  Ready
                </Txt>
              </Ring>
            )}
          </Pressable>
        </Row>
      </LinearGradient>
    </Pressable>
  );
}

function AddCard({ width }: { width: number }) {
  return (
    <View style={[s.add, { width, height: width * 1.42 }]}>
      <View style={s.addIcon}>
        <Icon name="add" size={36} color={colors.gold} />
      </View>
      <Txt v="h2">Add a trip</Txt>
      <Txt v="small" color={colors.textDim} style={{ textAlign: 'center', paddingHorizontal: space.xl }}>
        Planning somewhere new, or got a family code?
      </Txt>
      <View style={{ gap: space.sm, alignSelf: 'stretch', paddingHorizontal: space.xl }}>
        <Button label="New trip" icon="airplane" onPress={() => router.push('/new-trip')} />
        <Button label="Join with code" icon="enter" kind="ghost" onPress={() => router.push('/join')} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  passport: {
    borderRadius: radius.xl,
    padding: space.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stitch: {
    ...StyleSheet.absoluteFill,
    margin: 8,
    borderRadius: radius.xl - 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(245,158,11,0.35)',
  },
  crest: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  add: { borderRadius: radius.xl, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', gap: space.md },
  addIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
});
