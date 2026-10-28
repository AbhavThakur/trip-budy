import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { categoryStyle, colors, radius, space } from '@/theme';
import { durationLabel, flightDuration, localTime, nowAndNext, shortDate, tripPhase } from '@/lib/time';
import { openNavigation, passKey } from '@/lib/trip';
import { useLedger } from '@/store/ledger';
import type { Day, Flight, Stop, Trip } from '@/types/trip';

import { Card, Icon, IconButton, Pill, Row, StatusBadge, Txt, type IconName } from './ui';

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Upcoming flight + its web check-in window (IndiGo opens 48h before international, VietJet 24h). */
function nextFlight(trip: Trip, now: Date): { flight: Flight; checkinOpensAt: number } | undefined {
  const f = trip.flights.filter((x) => Date.parse(x.depart) > now.getTime()).sort((a, b) => Date.parse(a.depart) - Date.parse(b.depart))[0];
  if (!f) return undefined;
  const hours = f.airline.startsWith('IndiGo') ? 48 : 24;
  return { flight: f, checkinOpensAt: Date.parse(f.depart) - hours * 3600e3 };
}

export function NowNextHud({ trip }: { trip: Trip }) {
  const now = useNow();
  const phase = tripPhase(trip, now);
  const nf = nextFlight(trip, now);

  if (phase === 'completed') {
    const stops = trip.days.reduce((n, d) => n + d.stops.length, 0);
    return (
      <Card style={{ borderColor: colors.border }}>
        <Txt v="tiny" color={colors.textDim}>
          Trip complete
        </Txt>
        <Txt v="h2" style={{ marginTop: 4 }}>
          {trip.days.length} days · {stops} stops
        </Txt>
        <Txt v="small" color={colors.textDim}>
          Every day, document and expense is kept on this phone.
        </Txt>
      </Card>
    );
  }

  const nn = nowAndNext(trip, now);
  const upcoming = phase === 'upcoming';
  const countdown = upcoming && nn.next ? durationLabel(Date.parse(trip.flights[0]?.depart ?? nn.next.start!) - now.getTime()) : undefined;

  return (
    <Card style={{ borderColor: colors.gold, backgroundColor: '#14120B' }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="tiny" color={colors.gold}>
          {upcoming ? 'Countdown to takeoff' : nn.now ? 'Happening now' : 'Up next'}
        </Txt>
        <Row gap={6}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: upcoming ? colors.gold : colors.emerald }} />
          <Txt v="small" color={colors.textDim}>
            Live
          </Txt>
        </Row>
      </Row>

      {upcoming ? (
        <Txt v="display" style={{ marginTop: 4 }}>
          {countdown}
        </Txt>
      ) : nn.now ? (
        <HudStop stop={nn.now} label={`until ${localTime(nn.now.end) || '—'}`} />
      ) : null}

      {nn.next && (
        <View style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderColor: 'rgba(245,158,11,0.2)' }}>
          <Txt v="tiny" color={colors.textDim}>
            Next · in {durationLabel(nn.nextInMs ?? 0)}
          </Txt>
          <HudStop stop={nn.next} label={`${shortDate(nn.next.start!.slice(0, 10))} · ${localTime(nn.next.start)}`} />
        </View>
      )}

      {nf && nf.checkinOpensAt - now.getTime() < 7 * 864e5 && (
        <Pressable
          onPress={() => nf.flight.checkinUrl && Linking.openURL(nf.flight.checkinUrl)}
          style={{ marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.skySoft, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Icon name="checkmark-done-circle" color={colors.sky} />
          <Txt v="small" color={colors.sky} style={{ flex: 1 }}>
            {nf.checkinOpensAt <= now.getTime()
              ? `Web check-in open for ${nf.flight.flightNo} — tap to check in`
              : `Web check-in for ${nf.flight.flightNo} opens in ${durationLabel(nf.checkinOpensAt - now.getTime())}`}
          </Txt>
          <Icon name="open-outline" size={14} color={colors.sky} />
        </Pressable>
      )}
    </Card>
  );
}

