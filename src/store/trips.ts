import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { bundledTrips } from '@/data';
import { kvStorage, nowIso } from '@/lib/storage';
import { variantTripId } from '@/lib/variant';
import type { ID, Traveler, Trip } from '@/types/trip';

export type TripSource = 'bundle' | 'cloud' | 'local';

export interface TripMeta {
  source: TripSource;
  /** server version for optimistic concurrency on tb_trips */
  version: number;
  updatedAt: string;
  /** a stringified copy of the bundled document used to detect app-update changes */
  bundleHash?: string;
  dirty?: boolean;
}

interface TripState {
  trips: Record<ID, Trip>;
  meta: Record<ID, TripMeta>;
  order: ID[];
  setTrip: (trip: Trip, meta: Partial<TripMeta>) => void;
  editTrip: (id: ID, fn: (t: Trip) => Trip) => void;
  setTravelers: (id: ID, travelers: Traveler[]) => void;
  removeTrip: (id: ID) => void;
  reseedFromBundle: () => void;
}

const hashOf = (t: Trip) => {
  const s = JSON.stringify(t);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
};

export const useTrips = create<TripState>()(
  persist(
    (set, get) => ({
      trips: {},
      meta: {},
      order: [],
      setTrip: (trip, meta) =>
        set((s) => ({
          trips: { ...s.trips, [trip.id]: trip },
          meta: { ...s.meta, [trip.id]: { ...{ source: 'local' as TripSource, version: 0 }, ...s.meta[trip.id], ...meta, updatedAt: nowIso() } },
          order: s.order.includes(trip.id) ? s.order : [...s.order, trip.id],
        })),
      editTrip: (id, fn) => {
        const t = get().trips[id];
        if (!t) return;
        set((s) => ({
          trips: { ...s.trips, [id]: fn(t) },
          meta: { ...s.meta, [id]: { ...s.meta[id], updatedAt: nowIso(), dirty: true } },
        }));
      },
      setTravelers: (id, travelers) => get().editTrip(id, (t) => ({ ...t, travelers })),
      removeTrip: (id) =>
        set((s) => {
          const { [id]: _t, ...trips } = s.trips;
          const { [id]: _m, ...meta } = s.meta;
          return { trips, meta, order: s.order.filter((x) => x !== id) };
        }),
      /**
       * Bundled trips refresh automatically after an app update, unless the trip
       * has been edited on-device or is managed from the cloud.
       */
      reseedFromBundle: () => {
        const s = get();
        for (const raw of bundledTrips) {
          const t = { ...raw, id: variantTripId(raw.id) };
          const m = s.meta[t.id];
          const h = hashOf(t);
          if (!m || (m.source === 'bundle' && !m.dirty && m.bundleHash !== h)) {
            get().setTrip(t, { source: m?.source ?? 'bundle', bundleHash: h, version: m?.version ?? 0, dirty: false });
          }
        }
      },
    }),
    { name: 'tb.trips.v1', storage: kvStorage },
  ),
);

export const useTrip = (id: ID | undefined) => useTrips((s) => (id ? s.trips[id] : undefined));
