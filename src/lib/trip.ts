import { useMemo } from 'react';
import { Linking, Share } from 'react-native';

import { checklistKey, liveRows, useLedger } from '@/store/ledger';
import { useSession } from '@/store/session';
import type { ID, Stop, Traveler, Trip } from '@/types/trip';

import { localTime, shortDate, stopsForDay } from './time';

/** Current traveler on this phone (falls back to the trip lead, then the first traveler). */
export function useMe(trip?: Trip): Traveler | undefined {
  const meId = useSession((s) => (trip ? s.me[trip.id] : undefined));
  if (!trip) return undefined;
  return trip.travelers.find((t) => t.id === meId) ?? trip.travelers.find((t) => t.tags?.includes('lead')) ?? trip.travelers[0];
}

export const passKey = (tripId: ID, passId: ID) => checklistKey(tripId, `pass:${passId}`, '');

export const travelerName = (trip: Trip, id: ID) => trip.travelers.find((t) => t.id === id)?.shortName ?? id;

/** Readiness = required documents attached + checklist items ticked. */
export function useReadiness(trip?: Trip) {
  const checklist = useLedger((s) => s.checklist);
  const docs = useLedger((s) => s.docs);
  return useMemo(() => {
    if (!trip) return { pct: 0, done: 0, total: 0, docsDone: 0, docsTotal: 0, itemsDone: 0, itemsTotal: 0 };
    const travelerIds = trip.travelers.map((t) => t.id);
    let itemsTotal = 0;
    let itemsDone = 0;
    for (const sec of trip.checklist)
      for (const it of sec.items) {
        const keys = it.perTraveler ? travelerIds : [''];
        for (const tid of keys) {
          itemsTotal++;
          if (checklist[checklistKey(trip.id, it.id, tid)]?.done) itemsDone++;
        }
      }
    for (const p of trip.passes ?? []) {
      if (!p.bookAhead) continue;
      itemsTotal++;
      if (checklist[passKey(trip.id, p.id)]?.done) itemsDone++;
    }
    const files = liveRows(docs, trip.id);
    const required = trip.docSlots.filter((d) => d.required);
    const docsDone = required.filter((slot) => files.some((f) => f.slotId === slot.id)).length;
    const total = itemsTotal + required.length;
    const done = itemsDone + docsDone;
    return { pct: total ? done / total : 1, done, total, docsDone, docsTotal: required.length, itemsDone, itemsTotal };
  }, [trip, checklist, docs]);
}

export function openNavigation(s: { lat?: number; lng?: number; address?: string; title?: string }) {
  const dest = s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : encodeURIComponent(s.address ?? s.title ?? '');
  return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`);
}

export const call = (phone: string) => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);

export function shareDay(trip: Trip, dayIndex: number) {
  const day = trip.days.find((d) => d.index === dayIndex);
  if (!day) return;
  const lines = stopsForDay(trip, day).map((s: Stop) => {
    const map = s.lat != null ? `\n   📍 https://maps.google.com/?q=${s.lat},${s.lng}` : '';
    return `• ${localTime(s.start) || '—'}  ${s.title}${map}`;
  });
  const message = `${trip.flag} *${trip.title} — Day ${day.index}* (${shortDate(day.date)})\n_${day.title}_\n\n${lines.join('\n')}`;
  return Share.share({ message });
}