function HudStop({ stop, label }: { stop: Stop; label: string }) {
  const c = categoryStyle[stop.category];
  return (
    <Row style={{ marginTop: 6 }} gap={space.md}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={c.icon as IconName} color={c.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt v="h3" numberOfLines={2}>
          {stop.title}
        </Txt>
        <Txt v="small" color={colors.textDim}>
          {label}
        </Txt>
      </View>
    </Row>
  );
}

export function DayPills({ days, selected, onSelect }: { days: Day[]; selected: number; onSelect: (i: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
      {days.map((d) => {
        const active = d.index === selected;
        const [, , dd] = d.date.split('-');
        return (
          <Pressable
            key={d.index}
            onPress={() => onSelect(d.index)}
            style={{
              width: 58,
              paddingVertical: space.sm,
              borderRadius: radius.md,
              alignItems: 'center',
              backgroundColor: active ? colors.gold : colors.surface,
              borderWidth: 1,
              borderColor: active ? colors.gold : colors.border,
            }}>
            <Txt v="tiny" color={active ? colors.bg : colors.textDim} style={{ fontSize: 9 }}>
              Day {d.index}
            </Txt>
            <Txt v="h2" color={active ? colors.bg : colors.text}>
              {Number(dd)}
            </Txt>
            <Txt v="small" color={active ? colors.bg : colors.textDim} style={{ fontSize: 11 }}>
              {shortDate(d.date).slice(0, 3)}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function StopRow({ trip, stop, last, isNow, onDelete }: { trip: Trip; stop: Stop; last: boolean; isNow: boolean; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  const c = categoryStyle[stop.category];
  const flight = stop.ref?.type === 'flight' ? trip.flights.find((f) => f.id === stop.ref!.id) : undefined;
  const stay = stop.ref && stop.ref.type !== 'flight' ? trip.stays.find((s) => s.id === stop.ref!.id) : undefined;
  const hasPlace = stop.lat != null || !!stop.address;

  return (
    <Animated.View layout={LinearTransition.duration(180)} style={{ flexDirection: 'row', gap: space.md }}>
      <View style={{ width: 46, alignItems: 'flex-end', paddingTop: 14 }}>
        <Txt v="small" style={{ fontWeight: '700' }} color={isNow ? colors.gold : colors.text}>
          {localTime(stop.start) || '—'}
        </Txt>
        {stop.end && (
          <Txt v="small" color={colors.textMute} style={{ fontSize: 11 }}>
            {localTime(stop.end)}
          </Txt>
        )}
      </View>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 2, height: 16, backgroundColor: colors.border }} />
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: isNow ? colors.gold : c.color, borderWidth: 2, borderColor: colors.bg }} />
        {!last && <View style={{ width: 2, flex: 1, backgroundColor: colors.border }} />}
      </View>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ flex: 1, paddingBottom: space.md }}>
        <View style={{ backgroundColor: isNow ? '#14120B' : colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: isNow ? colors.gold : colors.border, padding: space.md }}>
          <Row gap={space.sm} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={c.icon as IconName} size={15} color={c.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt v="h3" numberOfLines={open ? undefined : 2}>
                {stop.title}
              </Txt>
              {stop.titleLocal && (
                <Txt v="small" color={colors.textDim}>
                  {stop.titleLocal}
                </Txt>
              )}
            </View>
            {flight && <StatusBadge status={flight.status} />}
            {stay && <StatusBadge status={stay.status} />}
          </Row>

          {flight && (
            <Txt v="small" color={colors.sky} style={{ marginTop: 6 }}>
              {flight.from.city} {flight.from.terminal ?? ''} → {flight.to.city} {flight.to.terminal ?? ''} · {flightDuration(flight)} · PNR {flight.bookings.map((b) => b.pnr).join(' / ')}
            </Txt>
          )}

          {stop.notes && (
            <Txt v="small" color={colors.textDim} style={{ marginTop: 6 }} numberOfLines={open ? undefined : 2}>
              {stop.notes}
            </Txt>
          )}

          {open && (
            <Animated.View entering={FadeIn.duration(160)} style={{ marginTop: space.sm, gap: space.sm }}>
              {stop.tips?.map((t, i) => (
                <Row key={i} gap={space.sm} style={{ alignItems: 'flex-start' }}>
                  <Icon name={TIP_ICON[t.kind]} size={14} color={colors.gold} />
                  <Txt v="small" style={{ flex: 1 }}>
                    {t.text}
                  </Txt>
                </Row>
              ))}
              {stop.transitToNext && (
                <Row gap={space.sm}>
                  <Icon name="arrow-down-circle-outline" size={14} color={colors.textDim} />
                  <Txt v="small" color={colors.textDim} style={{ flex: 1 }}>
                    {stop.transitToNext}
                  </Txt>
                </Row>
              )}
              <Row style={{ flexWrap: 'wrap', marginTop: 4 }}>
                {hasPlace && <Pill small icon="navigate" label="Navigate" onPress={() => openNavigation(stop)} />}
                {(stop.titleLocal || stay?.addressLocal) && (
                  <Pill
                    small
                    icon="car"
                    label="Driver card"
                    color={colors.sky}
                    onPress={() =>
                      router.push({
                        pathname: '/trip/[id]/card',
                        params: { id: trip.id, title: stay?.name ?? stop.title, local: stay?.addressLocal ?? stop.titleLocal ?? '', sub: stay?.address ?? stop.address ?? '' },
                      })
                    }
                  />
                )}
                {onDelete && stop.id.startsWith('u-') && <Pill small icon="trash" label="Delete" color={colors.rose} onPress={onDelete} />}
                {flight && <Pill small icon="airplane" label="Flight details" color={colors.sky} onPress={() => router.push(`/trip/${trip.id}/flights`)} />}
                {stay && <Pill small icon="bed" label="Booking" color={colors.sky} onPress={() => router.push(`/trip/${trip.id}/stays`)} />}
              </Row>
            </Animated.View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const TIP_ICON: Record<string, IconName> = { senior: 'accessibility', insider: 'bulb', photo: 'camera', shopping: 'bag-handle' };

export function DayHeader({ trip, day, onShare }: { trip: Trip; day: Day; onShare: () => void }) {
  const stay = trip.stays.find((s) => s.id === day.stayId);
  const marks = useLedger((st) => st.checklist);
  const dayPasses = (trip.passes ?? []).filter((p) => p.dayIndex === day.index && p.buy !== 'free');
  const toBook = dayPasses.filter((p) => (p.buy === 'online' || p.buy === 'gate') && !marks[passKey(trip.id, p.id)]?.done).length;
  return (
    <View style={{ paddingHorizontal: space.lg, marginTop: space.lg, marginBottom: space.md }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Txt v="tiny" color={colors.gold}>
            {shortDate(day.date)}
            {day.weather ? ` · ${day.weather}` : ''}
          </Txt>
          <Txt v="h2" style={{ marginTop: 2 }}>
            {day.title}
          </Txt>
          {day.subtitle && (
            <Txt v="small" color={colors.textDim}>
              {day.subtitle}
            </Txt>
          )}
        </View>
        <IconButton icon="logo-whatsapp" onPress={onShare} color={colors.emerald} label="Share day" />
      </Row>
      {stay && (
        <Row gap={6} style={{ marginTop: space.sm }}>
          <Icon name="bed-outline" size={14} color={colors.sky} />
          <Txt v="small" color={colors.sky}>
            Tonight: {stay.name}
          </Txt>
        </Row>
      )}
      {dayPasses.length > 0 && (
        <Pressable onPress={() => router.push(`/trip/${trip.id}/tickets`)} style={{ marginTop: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: toBook ? colors.goldSoft : colors.surface, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Icon name="ticket" size={16} color={colors.gold} />
          <Txt v="small" style={{ flex: 1 }} numberOfLines={2}>
            {dayPasses.map((p) => p.title.replace(/ \(.*\)$/, '')).join(' · ')}
          </Txt>
          <Txt v="small" color={toBook ? colors.gold : colors.emerald} style={{ fontWeight: '700' }}>
            {toBook ? `${toBook} to book` : 'Tickets'}
          </Txt>
          <Icon name="chevron-forward" size={14} color={colors.textDim} />
        </Pressable>
      )}
      {day.highlights?.map((h, i) => (
        <Row key={i} gap={6} style={{ marginTop: 4, alignItems: 'flex-start' }}>
          <Txt v="small" color={colors.gold}>
            ✦
          </Txt>
          <Txt v="small" color={colors.textDim} style={{ flex: 1 }}>
            {h}
          </Txt>
        </Row>
      ))}
    </View>
  );
}
