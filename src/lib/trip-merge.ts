import type { Trip } from '@/types/trip';

/**
 * The app bundle is the source of truth for trip CONTENT (itinerary, flights, stays, tickets, phrases…).
 * The cloud copy is the source of truth for what people edit in the app: the traveler list.
 *
 * Without this, a phone that links to the cloud adopts an older cloud copy and silently loses content
 * that arrived later through an app update (e.g. Day tickets).
 */
export function mergeWithBundle(remote: Trip, bundled?: Trip): Trip {
  if (!bundled) return remote;
  const seed = new Map(bundled.travelers.map((t) => [t.id, t]));
  const travelers = remote.travelers?.length ? remote.travelers.map((t) => ({ ...seed.get(t.id), ...t })) : bundled.travelers;
  return { ...bundled, travelers };
}

/** Cheap change-detector for the bundled document. */
export function bundleHash(t: Trip) {
  const s = JSON.stringify(t);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}
