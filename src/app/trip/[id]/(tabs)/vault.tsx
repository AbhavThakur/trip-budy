import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Icon, IconButton, Pill, Row, SectionTitle, StatusBadge, Txt, type IconName } from '@/components/ui';
import { localDate, shortDate } from '@/lib/time';
import { call, openNavigation, useMe } from '@/lib/trip';
import { attachDocument, useVaultLock } from '@/lib/vault';
import { liveRows, useLedger } from '@/store/ledger';
import { useTripId } from '@/lib/trip-context';
import { useTrip } from '@/store/trips';
import { colors, radius, space } from '@/theme';
import type { DocKind } from '@/types/trip';

const DOC_ICON: Record<DocKind, IconName> = {
  passport: 'id-card',
  visa: 'document-text',
  flight: 'airplane',
  hotel: 'bed',
  activity: 'ticket',
  insurance: 'medkit',
  other: 'document',
};

export default function Vault() {
  const id = useTripId();
  const trip = useTrip(id)!;
  const insets = useSafeAreaInsets();
  const me = useMe(trip);
  const docsRec = useLedger((s) => s.docs);
  const files = useMemo(() => liveRows(docsRec, trip.id), [docsRec, trip.id]);
  const [view, setView] = useState<'mine' | 'group' | 'all'>('mine');
  const [who, setWho] = useState<string>('all');
  const lock = useVaultLock();

  const meId = me?.id ?? '';
  const personal = (ids: string[]) => ids.length === 1 && ids[0] === meId;
  const inView = (ids: string[]) =>
    view === 'mine' ? personal(ids) : view === 'group' ? ids.length !== 1 && (ids.length === 0 || ids.includes(meId)) : who === 'all' || ids.includes(who) || ids.length === 0;
  const slots = trip.docSlots.filter((s) => inView(s.travelerIds) && (!s.id.startsWith('pass-') || files.some((f) => f.slotId === s.id)));
  const extras = files.filter((f) => !f.slotId && inView(f.travelerIds));
  const sos = trip.emergency.filter((e) => ['police', 'ambulance', 'fire'].includes(e.kind));

  const actions: [string, IconName, string, () => void][] = [
    ['SOS', 'warning', colors.rose, () => router.push(`/trip/${trip.id}/sos`)],
    ['Phrases', 'chatbubbles', colors.emerald, () => router.push(`/trip/${trip.id}/phrases`)],
    ['Flights', 'airplane', colors.sky, () => router.push(`/trip/${trip.id}/flights`)],
    ['Stays', 'bed', colors.violet, () => router.push(`/trip/${trip.id}/stays`)],
    ['Day tickets', 'ticket', colors.gold, () => router.push(`/trip/${trip.id}/tickets`)],
    ['Checklist', 'checkbox', colors.textDim, () => router.push(`/trip/${trip.id}/readiness`)],
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.sm, paddingBottom: space.xxl }}>
      <Txt v="h1">Vault</Txt>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg }}>
        {actions.map(([label, icon, color, onPress]) => (
          <Pressable key={label} onPress={onPress} style={({ pressed }) => [{ width: '31.8%', paddingVertical: space.lg, borderRadius: radius.lg, alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: label === 'SOS' ? colors.rose : colors.border, opacity: pressed ? 0.8 : 1 }]}>
            <Icon name={icon} color={color} size={24} />
            <Txt v="small">{label}</Txt>
          </Pressable>
        ))}
      </View>

      <Row style={{ marginTop: space.md }}>
        {sos.map((e) => (
          <Pressable key={e.id} onPress={() => call(e.phone)} style={{ flex: 1, padding: space.md, borderRadius: radius.md, backgroundColor: colors.roseSoft, alignItems: 'center' }}>
            <Txt v="h2" color={colors.rose}>
              {e.phone}
            </Txt>
            <Txt v="small" color={colors.rose}>
              {e.label}
            </Txt>
          </Pressable>
        ))}
      </Row>

      <SectionTitle title="Basecamps" action="All" onAction={() => router.push(`/trip/${trip.id}/stays`)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
        {trip.stays.map((s) => (
          <Card key={s.id} style={{ width: 260 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="tiny" color={colors.sky}>
                {s.city} · {shortDate(localDate(s.checkIn))}
              </Txt>
              <StatusBadge status={s.status} />
            </Row>
            <Txt v="h3" style={{ marginTop: 4 }} numberOfLines={1}>
              {s.name}
            </Txt>
            <Txt v="small" color={colors.textDim} numberOfLines={2}>
              {s.address}
            </Txt>
            <Row style={{ marginTop: space.md }}>
              {s.phone && <IconButton icon="call" size={36} onPress={() => call(s.phone!)} label="Call" />}
              <IconButton icon="navigate" size={36} onPress={() => openNavigation(s)} label="Navigate" />
              <IconButton
                icon="car"
                size={36}
                color={colors.bg}
                bg={colors.gold}
                onPress={() => router.push({ pathname: '/trip/[id]/card', params: { id: trip.id, title: s.name, local: s.addressLocal ?? s.address, sub: s.address } })}
                label="Driver card"
              />
            </Row>
          </Card>
        ))}
      </ScrollView>

      <SectionTitle title="Documents" action="+ Add" onAction={() => lock.unlocked && attachDocument(trip, { travelerIds: view === 'mine' && me ? [me.id] : view === 'all' && who !== 'all' ? [who] : [], me: me?.id })} />
      {!lock.unlocked ? (
        <Card>
          <Row style={{ marginBottom: space.md }}>
            <Icon name="lock-closed" color={colors.gold} />
            <Txt v="small" color={colors.textDim} style={{ flex: 1 }}>
              Passports, visas and tickets are locked. Unlock with your fingerprint or phone PIN.
            </Txt>
          </Row>
          <Button label="Unlock vault" icon="finger-print" onPress={lock.unlock} />
        </Card>
      ) : (
        <>
          <Row style={{ marginBottom: space.md, backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4 }} gap={4}>
            {(
              [
                ['mine', `Mine${me ? ` · ${me.shortName}` : ''}`],
                ['group', 'Group'],
                ['all', 'Everyone'],
              ] as const
            ).map(([v, label]) => (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: 'center', backgroundColor: view === v ? colors.gold : 'transparent' }}>
                <Txt v="small" style={{ fontWeight: '700' }} color={view === v ? colors.bg : colors.textDim}>
                  {label}
                </Txt>
              </Pressable>
            ))}
          </Row>
          {view === 'mine' && (
            <Txt v="small" color={colors.textMute} style={{ marginBottom: space.sm }}>
              Your passport, visa and insurance. Group bookings are under Group.
            </Txt>
          )}
          {view === 'all' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, marginBottom: space.md }}>
              <Pill label="All" active={who === 'all'} onPress={() => setWho('all')} />
              {trip.travelers.map((t) => (
                <Pill key={t.id} label={t.shortName} color={t.color} active={who === t.id} onPress={() => setWho(t.id)} />
              ))}
            </ScrollView>
          )}
          {slots.map((slot) => {
            const attached = files.filter((f) => f.slotId === slot.id);
            const has = attached.length > 0;
            return (
              <Pressable
                key={slot.id}
                onPress={() =>
                  has ? router.push({ pathname: '/trip/[id]/doc/[docId]', params: { id: trip.id, docId: attached[0].id } }) : attachDocument(trip, { slot, me: me?.id })
                }>
                <Row style={{ paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.border }} gap={space.md}>
                  <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: has ? colors.emeraldSoft : colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={DOC_ICON[slot.kind]} color={has ? colors.emerald : colors.textMute} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="h3" numberOfLines={1}>
                      {slot.title}
                    </Txt>
                    <Txt v="small" color={slot.ref?.includes('PLACEHOLDER') ? colors.rose : colors.textDim} numberOfLines={1}>
                      {slot.ref ?? ''}
                      {attached.length > 1 ? ` · ${attached.length} files` : ''}
                    </Txt>
                    {slot.note && (
                      <Txt v="small" color={colors.textMute} style={{ fontSize: 11 }} numberOfLines={1}>
                        {slot.note}
                      </Txt>
                    )}
                  </View>
                  {has ? <Icon name="chevron-forward" color={colors.textDim} /> : <Pill small icon="attach" label="Attach" />}
                </Row>
              </Pressable>
            );
          })}
          {extras.map((f) => (
            <Pressable key={f.id} onPress={() => router.push({ pathname: '/trip/[id]/doc/[docId]', params: { id: trip.id, docId: f.id } })}>
              <Row style={{ paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.border }} gap={space.md}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: colors.emeraldSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={f.mime === 'application/pdf' ? 'document' : 'image'} color={colors.emerald} />
                </View>
                <Txt v="h3" style={{ flex: 1 }} numberOfLines={1}>
                  {f.title}
                </Txt>
                <Icon name="chevron-forward" color={colors.textDim} />
              </Row>
            </Pressable>
          ))}
          {slots.length === 0 && extras.length === 0 && (
            <Txt v="small" color={colors.textDim}>
              No documents for this traveler yet.
            </Txt>
          )}
        </>
      )}
    </ScrollView>
  );
}
