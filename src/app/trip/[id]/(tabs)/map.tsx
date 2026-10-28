import { Camera, GeoJSONSource, Layer, LocationManager, Map, Marker, NativeUserLocation, useCurrentPosition, type CameraRef } from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconButton, Pill, Row, Sheet, Txt, type IconName } from '@/components/ui';
import { tap } from '@/lib/haptics';
import { MAP_STYLE, useOfflineRegions } from '@/lib/offline-maps';
import { localTime, shortDate, stopsForDay, todayIn, tripPhase } from '@/lib/time';
import { openNavigation } from '@/lib/trip';
import { useTripId } from '@/lib/trip-context';
import { useTrip } from '@/store/trips';
import { categoryStyle, colors, radius, space } from '@/theme';
import type { StopCategory, Trip } from '@/types/trip';

type Mode = { kind: 'day'; index: number } | { kind: 'all' | 'stay' | 'food' | 'shopping' };

interface Pin {
  id: string;
  n?: number;
  title: string;
  titleLocal?: string;
  sub: string;
  category: StopCategory;
  lat: number;
  lng: number;
  address?: string;
}

const hasCoords = (lat?: number, lng?: number): lat is number => lat != null && lng != null && !(lat === 0 && lng === 0);

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : km < 100 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`);

function pinsFor(trip: Trip, mode: Mode): Pin[] {
  if (mode.kind === 'stay')
    return trip.stays.filter((s) => hasCoords(s.lat, s.lng)).map((s) => ({ id: s.id, title: s.name, titleLocal: s.addressLocal, sub: `${s.city} · ${shortDate(s.checkIn.slice(0, 10))}`, category: 'stay', lat: s.lat, lng: s.lng, address: s.address }));
  const days = mode.kind === 'day' ? trip.days.filter((d) => d.index === mode.index) : trip.days;
  const out: Pin[] = [];
  const seen = new Set<string>();
  for (const d of days)
    for (const s of stopsForDay(trip, d)) {
      if (!hasCoords(s.lat, s.lng) || s.lng == null) continue;
      if (mode.kind === 'food' && s.category !== 'food') continue;
      if (mode.kind === 'shopping' && s.category !== 'shopping') continue;
      const key = `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: s.id, title: s.title, titleLocal: s.titleLocal, sub: `Day ${d.index} · ${localTime(s.start) || 'flexible'}`, category: s.category, lat: s.lat, lng: s.lng, address: s.address });
    }
  if (mode.kind === 'day') out.forEach((p, i) => (p.n = i + 1));
  return out;
}

