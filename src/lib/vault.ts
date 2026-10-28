import * as DocumentPicker from 'expo-document-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { importToVault } from './files';
import { success } from './haptics';
import { uid } from './storage';
import { useLedger } from '@/store/ledger';
import { useSession } from '@/store/session';
import type { DocFile } from '@/types/ledger';
import type { DocSlot, ID, Trip } from '@/types/trip';

let unlockedThisSession = false;

/** Biometric / device-PIN gate for the document vault (skipped when the phone has no lock set up). */
export function useVaultLock() {
  const enabled = useSession((s) => s.vaultLock);
  const [unlocked, setUnlocked] = useState(!enabled || unlockedThisSession);
  const unlock = useCallback(async () => {
    const enrolled = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.getEnrolledLevelAsync()) > 0;
    if (!enrolled) {
      unlockedThisSession = true;
      setUnlocked(true);
      return;
    }
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock travel documents' });
    if (res.success) {
      unlockedThisSession = true;
      setUnlocked(true);
    }
  }, []);
  return { unlocked: unlocked || !enabled, unlock };
}

/** Pick a PDF/image, keep an offline copy, and register it (optionally against an expected slot). */
export async function attachDocument(trip: Trip, opts: { slot?: DocSlot; travelerIds?: ID[]; me?: ID }) {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return;
  const a = res.assets[0];
  const mime = a.mimeType ?? (a.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  const id = uid('doc-');
  importToVault(a.uri, id, mime);
  useLedger.getState().put('docs', {
    id,
    tripId: trip.id,
    slotId: opts.slot?.id,
    title: opts.slot?.title ?? a.name.replace(/\.[^.]+$/, ''),
    travelerIds: opts.slot?.travelerIds ?? opts.travelerIds ?? [],
    mime,
    size: a.size ?? 0,
    updatedBy: opts.me,
  });
  success();
  router.push({ pathname: '/trip/[id]/doc/[docId]', params: { id: trip.id, docId: id } });
}

/** Attach an already-stored file to another slot without copying or re-uploading it. */
export function linkDocToSlot(doc: DocFile, slot: DocSlot, me?: ID) {
  const existing = Object.values(useLedger.getState().docs).find((d) => !d.deleted && d.slotId === slot.id && (d.fileId ?? d.id) === (doc.fileId ?? doc.id));
  if (existing) {
    useLedger.getState().remove('docs', existing.id);
    return;
  }
  useLedger.getState().put('docs', {
    id: uid('doc-'),
    tripId: doc.tripId,
    slotId: slot.id,
    title: slot.title,
    travelerIds: slot.travelerIds,
    mime: doc.mime,
    size: doc.size,
    fileId: doc.fileId ?? doc.id,
    remotePath: doc.remotePath,
    updatedBy: me,
  });
  success();
}

export interface PickedFile {
  uri: string;
  name: string;
  mime: string;
  size: number;
}

export async function pickManyDocuments(): Promise<PickedFile[]> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: true });
  if (res.canceled) return [];
  return res.assets.map((a) => ({ uri: a.uri, name: a.name, size: a.size ?? 0, mime: a.mimeType ?? (a.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg') }));
}

/** Saves each picked file once (offline copy) and creates one document row per chosen slot. */
export function importMany(trip: Trip, items: { file: PickedFile; slotIds: ID[] }[], me?: ID) {
  let count = 0;
  for (const { file, slotIds } of items) {
    const fileId = uid('doc-');
    importToVault(file.uri, fileId, file.mime);
    const slots = slotIds.map((id) => trip.docSlots.find((s) => s.id === id)).filter((s): s is DocSlot => Boolean(s));
    const rows = slots.length ? slots : [undefined];
    rows.forEach((slot, i) => {
      useLedger.getState().put('docs', {
        id: i === 0 ? fileId : uid('doc-'),
        tripId: trip.id,
        slotId: slot?.id,
        title: slot?.title ?? file.name.replace(/\.[^.]+$/, ''),
        travelerIds: slot?.travelerIds ?? [],
        mime: file.mime,
        size: file.size,
        fileId,
        updatedBy: me,
      });
      count++;
    });
  }
  success();
  return count;
}
