import { createContext, useContext } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { tap } from '@/lib/haptics';
import { setMyTraveler } from '@/sync/engine';
import { useSession } from '@/store/session';
import { colors, radius, space } from '@/theme';
import type { Traveler, Trip } from '@/types/trip';

import { Avatar, Icon, Row, Sheet, Txt } from './ui';

export type JoinState = 'this-phone' | 'other-phone' | 'not-joined';

/** Which travelers have the app (from tb_trip_members) — drives "joined" badges everywhere. */
export function useJoinStates(trip: Trip): Record<string, JoinState> {
  const members = useSession((s) => s.members[trip.id]);
  const me = useSession((s) => s.me[trip.id]);
  const out: Record<string, JoinState> = {};
  for (const t of trip.travelers) {
    if (t.id === me) out[t.id] = 'this-phone';
    else if (members?.some((m) => m.travelerId === t.id && !m.isMe)) out[t.id] = 'other-phone';
    else out[t.id] = 'not-joined';
  }
  return out;
}

/** Top-right "who am I" chip; tap to switch. */
export function MeChip({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const meId = useSession((s) => s.me[trip.id]);
  const me = trip.travelers.find((t) => t.id === meId);
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityLabel="Switch traveler"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 4,
        paddingRight: 10,
        paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      {me ? <Avatar t={me} size={28} /> : <Icon name="person-circle-outline" size={28} color={colors.textDim} />}
      <Txt v="small" style={{ fontWeight: '700' }}>
        {me ? me.shortName : 'Who?'}
      </Txt>
      <Icon name="chevron-down" size={14} color={colors.textDim} />
    </Pressable>
  );
}

export function WhoAmISheet({ trip, visible, onClose }: { trip: Trip; visible: boolean; onClose: () => void }) {
  const states = useJoinStates(trip);
  const meId = useSession((s) => s.me[trip.id]);

  const choose = (t: Traveler) => {
    const apply = () => {
      tap();
      void setMyTraveler(trip.id, t.id);
      onClose();
    };
    if (states[t.id] === 'other-phone') {
      Alert.alert(`${t.shortName} is already on another phone`, 'Only continue if this is a new or second phone for them.', [
        { text: 'Cancel', style: 'cancel' },
        { text: `I'm ${t.shortName}`, onPress: apply },
      ]);
    } else apply();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Who's using this phone?">
      <Txt v="small" color={colors.textDim} style={{ marginBottom: space.md }}>
        Your documents, “I paid” and checklist ticks default to this person. Picked the wrong one? Just choose again — nothing is lost.
      </Txt>
      {trip.travelers.map((t) => {
        const st = states[t.id];
        const selected = t.id === meId;
        return (
          <Pressable
            key={t.id}
            onPress={() => choose(t)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              padding: space.md,
              marginBottom: space.sm,
              borderRadius: radius.lg,
              backgroundColor: selected ? colors.goldSoft : colors.surface,
              borderWidth: 1,
              borderColor: selected ? colors.gold : colors.border,
            }}>
            <Avatar t={t} size={40} />
            <View style={{ flex: 1 }}>
              <Txt v="h3">{t.name}</Txt>
              <Txt v="small" color={st === 'other-phone' ? colors.emerald : colors.textDim}>
                {st === 'this-phone' ? 'This phone' : st === 'other-phone' ? 'Joined on another phone' : (t.role ?? 'Not joined yet')}
              </Txt>
            </View>
            {selected && <Icon name="checkmark-circle" color={colors.gold} size={22} />}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

/** Joined avatars in full colour, not-yet-joined faded — used on trip cards and the family screen. */
export function JoinedStack({ trip, size = 28 }: { trip: Trip; size?: number }) {
  const states = useJoinStates(trip);
  return (
    <Row gap={0}>
      {trip.travelers.map((t, i) => (
        <View
          key={t.id}
          style={{
            marginLeft: i ? -size * 0.3 : 0,
            opacity: states[t.id] === 'not-joined' ? 0.35 : 1,
          }}>
          <Avatar t={t} size={size} ring />
        </View>
      ))}
    </Row>
  );
}

export const WhoAmIContext = createContext<() => void>(() => undefined);
export const useOpenWhoAmI = () => useContext(WhoAmIContext);
