import { Camera, GeoJSONSource, Layer, LocationManager, Map, Marker, NativeUserLocation, useCurrentPosition, type CameraRef } from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, View } from 'react-native';
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

type Mode = { kind: 'day'; index: number } | { kind: 'all' | 'stay' | 'food' | 'shopping' | 'near' };

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
  km?: number;
}

type Here = { lat: number; lng: number };
const hasCoords = (lat?: number, lng?: number): lat is number => lat != null && lng != null && !(lat === 0 && lng === 0);

function distanceKm(a: Here, b: Here) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : km < 100 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`);
/** rough city speeds: ~15 km/h by car in traffic, 5 km/h on foot */
const eta = (km: number) => (km <= 0.8 ? `${Math.max(1, Math.round((km / 5) * 60))} min walk` : `${Math.max(2, Math.round((km / 15) * 60))} min by car`);

function pinsFor(trip: Trip, mode: Mode): Pin[] {
  if (mode.kind === 'stay' || mode.kind === 'near') {
    const stays = trip.stays.filter((s) => hasCoords(s.lat, s.lng)).map<Pin>((s) => ({ id: s.id, title: s.name, titleLocal: s.addressLocal, sub: `Stay · ${s.city}`, category: 'stay', lat: s.lat, lng: s.lng, address: s.address }));
    if (mode.kind === 'stay') return stays;
  }
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
  const camera = useRef<CameraRef>(null);
  const offline = useOfflineRegions(trip);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [locOn, setLocOn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fix, setFix] = useState<{ lat: number; lng: number } | undefined>();
  const position = useCurrentPosition({ enabled: locOn, minDisplacement: 25 });
  // live updates once they arrive, otherwise the one-off fix taken when location was switched on
  const lat = position?.coords.latitude ?? fix?.lat;
  const lng = position?.coords.longitude ?? fix?.lng;
  const here = useMemo<Here | undefined>(() => (lat != null && lng != null ? { lat, lng } : undefined), [lat, lng]);

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

  const pins = useMemo<Pin[]>(() => {
    if (mode.kind !== 'near') return pinsFor(trip, mode);
    if (!here) return [];
    const all = [...pinsFor(trip, { kind: 'stay' }), ...pinsFor(trip, { kind: 'all' })];
    const seen = new Set<string>();
    return all
      .map((p) => ({ ...p, km: distanceKm(here, p) }))
      .filter((p) => p.km < 6 && !seen.has(`${p.lat.toFixed(4)},${p.lng.toFixed(4)}`) && seen.add(`${p.lat.toFixed(4)},${p.lng.toFixed(4)}`))
      .sort((a, b) => a.km - b.km)
      .slice(0, 12);
  }, [trip, mode, here]);
  const withDist = useMemo(() => (here ? pins.map((p) => ({ ...p, km: p.km ?? distanceKm(here, p) })) : pins), [pins, here]);

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
      padding: { top: insets.top + 150, bottom: 300, left: 50, right: 50 },
      duration: 700,
    });
  }, [loaded, pins, insets.top]);

  const select = (i: number) => {
    const p = pins[i];
    if (!p) return;
    setSelected(i);
    camera.current?.flyTo({ center: [p.lng, p.lat], zoom: 15, duration: 700 });
  };
  const step = (d: number) => {
    tap();
    select((selected + d + pins.length) % pins.length);
  };
  const choose = (m: Mode) => {
    tap();
    setMode(m);
    setSelected(0);
  };

  const ensureLocation = async () => {
    const ok = await LocationManager.requestPermissions().catch(() => false);
    if (!ok) {
      Alert.alert('Location is off', 'Allow location to see where you are, how far each stop is, and to share your position with family. GPS works without internet.');
      return false;
    }
    setLocOn(true);
    void LocationManager.getCurrentPosition()
      .then((p) => p && setFix({ lat: p.coords.latitude, lng: p.coords.longitude }))
      .catch(() => undefined);
    return true;
  };
  const locate = async () => {
    if (!(await ensureLocation())) return;
    const pos = await LocationManager.getCurrentPosition().catch(() => undefined);
    if (!pos) return;
    const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const nearest = pins.length ? Math.min(...pins.map((p) => distanceKm(me, p))) : 0;
    if (pins.length && nearest > 300) {
      Alert.alert('You’re not there yet', `You are ${fmtKm(nearest)} from these stops. Distances and “Near me” light up once you arrive.`);
      return;
    }
    camera.current?.flyTo({ center: [me.lng, me.lat], zoom: 14, duration: 800 });
  };
  const shareLocation = async () => {
    if (!(await ensureLocation())) return;
    const pos = await LocationManager.getCurrentPosition().catch(() => undefined);
    if (!pos) return Alert.alert('No GPS fix yet', 'Step outside or wait a few seconds and try again.');
    const { latitude: la, longitude: lo } = pos.coords;
    await Share.share({ message: `📍 I'm here (${trip.title} trip): https://maps.google.com/?q=${la.toFixed(6)},${lo.toFixed(6)}` });
  };
  const hotelHome = () => {
    tap();
    const today = trip.days.find((d) => d.date === todayIn(trip.timezone));
    const withGps = trip.stays.filter((s) => hasCoords(s.lat, s.lng));
    const stay = (today?.stayId && trip.stays.find((s) => s.id === today.stayId)) || (here && [...withGps].sort((a, b) => distanceKm(here, a) - distanceKm(here, b))[0]) || withGps[0];
    if (!stay) return;
    Alert.alert(stay.name, stay.address, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Show driver card', onPress: () => router.push({ pathname: '/trip/[id]/card', params: { id: trip.id, title: stay.name, local: stay.addressLocal ?? stay.address, sub: stay.address } }) },
      { text: 'Navigate', onPress: () => void openNavigation(stay) },
    ]);
  };

  const cur = withDist[selected];
  const isDay = (i: number) => mode.kind === 'day' && mode.index === i;
  const first = pins[0] ?? stays[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Map style={{ flex: 1 }} mapStyle={MAP_STYLE} logo={false} attribution={false} compass={false} onDidFinishLoadingMap={() => setLoaded(true)}>
        <Camera ref={camera} initialViewState={first ? { center: [first.lng, first.lat], zoom: 11 } : { zoom: 2 }} />
        {locOn && <NativeUserLocation key="me" />}
        {route && (
          <GeoJSONSource id="day-route" data={route}>
            <Layer id="day-route-casing" type="line" paint={{ 'line-color': '#FFFFFF', 'line-width': 7, 'line-opacity': 0.9 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
            <Layer id="day-route-line" type="line" paint={{ 'line-color': '#D97706', 'line-width': 3.5, 'line-dasharray': [2, 1.4] }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
          </GeoJSONSource>
        )}
        {stays.map((s) => (
          <Marker key={`stay-${s.id}-${locOn ? 'l' : 'n'}`} id={`stay-${s.id}`} lngLat={[s.lng, s.lat]} anchor="center">
            <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#0284C7', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', elevation: 4 }}>
              <Icon name="bed" size={14} color="#fff" />
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
                select(i);
              }}>
              <View
                style={{
                  width: active ? 40 : 30,
                  height: active ? 40 : 30,
                  borderRadius: 20,
                  backgroundColor: active ? c.color : '#FFFFFF',
                  borderWidth: 2.5,
                  borderColor: active ? '#FFFFFF' : c.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                  elevation: active ? 8 : 4,
                }}>
                {p.n ? (
                  <Txt v="small" style={{ fontWeight: '900', fontSize: active ? 15 : 12 }} color={active ? '#080C14' : c.color}>
                    {p.n}
                  </Txt>
                ) : (
                  <Icon name={c.icon as IconName} size={active ? 18 : 14} color={active ? '#080C14' : c.color} />
                )}
              </View>
            </Marker>
          );
        })}
      </Map>

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + space.sm, paddingBottom: space.sm, backgroundColor: 'rgba(8,12,20,0.88)' }}>
        <Row style={{ paddingHorizontal: space.lg, justifyContent: 'space-between' }}>
          <View>
            <Txt v="h2">Radar</Txt>
            <Txt v="small" color={colors.textDim}>
              {mode.kind === 'near' ? (here ? `${pins.length} places near you` : 'Turn on location') : mode.kind === 'day' ? `${pins.length} stops · Day ${mode.index}` : `${pins.length} places`}
            </Txt>
          </View>
          <Row>
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
          <Pill label="Near me" icon="locate" color={colors.sky} active={mode.kind === 'near'} onPress={async () => ((locOn || (await ensureLocation())) && choose({ kind: 'near' }))} />
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

      {/* floating helpers */}
      <View style={{ position: 'absolute', right: space.lg, bottom: 232 + insets.bottom * 0, gap: space.sm }}>
        <IconButton icon="home" size={46} bg={colors.surface2} color={colors.sky} onPress={hotelHome} label="Take me to my hotel" />
        <IconButton icon="share-social" size={46} bg={colors.surface2} color={colors.emerald} onPress={() => void shareLocation()} label="Share my location" />
        <IconButton icon={locOn ? 'locate' : 'locate-outline'} size={46} bg={colors.surface2} color={locOn ? colors.sky : colors.text} onPress={() => void locate()} label="My location" />
      </View>

      {/* one focused stop at a time — step with the arrows, or open the list */}
      <View style={{ position: 'absolute', bottom: space.lg, left: space.lg, right: space.lg }}>
        {cur ? (
          <View style={{ padding: space.md, borderRadius: radius.xl, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, elevation: 10 }}>
            <Row gap={space.sm}>
              <IconButton icon="chevron-back" size={38} bg={colors.surface} onPress={() => step(-1)} label="Previous stop" disabled={pins.length < 2} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Txt v="tiny" color={categoryStyle[cur.category].color}>
                  {categoryStyle[cur.category].label} · {selected + 1} of {pins.length}
                </Txt>
                <Txt v="h3" numberOfLines={2} style={{ textAlign: 'center' }}>
                  {cur.n ? `${cur.n}. ` : ''}
                  {cur.title}
                </Txt>
                <Txt v="small" color={colors.textDim} numberOfLines={1} style={{ textAlign: 'center' }}>
                  {cur.sub}
                  {cur.km != null && cur.km < 300 ? ` · ${fmtKm(cur.km)} · ${eta(cur.km)}` : ''}
                </Txt>
              </View>
              <IconButton icon="chevron-forward" size={38} bg={colors.surface} onPress={() => step(1)} label="Next stop" disabled={pins.length < 2} />
            </Row>
            <Row style={{ marginTop: space.md }} gap={space.sm}>
              <Pill icon="navigate" label="Navigate" active onPress={() => void openNavigation(cur)} />
              {(cur.titleLocal || cur.address) && (
                <Pill
                  icon="car"
                  label="Driver card"
                  color={colors.sky}
                  onPress={() => router.push({ pathname: '/trip/[id]/card', params: { id: trip.id, title: cur.title, local: cur.titleLocal ?? cur.address ?? '', sub: cur.address ?? '' } })}
                />
              )}
              <View style={{ flex: 1 }} />
              <Pill icon="list" label="List" onPress={() => setListOpen(true)} />
            </Row>
          </View>
        ) : (
          <View style={{ padding: space.lg, backgroundColor: colors.surface2, borderRadius: radius.lg }}>
            <Txt v="small" color={colors.textDim}>
              {mode.kind === 'near' ? (here ? 'Nothing from your plan within 6 km of you.' : 'Allow location to see what is around you.') : 'No mapped places for this filter yet.'}
            </Txt>
          </View>
        )}
      </View>

      <Sheet visible={listOpen} onClose={() => setListOpen(false)} title={mode.kind === 'day' ? `Day ${mode.index} route` : 'Places'}>
        {withDist.map((p, i) => {
          const c = categoryStyle[p.category];
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                setListOpen(false);
                select(i);
              }}>
              <Row style={{ paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.border }} gap={space.md}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
                  {p.n ? (
                    <Txt v="small" color={c.color} style={{ fontWeight: '900' }}>
                      {p.n}
                    </Txt>
                  ) : (
                    <Icon name={c.icon as IconName} size={16} color={c.color} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="body" style={{ fontWeight: '600' }} numberOfLines={2}>
                    {p.title}
                  </Txt>
                  <Txt v="small" color={colors.textDim} numberOfLines={1}>
                    {p.sub}
                    {p.km != null && p.km < 300 ? ` · ${fmtKm(p.km)}` : ''}
                  </Txt>
                </View>
                {i === selected && <Icon name="radio-button-on" size={16} color={colors.gold} />}
              </Row>
            </Pressable>
          );
        })}
      </Sheet>

      <Sheet visible={offlineOpen} onClose={() => setOfflineOpen(false)} title="Offline maps">
        <Txt v="small" color={colors.textDim} style={{ marginBottom: space.md }}>
          Download on Wi-Fi before you fly. Radar then works with no signal; your blue dot uses GPS, which needs no data. Navigate opens Google Maps — download those areas there too (Profile → Offline maps).
        </Txt>
        {trip.offlineRegions.length > 1 && !offline.done && <Pill icon="download" label="Download all regions" active onPress={() => void offline.downloadAll()} />}
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
