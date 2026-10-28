import type { Expense, Settlement } from '@/types/ledger';
import type { Currency, ID } from '@/types/trip';

export const INR: Currency = { code: 'INR', symbol: '₹', decimals: 2, inrPerUnit: 1 };

export const toMinor = (amount: number, c: Pick<Currency, 'decimals'>) => Math.round(amount * 10 ** c.decimals);
export const fromMinor = (minor: number, c: Pick<Currency, 'decimals'>) => minor / 10 ** c.decimals;

export function formatMoney(amount: number, c: Pick<Currency, 'symbol' | 'decimals' | 'code'>, opts: { compact?: boolean } = {}) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  if (opts.compact && abs >= 1e6) return `${sign}${c.symbol}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (opts.compact && abs >= 1e5 && c.code === 'INR') return `${sign}${c.symbol}${(abs / 1e5).toFixed(1)}L`;
  const digits = opts.compact ? 0 : Math.min(c.decimals, abs % 1 === 0 ? 0 : c.decimals);
  const locale = c.code === 'INR' ? 'en-IN' : 'en-US';
  return `${sign}${c.symbol}${abs.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export const inr = (amount: number, compact = false) => formatMoney(amount, INR, { compact });

/** paise value of an expense */
export const expenseInrMinor = (e: Expense, c: Pick<Currency, 'decimals'>) =>
  Math.round(fromMinor(e.amountMinor, c) * e.inrPerUnit * 100);

export interface Balance {
  travelerId: ID;
  paid: number;
  share: number;
  /** positive = should receive, negative = owes (paise) */
  net: number;
}

/**
 * Net balance per traveler in paise. Split remainders are assigned deterministically
 * (first travelers in the split absorb the extra paise) so every device computes the same result.
 */
export function balances(
  travelerIds: ID[],
  expenses: Expense[],
  settlements: Settlement[],
  decimalsFor: (code: string) => number,
): Balance[] {
  const map = new Map<ID, Balance>(travelerIds.map((id) => [id, { travelerId: id, paid: 0, share: 0, net: 0 }]));
  const get = (id: ID) => {
    if (!map.has(id)) map.set(id, { travelerId: id, paid: 0, share: 0, net: 0 });
    return map.get(id)!;
  };
  for (const e of expenses) {
    if (e.deleted || !e.splitWith.length) continue;
    const total = expenseInrMinor(e, { decimals: decimalsFor(e.currency) });
    get(e.paidBy).paid += total;
    const split = [...e.splitWith].sort();
    const base = Math.floor(total / split.length);
    let rem = total - base * split.length;
    for (const id of split) {
      get(id).share += base + (rem > 0 ? 1 : 0);
      rem--;
    }
  }
  for (const b of map.values()) b.net = b.paid - b.share;
  for (const s of settlements) {
    if (s.deleted) continue;
    get(s.from).net += s.amountInrMinor;
    get(s.to).net -= s.amountInrMinor;
  }
  return [...map.values()];
}

export interface Transfer {
  from: ID;
  to: ID;
  amount: number;
}

/** Greedy settle-up: largest debtor pays largest creditor. At most n-1 transfers. */
export function settleUp(bals: Balance[]): Transfer[] {
  const debtors = bals.filter((b) => b.net < -50).map((b) => ({ id: b.travelerId, amt: -b.net })).sort((a, b) => b.amt - a.amt);
  const creditors = bals.filter((b) => b.net > 50).map((b) => ({ id: b.travelerId, amt: b.net })).sort((a, b) => b.amt - a.amt);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount: amt });
    debtors[i].amt -= amt;
    creditors[j].amt -= amt;
    if (debtors[i].amt <= 50) i++;
    if (creditors[j].amt <= 50) j++;
  }
  return out;
}
