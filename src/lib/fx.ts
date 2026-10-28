import { useEffect } from 'react';

import { useSession } from '@/store/session';
import type { Currency } from '@/types/trip';

const SIX_HOURS = 6 * 3600e3;

/** Live rate (open.er-api.com, no key) cached for offline use; falls back to the trip's bundled rate. */
export function useFx(currency: Currency) {
  const cached = useSession((s) => s.fx[currency.code]);
  const setFx = useSession((s) => s.setFx);

  useEffect(() => {
    if (currency.code === 'INR') return;
    if (cached && Date.now() - Date.parse(cached.fetchedAt) < SIX_HOURS) return;
    const ctrl = new AbortController();
    fetch('https://open.er-api.com/v6/latest/INR', { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j: { result?: string; rates?: Record<string, number> }) => {
        const perInr = j.rates?.[currency.code];
        if (j.result === 'success' && perInr) setFx(currency.code, 1 / perInr);
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [currency.code, cached, setFx]);

  return {
    inrPerUnit: cached?.inrPerUnit ?? currency.inrPerUnit,
    fetchedAt: cached?.fetchedAt,
    live: Boolean(cached),
  };
}