export default function Radar() {
  const id = useTripId();
  const trip = useTrip(id)!;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const camera = useRef<CameraRef>(null);
  const list = useRef<FlatList<Pin>>(null);
  const offline = useOfflineRegions(trip);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [locOn, setLocOn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const position = useCurrentPosition({ enabled: locOn, minDisplacement: 25 });
  const here = position ? { lat: position.coords.latitude, lng: position.coords.longitude } : undefined;

  const defaultMode = useMemo<Mode>(() => {
    if (tripPhase(trip) === 'active') {
      const d = trip.days.find((x) => x.date === todayIn(trip.timezone));
      if (d) return { kind: 'day', index: d.index };
    }
    const first = trip.days.find((d) => pinsFor(trip, { kind: 'day', index: d.index }).length > 0);
    return first ? { kind: 'day', index: first.index } : { kind: 'all' };
  }, [trip]);
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [selected, setSelected] = useState(0);

  const pins = useMemo(() => pinsFor(trip, mode), [trip, mode]);
  const stays = useMemo(() => (mode.kind === 'stay' ? [] : trip.stays.filter((s) => hasCoords(s.lat, s.lng))), [trip, mode]);
  const route = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(
    () => (mode.kind === 'day' && pins.length > 1 ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pins.map((p) => [p.lng, p.lat]) } } : null),
    [mode, pins],
  );

  // Fit the camera to whatever is on screen whenever the filter changes.
  useEffect(() => {
    if (!loaded || !pins.length) return;
    if (pins.length === 1) {
      camera.current?.flyTo({ center: [pins[0].lng, pins[0].lat], zoom: 14, duration: 700 });
      return;
    }
    const core = pins.filter((p) => p.category !== 'transit' && p.category !== 'flight');
    const focus = core.length >= 2 ? core : pins;
    const lngs = focus.map((p) => p.lng);
    const lats = focus.map((p) => p.lat);
    camera.current?.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], {
      padding: { top: insets.top + 150, bottom: 230, left: 50, right: 50 },
      duration: 700,
    });
  }, [loaded, pins, insets.top]);

  const cardW = width - space.xl * 2;
  const fly = (i: number) => {
    const p = pins[i];
    if (!p) return;
    setSelected(i);
    camera.current?.flyTo({ center: [p.lng, p.lat], zoom: 15, duration: 800 });
  };
  const choose = (m: Mode) => {
    tap();
    setMode(m);
    setSelected(0);
    list.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const locate = async () => {
    const ok = await LocationManager.requestPermissions().catch(() => false);
    if (!ok) {
      Alert.alert('Location is off', 'Allow location to see where you are and how far each stop is. It works offline (GPS).');
      return;
    }
    setLocOn(true);
    const pos = await LocationManager.getCurrentPosition().catch(() => undefined);
    if (!pos) return;
    const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const nearest = Math.min(...pins.map((p) => distanceKm(me, p)));
    if (pins.length && nearest > 300) {
      Alert.alert('You’re not there yet', `You are ${fmtKm(nearest)} from today’s stops. Distances will show on each card once you arrive.`);
      return;
    }
    camera.current?.flyTo({ center: [me.lng, me.lat], zoom: 14, duration: 800 });
  };

  const isDay = (i: number) => mode.kind === 'day' && mode.index === i;
  const first = pins[0] ?? stays[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Map style={{ flex: 1 }} mapStyle={MAP_STYLE} logo={false} attribution={false} compass={false} onDidFinishLoadingMap={() => setLoaded(true)}>
        <Camera ref={camera} initialViewState={first ? { center: [first.lng, first.lat], zoom: 11 } : { zoom: 2 }} />
        {locOn && <NativeUserLocation key="me" />}
        {route && (
          <GeoJSONSource id="day-route" data={route}>
            <Layer id="day-route-glow" type="line" paint={{ 'line-color': colors.gold, 'line-width': 8, 'line-opacity': 0.18 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
            <Layer id="day-route-line" type="line" paint={{ 'line-color': colors.gold, 'line-width': 3, 'line-dasharray': [2, 1.5] }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
          </GeoJSONSource>
        )}
        {stays.map((s) => (
          <Marker key={`stay-${s.id}-${locOn ? 'l' : 'n'}`} id={`stay-${s.id}`} lngLat={[s.lng, s.lat]} anchor="center">
            <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg }}>
              <Icon name="bed" size={14} color={colors.bg} />
            </View>
          </Marker>
        ))}
        {pins.map((p, i) => {
          const c = categoryStyle[p.category];
          const active = i === selected;
          return (
            <Marker
              key={`${p.id}-${locOn ? 'l' : 'n'}`}
              id={p.id}
              lngLat={[p.lng, p.lat]}
              anchor="center"
              onPress={() => {
                tap();
                fly(i);
                list.current?.scrollToIndex({ index: i, animated: true });
              }}>
              <View
                style={{
                  width: active ? 36 : 28,
                  height: active ? 36 : 28,
                  borderRadius: 18,
                  backgroundColor: active ? c.color : colors.surface,
                  borderWidth: 2,
                  borderColor: c.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {p.n ? (
                  <Txt v="small" style={{ fontWeight: '900', fontSize: active ? 14 : 12 }} color={active ? colors.bg : c.color}>
                    {p.n}
                  </Txt>
                ) : (
                  <Icon name={c.icon as IconName} size={active ? 16 : 13} color={active ? colors.bg : c.color} />
                )}
              </View>
            </Marker>
          );
        })}
      </Map>

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + space.sm, paddingBottom: space.sm, backgroundColor: 'rgba(8,12,20,0.82)' }}>
        <Row style={{ paddingHorizontal: space.lg, justifyContent: 'space-between' }}>
          <View>
            <Txt v="h2">Radar</Txt>
            <Txt v="small" color={colors.textDim}>
              {mode.kind === 'day' ? `${pins.length} stops · Day ${mode.index}` : `${pins.length} places`}
            </Txt>
          </View>
          <Row>
            <IconButton icon={locOn ? 'locate' : 'locate-outline'} color={locOn ? colors.sky : colors.text} onPress={locate} label="My location" />
            <IconButton icon={offline.done ? 'cloud-done' : 'cloud-download-outline'} color={offline.done ? colors.emerald : colors.gold} onPress={() => setOfflineOpen(true)} label="Offline maps" />
          </Row>
        </Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg, marginTop: space.sm }}>
          {trip.days
            .filter((d) => pinsFor(trip, { kind: 'day', index: d.index }).length > 0)
            .map((d) => (
              <Pill key={d.index} label={`Day ${d.index} · ${shortDate(d.date).slice(5)}`} active={isDay(d.index)} onPress={() => choose({ kind: 'day', index: d.index })} />
            ))}
          <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />
          <Pill label="All" icon="apps" active={mode.kind === 'all'} onPress={() => choose({ kind: 'all' })} />
          <Pill label="Stays" icon="bed" color={colors.sky} active={mode.kind === 'stay'} onPress={() => choose({ kind: 'stay' })} />
          <Pill label="Pure veg" icon="leaf" color={colors.emerald} active={mode.kind === 'food'} onPress={() => choose({ kind: 'food' })} />
          <Pill label="Shopping" icon="bag-handle" color={colors.violet} active={mode.kind === 'shopping'} onPress={() => choose({ kind: 'shopping' })} />
        </ScrollView>
        {!offline.done && trip.offlineRegions.length > 0 && (
          <Pressable onPress={() => setOfflineOpen(true)} style={{ marginHorizontal: space.lg, marginTop: space.sm, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="cloud-offline-outline" size={14} color={colors.gold} />
            <Txt v="small" color={colors.gold} style={{ fontSize: 12 }}>
              Map not saved for offline yet — tap to download on Wi-Fi
            </Txt>
          </Pressable>
        )}
      </View>

      <View style={{ position: 'absolute', bottom: space.lg, left: 0, right: 0 }}>
        {pins.length === 0 ? (
          <View style={{ marginHorizontal: space.xl, padding: space.lg, backgroundColor: colors.surface, borderRadius: radius.lg }}>
            <Txt v="small" color={colors.textDim}>
              No mapped places for this filter yet.
            </Txt>
          </View>
        ) : (
          <FlatList
            ref={list}
            data={pins}
            horizontal
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardW + space.md}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md }}
            getItemLayout={(_, i) => ({ length: cardW + space.md, offset: (cardW + space.md) * i, index: i })}
            onMomentumScrollEnd={(e) => fly(Math.round(e.nativeEvent.contentOffset.x / (cardW + space.md)))}
            renderItem={({ item, index }) => {
              const c = categoryStyle[item.category];
              const km = here ? distanceKm(here, item) : undefined;
              const dist = km != null && km < 300 ? fmtKm(km) : undefined;
              const local = item.titleLocal;
              return (
                <Pressable
                  onPress={() => fly(index)}
                  style={{ width: cardW, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface2, borderWidth: 1, borderColor: index === selected ? c.color : colors.border, elevation: 6 }}>
                  <Row gap={space.md}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
                      {item.n ? (
                        <Txt v="h3" color={c.color}>
                          {item.n}
                        </Txt>
                      ) : (
                        <Icon name={c.icon as IconName} color={c.color} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt v="h3" numberOfLines={1}>
                        {item.title}
                      </Txt>
                      <Txt v="small" color={colors.textDim} numberOfLines={1}>
                        {c.label} · {item.sub}
                        {dist ? ` · ${dist} away` : ''}
                      </Txt>
                    </View>
                  </Row>
                  <Row style={{ marginTop: space.sm }}>
                    <Pill small icon="navigate" label="Navigate" active onPress={() => openNavigation(item)} />
                    {(local || item.address) && (
                      <Pill
                        small
                        icon="car"
                        label="Driver card"
                        color={colors.sky}
                        onPress={() => router.push({ pathname: '/trip/[id]/card', params: { id: trip.id, title: item.title, local: local ?? item.address ?? '', sub: item.address ?? '' } })}
                      />
                    )}
                    <Txt v="small" color={colors.textMute} style={{ marginLeft: 'auto' }}>
                      {index + 1}/{pins.length}
                    </Txt>
                  </Row>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      <Sheet visible={offlineOpen} onClose={() => setOfflineOpen(false)} title="Offline maps">
        <Txt v="small" color={colors.textDim} style={{ marginBottom: space.md }}>
          Download on Wi-Fi before you fly. Radar then works with no signal; your blue dot uses GPS, which needs no data. Navigate opens Google Maps — download those areas there too (Profile → Offline maps).
        </Txt>
        {trip.offlineRegions.length > 1 && !offline.done && (
          <Pill icon="download" label="Download all regions" active onPress={() => void offline.downloadAll()} />
        )}
        {trip.offlineRegions.map((r) => {
          const st = offline.states[r.id];
          return (
            <Row key={r.id} style={{ justifyContent: 'space-between', paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <Txt v="h3">{r.name}</Txt>
                <Txt v="small" color={st?.state === 'error' ? colors.rose : colors.textDim}>
                  {st?.state === 'complete' ? 'Saved for offline' : st?.state === 'active' ? `Downloading… ${Math.round(st.pct)}%` : st?.state === 'error' ? 'Failed — retry on Wi-Fi' : 'Not downloaded'}
                </Txt>
                {st?.state === 'active' && (
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 6 }}>
                    <View style={{ width: `${Math.min(100, st.pct)}%`, height: 4, borderRadius: 2, backgroundColor: colors.gold }} />
                  </View>
                )}
              </View>
              {st?.state === 'complete' ? (
                <Icon name="checkmark-circle" color={colors.emerald} size={24} />
              ) : (
                <IconButton icon="download-outline" onPress={() => offline.download(r)} disabled={st?.state === 'active'} label={`Download ${r.name}`} />
              )}
            </Row>
          );
        })}
      </Sheet>
    </View>
  );
}
