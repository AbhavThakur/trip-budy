import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { bundledTrips } from '@/data';
import { kvStorage, nowIso } from '@/lib/storage';
import { mergeWithBundle, bundleHash } from '@/lib/trip-merge';
import { useSession } from '@/store/session';
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

/** Bundled trips keyed by their (variant-aware) id. */
export const bundledById = (): Record<ID, Trip> => Object.fromEntries(bundledTrips.map((t) => [variantTripId(t.id), { ...t, id: variantTripId(t.id) }]));

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
        const bundles = bundledById();
        const hidden = useSession.getState().hiddenTrips;
        for (const t of Object.values(bundles)) {
          if (hidden.includes(t.id)) continue;
          const cur = get().trips[t.id];
          const m = get().meta[t.id];
          const h = bundleHash(t);
          if (!cur || !m) get().setTrip(t, { source: 'bundle', bundleHash: h, version: 0, dirty: false });
          else if (m.bundleHash !== h) get().setTrip(mergeWithBundle(cur, t), { bundleHash: h });
        }
      },
    }),
    { name: 'tb.trips.v1', storage: kvStorage },
  ),
);

export const useTrip = (id: ID | undefined) => useTrips((s) => (id ? s.trips[id] : undefined));
