import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Icon, Pill, Row, SectionTitle, StatusBadge, Txt, type IconName } from '@/components/ui';
import { tap } from '@/lib/haptics';
import { shopKey, useMe, openNavigation } from '@/lib/trip';
import { useLedger } from '@/store/ledger';
import { useTrip } from '@/store/trips';
import { colors, space } from '@/theme';
import type { ShopCategory, ShopItem, ShopRule } from '@/types/trip';

const CATEGORIES: { key: ShopCategory; title: string; icon: IconName; color: string }[] = [
  { key: 'coffee', title: 'Coffee & brewing', icon: 'cafe', color: colors.gold },
  { key: 'food', title: 'Snacks & tea', icon: 'nutrition', color: colors.emerald },
  { key: 'clothing', title: 'Silk & tailoring', icon: 'shirt', color: colors.violet },
  { key: 'fashion', title: 'Shoes & bags', icon: 'footsteps', color: colors.violet },
  { key: 'decor', title: 'Home & handicrafts', icon: 'color-palette', color: colors.sky },
  { key: 'gifts', title: 'Gifts & keepsakes', icon: 'gift', color: colors.rose },
  { key: 'beauty', title: 'Beauty & care', icon: 'flower', color: colors.emerald },
  { key: 'electronics', title: 'Electronics', icon: 'hardware-chip', color: colors.sky },
];

const RULE_STYLE: Record<ShopRule['kind'], { icon: IconName; color: string; label: string }> = {
  avoid: { icon: 'ban', color: colors.rose, label: 'Avoid' },
  bargain: { icon: 'pricetag', color: colors.gold, label: 'Bargaining' },
  tip: { icon: 'bulb', color: colors.sky, label: 'Tip' },
};

