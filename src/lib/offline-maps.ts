import { OfflineManager } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useState } from 'react';

import type { OfflineRegion, Trip } from '@/types/trip';

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';

type RegionState = { pct: number; state: 'none' | 'active' | 'complete' | 'error' };

/**
 * Offline vector-tile packs (MapLibre). Each trip declares its regions; packs are tagged
 * with tripId/regionId metadata so they can be found again after an app restart.
 */
export function useOfflineRegions(trip: Trip) {
  const [states, setStates] = useState<Record<string, RegionState>>({});

  const readPacks = useCallback(async () => {
    const next: Record<string, RegionState> = {};
    try {
      const packs = await OfflineManager.getPacks();
      for (const p of packs) {
        if (p.metadata?.tripId !== trip.id) continue;
        const st = await p.status();
        next[String(p.metadata.regionId)] = { pct: st.percentage, state: st.state === 'complete' ? 'complete' : 'active' };
      }
    } catch {
      // native module unavailable (e.g. web) — treat as nothing downloaded
    }
    return next;
  }, [trip.id]);

  useEffect(() => {
    let alive = true;
    readPacks().then((next) => alive && setStates(next));
    return () => {
      alive = false;
    };
  }, [readPacks]);

  const download = useCallback(
    async (r: OfflineRegion) => {
      setStates((s) => ({ ...s, [r.id]: { pct: 0, state: 'active' } }));
      try {
        await OfflineManager.createPack(
          { mapStyle: MAP_STYLE, bounds: r.bounds, minZoom: 9, maxZoom: 15, metadata: { tripId: trip.id, regionId: r.id, name: r.name } },
          (_p, st) => setStates((s) => ({ ...s, [r.id]: { pct: st.percentage, state: st.state === 'complete' ? 'complete' : 'active' } })),
          () => setStates((s) => ({ ...s, [r.id]: { pct: 0, state: 'error' } })),
        );
      } catch {
        setStates((s) => ({ ...s, [r.id]: { pct: 0, state: 'error' } }));
      }
    },
    [trip.id],
  );

  const downloadAll = useCallback(async () => {
    for (const r of trip.offlineRegions) if (states[r.id]?.state !== 'complete') await download(r);
  }, [trip.offlineRegions, states, download]);

  const done = trip.offlineRegions.length > 0 && trip.offlineRegions.every((r) => states[r.id]?.state === 'complete');
  return { states, download, downloadAll, done };
}
