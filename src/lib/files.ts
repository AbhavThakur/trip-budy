import { Directory, File, Paths } from 'expo-file-system';

import type { ID } from '@/types/trip';

const vaultDir = () => {
  const d = new Directory(Paths.document, 'vault');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
};

export function extFor(mime: string, fallback = 'bin') {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime.startsWith('image/')) return 'jpg';
  return fallback;
}

/** Local, offline copy of a vault document or receipt. */
export const localFile = (id: ID, mime: string) => new File(vaultDir(), `${id}.${extFor(mime)}`);

export const remotePathFor = (tripId: ID, id: ID, mime: string) => `${tripId}/${id}.${extFor(mime)}`;

/** Copies a picked file (content:// or cache) into the vault directory. */
export function importToVault(sourceUri: string, id: ID, mime: string) {
  const dest = localFile(id, mime);
  if (dest.exists) dest.delete();
  new File(sourceUri).copy(dest);
  return dest;
}

export const isImage = (mime: string) => mime.startsWith('image/');