export default function Shopping() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id)!;
  const me = useMe(trip);
  const marks = useLedger((s) => s.checklist);
  const put = useLedger((s) => s.put);
  const guide = trip.shopping;
  const [city, setCity] = useState('All');

  const cities = useMemo(() => ['All', ...new Set((guide?.items ?? []).flatMap((i) => i.spots.map((s) => s.city)).filter((c) => c !== 'Any'))], [guide]);
  // the checked-bag allowance on the flights home, from the data
  const homeKg = useMemo(() => {
    const last = trip.flights.filter((f) => f.depart.startsWith(trip.endDate));
    return last.length ? { kg: Math.min(...last.map((f) => f.checkinKg)), flight: last[last.length - 1].flightNo } : undefined;
  }, [trip]);

  if (!guide) {
    return (
      <Screen title="Shopping guide">
        <Txt color={colors.textDim}>No shopping guide for this trip yet.</Txt>
      </Screen>
    );
  }

  const picked = (i: ShopItem) => Boolean(marks[shopKey(trip.id, i.id)]?.done);
  const done = guide.items.filter(picked).length;
  const visible = (i: ShopItem) => city === 'All' || i.spots.some((s) => s.city === city || s.city === 'Any');

  return (
    <Screen title="Shopping guide" subtitle={`${guide.items.length} ideas · ${done} picked up`}>
      {guide.intro && (
        <Card style={{ backgroundColor: colors.surface2 }}>
          <Txt v="small" color={colors.textDim}>
            {guide.intro}
          </Txt>
          {homeKg && (
            <Row style={{ marginTop: space.md, alignItems: 'flex-start' }}>
              <Icon name="briefcase" size={18} color={colors.sky} />
              <Txt v="small" color={colors.sky} style={{ flex: 1 }}>
                Checked bag on {homeKg.flight} home: {homeKg.kg} kg each. Weigh your suitcase before you shop.
              </Txt>
            </Row>
          )}
        </Card>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, marginTop: space.lg }}>
        {cities.map((c) => (
          <Pill key={c} label={c === 'All' ? 'Everything' : c} active={city === c} onPress={() => setCity(c)} />
        ))}
      </ScrollView>

      {CATEGORIES.map((cat) => {
        const items = guide.items.filter((i) => i.category === cat.key && visible(i));
        if (!items.length) return null;
        return (
          <View key={cat.key}>
            <SectionTitle title={cat.title} />
            {items.map((i) => {
              const got = picked(i);
              const spots = i.spots.filter((s) => city === 'All' ? true : s.city === city || s.city === 'Any');
              return (
                <Card key={i.id} style={{ marginBottom: space.sm, borderColor: got ? colors.emerald : colors.border }}>
                  <Row style={{ alignItems: 'flex-start' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: got ? colors.emeraldSoft : colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={got ? 'checkmark' : cat.icon} color={got ? colors.emerald : cat.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Row gap={6}>
                        <Txt v="h3" style={{ flexShrink: 1 }}>
                          {i.title}
                        </Txt>
                        <StatusBadge status={i.status} />
                      </Row>
                      {i.titleLocal && (
                        <Txt v="small" color={colors.textDim}>
                          {i.titleLocal}
                        </Txt>
                      )}
                    </View>
                  </Row>
                  <Txt v="small" color={colors.textDim} style={{ marginTop: space.sm }}>
                    {i.why}
                  </Txt>
                  {i.price && (
                    <Txt v="small" color={colors.gold} style={{ marginTop: 4, fontWeight: '700' }}>
                      {i.price}
                    </Txt>
                  )}
                  {i.tip && (
                    <Row style={{ marginTop: space.sm, alignItems: 'flex-start' }} gap={6}>
                      <Icon name="bulb" size={14} color={colors.gold} />
                      <Txt v="small" style={{ flex: 1 }}>
                        {i.tip}
                      </Txt>
                    </Row>
                  )}

                  {spots.map((s, k) => (
                    <Row key={k} style={{ marginTop: space.sm, alignItems: 'flex-start' }} gap={6}>
                      <Icon name="location" size={14} color={colors.sky} />
                      <View style={{ flex: 1 }}>
                        <Txt v="small">
                          {s.city === 'Any' ? 'Any city' : s.city}
                          {s.dayIndex ? ` · Day ${s.dayIndex}` : ''}: {s.place}
                        </Txt>
                        {s.note && (
                          <Txt v="small" color={colors.textMute}>
                            {s.note}
                          </Txt>
                        )}
                      </View>
                      {s.city !== 'Any' && <Pill small icon="navigate" label="Map" onPress={() => openNavigation({ address: `${s.place.split(',')[0]}, ${s.city}, ${trip.country}` })} />}
                    </Row>
                  ))}

                  <Row style={{ marginTop: space.md, flexWrap: 'wrap' }}>
                    {i.veg && <Pill small icon="leaf" label="Veg-safe" color={colors.emerald} />}
                    {i.fragile && <Pill small icon="alert-circle" label="Fragile" color={colors.rose} />}
                    <Pill
                      small
                      active={got}
                      color={colors.emerald}
                      icon={got ? 'checkmark-circle' : 'ellipse-outline'}
                      label={got ? 'Picked up' : 'Mark picked up'}
                      onPress={() => {
                        tap();
                        put('checklist', { id: shopKey(trip.id, i.id), tripId: trip.id, itemId: `shop:${i.id}`, travelerId: '', done: !got, updatedBy: me?.id });
                      }}
                    />
                    {i.titleLocal && <Pill small icon="storefront" label="Show shopkeeper" color={colors.sky} onPress={() => router.push({ pathname: '/trip/[id]/card', params: { id: trip.id, local: i.titleLocal!, english: i.title } })} />}
                    <Pill small icon="wallet" label="Log spend" onPress={() => router.push({ pathname: '/trip/[id]/expense', params: { id: trip.id, title: i.title, cat: 'shopping' } })} />
                  </Row>
                </Card>
              );
            })}
          </View>
        );
      })}

      <SectionTitle title="Good to know" />
      {guide.rules.map((r) => {
        const st = RULE_STYLE[r.kind];
        return (
          <Card key={r.id} style={{ marginBottom: space.sm }}>
            <Row style={{ alignItems: 'flex-start' }} gap={space.md}>
              <Icon name={st.icon} size={20} color={st.color} />
              <View style={{ flex: 1 }}>
                <Txt v="tiny" color={st.color}>
                  {st.label}
                </Txt>
                <Txt v="h3">{r.title}</Txt>
                <Txt v="small" color={colors.textDim} style={{ marginTop: 2 }}>
                  {r.text}
                </Txt>
              </View>
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
