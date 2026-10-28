import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { matchSlots } from '@/lib/docmatch';
import { importMany, type PickedFile } from '@/lib/vault';
import { colors, radius, space } from '@/theme';
import type { Trip } from '@/types/trip';

import { Button, Icon, Row, Sheet, Txt } from './ui';

/** Review screen for "Import many": each file gets a suggested slot (editable) before anything is saved. */
export function ImportSheet(props: { trip: Trip; files: PickedFile[]; taken: Set<string>; me?: string; onClose: () => void }) {
  // The form's state is built from the picked files, so give each new pick a fresh form.
  if (!props.files.length) return null;
  return <ImportForm key={props.files.map((f) => f.uri).join('|')} {...props} />;
}

function ImportForm({ trip, files, taken, me, onClose }: { trip: Trip; files: PickedFile[]; taken: Set<string>; me?: string; onClose: () => void }) {
  const initial = useMemo(() => files.map((f) => matchSlots(f.name, trip.docSlots, trip.travelers, taken)), [files, trip, taken]);
  const [choice, setChoice] = useState<string[][]>(() => initial.map((m) => m.slotIds));
  const [open, setOpen] = useState<number | null>(null);
  const matched = choice.filter((c) => c.length).length;

  const toggle = (fi: number, slotId: string) => setChoice((all) => all.map((c, i) => (i !== fi ? c : c.includes(slotId) ? c.filter((x) => x !== slotId) : [...c, slotId])));

  return (
    <Sheet visible onClose={onClose} title={`Import ${files.length} file${files.length > 1 ? 's' : ''}`}>
      <Txt v="small" color={colors.textDim} style={{ marginBottom: space.md }}>
        Matched {matched} of {files.length} by name. Tap a file to change where it goes — one file can cover several people.
      </Txt>
      {files.map((f, i) => {
        const slots = choice[i].map((id) => trip.docSlots.find((s) => s.id === id)).filter(Boolean);
        const expanded = open === i;
        return (
          <View key={`${f.name}-${i}`} style={{ marginBottom: space.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: slots.length ? colors.border : colors.gold }}>
            <Pressable onPress={() => setOpen(expanded ? null : i)} style={{ padding: space.md }}>
              <Row gap={space.sm}>
                <Icon name={f.mime === 'application/pdf' ? 'document' : 'image'} color={slots.length ? colors.emerald : colors.gold} size={18} />
                <View style={{ flex: 1 }}>
                  <Txt v="small" style={{ fontWeight: '700' }} numberOfLines={1}>
                    {f.name}
                  </Txt>
                  <Txt v="small" color={slots.length ? colors.emerald : colors.gold} style={{ fontSize: 12 }} numberOfLines={2}>
                    {slots.length === 0 ? 'Choose where it goes — or leave as an extra document' : slots.length === 1 ? `→ ${slots[0]!.title}` : `→ ${slots.length} documents (${slots.map((s) => s!.title.split('—').pop()?.trim()).join(', ')})`}
                  </Txt>
                </View>
                <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDim} />
              </Row>
            </Pressable>
            {expanded && (
              <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>
                {trip.docSlots
                  .filter((s) => !taken.has(s.id) || choice[i].includes(s.id))
                  .map((s) => {
                    const on = choice[i].includes(s.id);
                    return (
                      <Pressable key={s.id} onPress={() => toggle(i, s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 6 }}>
                        <Icon name={on ? 'checkbox' : 'square-outline'} size={18} color={on ? colors.emerald : colors.textDim} />
                        <Txt v="small" style={{ flex: 1 }} numberOfLines={1}>
                          {s.title}
                        </Txt>
                      </Pressable>
                    );
                  })}
              </View>
            )}
          </View>
        );
      })}
      <Button
        label={`Save ${files.length} file${files.length > 1 ? 's' : ''}`}
        icon="checkmark"
        onPress={() => {
          importMany(trip, files.map((file, i) => ({ file, slotIds: choice[i] })), me);
          onClose();
        }}
        style={{ marginTop: space.md }}
      />
    </Sheet>
  );
}
