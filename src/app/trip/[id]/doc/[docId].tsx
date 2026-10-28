import * as Brightness from 'expo-brightness';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Icon, IconButton, KeyValue, Row, Sheet, Txt } from '@/components/ui';
import { Zoomable } from '@/components/zoomable';
import { isImage, localFile } from '@/lib/files';
import { useMe } from '@/lib/trip';
import { linkDocToSlot } from '@/lib/vault';
import { syncNow } from '@/sync/engine';
import { useLedger } from '@/store/ledger';
import { useTrip } from '@/store/trips';
import { colors, space } from '@/theme';

export default function DocViewer() {
  useKeepAwake();
  const { id, docId } = useLocalSearchParams<{ id: string; docId: string }>();
  const trip = useTrip(id)!;
  const doc = useLedger((s) => s.docs[docId]);
  const allDocs = useLedger((s) => s.docs);
  const me = useMe(trip);
  const [linkOpen, setLinkOpen] = useState(false);
  const remove = useLedger((s) => s.remove);
  const insets = useSafeAreaInsets();
  const [boost, setBoost] = useState(true);
  const original = useRef<number | null>(null);

  // Scanner mode: max brightness while a ticket is on screen, restored on exit.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (original.current == null) original.current = await Brightness.getBrightnessAsync();
        if (alive) await Brightness.setBrightnessAsync(boost ? 1 : original.current);
      } catch {
        // brightness control unavailable — ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [boost]);
  useEffect(
    () => () => {
      if (original.current != null) void Brightness.setBrightnessAsync(original.current).catch(() => undefined);
    },
    [],
  );

  if (!doc) return null;
  const file = localFile(doc.fileId ?? doc.id, doc.mime);
  const present = file.exists;
  const slot = trip.docSlots.find((s) => s.id === doc.slotId);
  const names = doc.travelerIds.map((t) => trip.travelers.find((x) => x.id === t)?.shortName ?? t).join(', ');

  const openPdf = async () => {
    try {
      await File.preview(file, { mimeType: 'application/pdf', title: doc.title });
    } catch {
      await Sharing.shareAsync(file.uri, { mimeType: doc.mime, dialogTitle: doc.title });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: boost ? '#000' : colors.bg }}>
      <Row style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm, justifyContent: 'space-between', zIndex: 2 }}>
        <IconButton icon="close" onPress={() => router.back()} label="Close" />
        <View style={{ flex: 1, paddingHorizontal: space.md }}>
          <Txt v="h3" numberOfLines={1}>
            {doc.title}
          </Txt>
          {names ? (
            <Txt v="small" color={colors.textDim} numberOfLines={1}>
              {names}
            </Txt>
          ) : null}
        </View>
        <IconButton icon={boost ? 'sunny' : 'sunny-outline'} color={boost ? colors.bg : colors.text} bg={boost ? colors.gold : colors.surface2} onPress={() => setBoost((b) => !b)} label="Scanner brightness" />
      </Row>

      {!present ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md }}>
          <Icon name="cloud-download-outline" size={40} color={colors.textMute} />
          <Txt v="h3">Not on this phone yet</Txt>
          <Txt v="small" color={colors.textDim} style={{ textAlign: 'center' }}>
            It was added on another phone. Connect to the internet once and it downloads automatically for offline use.
          </Txt>
          <Button label="Sync now" icon="sync" onPress={() => void syncNow()} />
        </View>
      ) : isImage(doc.mime) ? (
        <Zoomable>
          <Image source={{ uri: file.uri }} style={{ flex: 1 }} contentFit="contain" />
        </Zoomable>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', padding: space.xl }}>
          <Card style={{ alignItems: 'center', gap: space.md }}>
            <Icon name="document-text" size={48} color={colors.gold} />
            <Txt v="h2" style={{ textAlign: 'center' }}>
              {doc.title}
            </Txt>
            {slot?.ref && (
              <Txt v="h3" color={colors.gold} selectable>
                {slot.ref}
              </Txt>
            )}
            <Txt v="small" color={colors.textDim}>
              PDF · {(doc.size / 1024).toFixed(0)} KB · saved offline
            </Txt>
            <Button label="Open PDF" icon="open-outline" onPress={openPdf} style={{ alignSelf: 'stretch' }} />
          </Card>
        </View>
      )}

      <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg, backgroundColor: colors.bg }}>
        {slot && <KeyValue k="Reference" v={slot.ref} mono />}
        {present && (
          <Button kind="ghost" label="This file also covers…" icon="link" onPress={() => setLinkOpen(true)} style={{ marginTop: space.sm }} />
        )}
        <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
          <Button kind="ghost" label="Share" icon="share-outline" onPress={() => present && Sharing.shareAsync(file.uri, { mimeType: doc.mime, dialogTitle: doc.title })} style={{ flex: 1 }} />
          <Button
            kind="ghost"
            label="Remove"
            icon="trash-outline"
            onPress={() =>
              Alert.alert('Remove document?', 'It will be removed from every phone in the trip.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => {
                    remove('docs', doc.id);
                    const fid = doc.fileId ?? doc.id;
                    const stillUsed = Object.values(allDocs).some((d) => d.id !== doc.id && !d.deleted && (d.fileId ?? d.id) === fid);
                    if (present && !stillUsed) file.delete();
                    router.back();
                  },
                },
              ])
            }
            style={{ flex: 1 }}
          />
        </Row>
      </View>
      <Sheet visible={linkOpen} onClose={() => setLinkOpen(false)} title="Link this file to">
        <Txt v="small" color={colors.textDim} style={{ marginBottom: space.md }}>
          One PDF with everyone’s visas or insurance? Tick every document it contains — no extra copies, no extra upload.
        </Txt>
        {trip.docSlots
          .filter((s) => s.id !== doc.slotId)
          .map((s) => {
            const linked = Object.values(allDocs).some((d) => !d.deleted && d.slotId === s.id && (d.fileId ?? d.id) === (doc.fileId ?? doc.id));
            const other = !linked && Object.values(allDocs).some((d) => !d.deleted && d.slotId === s.id);
            return (
              <Pressable key={s.id} onPress={() => linkDocToSlot(doc, s, me?.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
                <Icon name={linked ? 'checkbox' : 'square-outline'} color={linked ? colors.emerald : colors.textDim} />
                <Txt v="body" style={{ flex: 1 }}>
                  {s.title}
                </Txt>
                {other && (
                  <Txt v="small" color={colors.textMute}>
                    has a file
                  </Txt>
                )}
              </Pressable>
            );
          })}
      </Sheet>
    </View>
  );
}
