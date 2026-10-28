import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, Icon, Row, SectionTitle, StatusBadge, Txt, type IconName } from '@/components/ui';
import { call, useMe } from '@/lib/trip';
import { useTrip } from '@/store/trips';
import { colors, radius, space } from '@/theme';
import type { EmergencyContact } from '@/types/trip';

const KIND_ICON: Record<EmergencyContact['kind'], IconName> = {
  police: 'shield',
  ambulance: 'medkit',
  fire: 'flame',
  embassy: 'flag',
  hospital: 'medical',
  operator: 'briefcase',
  insurance: 'umbrella',
  other: 'call',
};

export default function Sos() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id)!;
  const me = useMe(trip);
  const big = trip.emergency.filter((e) => ['police', 'ambulance', 'fire'].includes(e.kind));
  const rest = trip.emergency.filter((e) => !big.includes(e));
  const help = trip.phrases.find((p) => p.group === 'help');
  const stay = trip.stays[0];

  return (
    <Screen title="Emergency" subtitle="Calls work without mobile data on any network">
      <Row>
        {big.map((e) => (
          <Pressable key={e.id} onPress={() => call(e.phone)} style={{ flex: 1, paddingVertical: space.xl, borderRadius: radius.lg, backgroundColor: colors.rose, alignItems: 'center' }}>
            <Icon name={KIND_ICON[e.kind]} color="#fff" size={26} />
            <Txt v="display" color="#fff">
              {e.phone}
            </Txt>
            <Txt v="small" color="#fff">
              {e.label}
            </Txt>
          </Pressable>
        ))}
      </Row>

      {help && (
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/trip/[id]/card',
              params: { id: trip.id, local: `${help.local}\n\n${stay ? stay.addressLocal ?? stay.address : ''}`, english: `${help.english}${me ? ` — ${me.name}` : ''}${stay ? ` · Staying at ${stay.name}` : ''}` },
            })
          }>
          <Card style={{ marginTop: space.lg, borderColor: colors.gold }}>
            <Row>
              <Icon name="hand-left" color={colors.gold} size={24} />
              <View style={{ flex: 1 }}>
                <Txt v="h3">“I am lost — please help me”</Txt>
                <Txt v="small" color={colors.textDim}>
                  Full-screen card in {trip.country === 'Vietnam' ? 'Vietnamese' : 'the local language'} with your hotel address
                </Txt>
              </View>
              <Icon name="chevron-forward" color={colors.textDim} />
            </Row>
          </Card>
        </Pressable>
      )}

      <SectionTitle title="Contacts" />
      {rest.map((e) => (
        <Pressable key={e.id} onPress={() => call(e.phone)}>
          <Row style={{ paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.border }} gap={space.md}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.roseSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={KIND_ICON[e.kind]} color={colors.rose} />
            </View>
            <View style={{ flex: 1 }}>
              <Row gap={6}>
                <Txt v="h3" style={{ flexShrink: 1 }}>
                  {e.label}
                </Txt>
                <StatusBadge status={e.status} />
              </Row>
              <Txt v="small" color={colors.textDim}>
                {e.phone}
                {e.note ? ` · ${e.note}` : ''}
              </Txt>
            </View>
            <Icon name="call" color={colors.emerald} />
          </Row>
        </Pressable>
      ))}

      <SectionTitle title="Family" />
      {trip.travelers.map((t) => (
        <Pressable key={t.id} onPress={() => t.phone && call(t.phone)}>
          <Row style={{ paddingVertical: space.sm }} gap={space.md}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.color }} />
            <Txt v="body" style={{ flex: 1 }}>
              {t.name}
            </Txt>
            <Txt v="small" color={t.phone?.includes('00000') ? colors.rose : colors.textDim}>
              {t.phone ?? '—'}
            </Txt>
          </Row>
        </Pressable>
      ))}
    </Screen>
  );
}
