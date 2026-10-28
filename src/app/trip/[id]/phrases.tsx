import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SpeakButton, VoiceCheck } from '@/components/speech';
import { Card, Empty, Pill, Row, Txt } from '@/components/ui';
import { useTrip } from '@/store/trips';
import { colors, space } from '@/theme';
import type { PhraseGroup } from '@/types/trip';

const GROUPS: [PhraseGroup | 'all', string][] = [
  ['all', 'All'],
  ['diet', 'Pure veg'],
  ['taxi', 'Taxi'],
  ['market', 'Market'],
  ['help', 'Help'],
  ['courtesy', 'Basics'],
];

export default function Phrases() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTrip(id)!;
  const [group, setGroup] = useState<PhraseGroup | 'all'>('all');
  const list = trip.phrases.filter((p) => group === 'all' || p.group === group);

  return (
    <Screen title="Phrasebook" subtitle="Tap a card to show it full-screen">
      <VoiceCheck locale={trip.speechLocale} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, marginBottom: space.md }}>
        {GROUPS.map(([g, label]) => (
          <Pill key={g} label={label} active={group === g} onPress={() => setGroup(g)} />
        ))}
      </ScrollView>
      {list.length === 0 && <Empty icon="chatbubbles-outline" title="No phrases for this trip" />}
      {list.map((p) => (
        <Pressable key={p.id} onPress={() => router.push({ pathname: '/trip/[id]/card', params: { id: trip.id, local: p.local, english: p.english } })}>
          <Card style={{ marginBottom: space.sm }}>
            <Row style={{ alignItems: 'flex-start' }} gap={space.md}>
              <View style={{ flex: 1 }}>
                <Txt v="h3">{p.local}</Txt>
                {p.phonetic && (
                  <Txt v="small" color={colors.gold} style={{ marginTop: 2, fontStyle: 'italic' }}>
                    {p.phonetic}
                  </Txt>
                )}
                <Txt v="small" color={colors.textDim} style={{ marginTop: 4 }}>
                  {p.english}
                </Txt>
              </View>
              <SpeakButton text={p.local} locale={trip.speechLocale} size={40} />
            </Row>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
