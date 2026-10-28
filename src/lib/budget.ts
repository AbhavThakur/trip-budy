import type { ChecklistMark } from '../types/ledger';
import type { BudgetLine, ExpenseCategory, ID, Trip } from '../types/trip';

export type BudgetStatus = 'paid' | 'due' | 'estimate' | 'placeholder';

export interface BudgetView extends BudgetLine {
  custom?: boolean;
  /** this line differs from the one shipped with the app */
  edited?: boolean;
  markId: ID;
}

/**
 * Planned & prepaid lines ship with the trip document, but the family edits them (paid / due, amount, notes,
 * extra lines). Those edits are stored as synced rows (kind "checklist", itemId "budget:<line id>") so they merge
 * across phones and survive app updates — the shipped list is never rewritten.
 */
export const budgetItemId = (lineId: ID) => `budget:${lineId}`;
/** same format as checklistKey() in the ledger store (kept inline so this file has no app imports and can be unit-tested) */
export const budgetMarkId = (tripId: ID, lineId: ID) => `${tripId}:${budgetItemId(lineId)}:`;
export const newCustomLineId = () => `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function resolveBudget(trip: Trip, marks: Record<ID, ChecklistMark>): BudgetView[] {
  const live = (lineId: ID) => {
    const m = marks[budgetMarkId(trip.id, lineId)];
    return m && !m.deleted ? m : undefined;
  };
  const base = trip.budget.map<BudgetView>((l) => {
    const o = live(l.id);
    const edited = Boolean(o && (o.amountInr != null || o.status || o.note != null));
    return { ...l, amountInr: o?.amountInr ?? l.amountInr, status: (o?.status as BudgetStatus) ?? l.status, note: o?.note ?? l.note, edited, markId: budgetMarkId(trip.id, l.id) };
  });
  const prefix = budgetItemId('custom-');
  const customs = Object.values(marks)
    .filter((m) => m.tripId === trip.id && !m.deleted && m.itemId.startsWith(prefix))
    .map<BudgetView>((m) => ({
      id: m.itemId.slice('budget:'.length),
      category: (m.category as ExpenseCategory) ?? 'other',
      label: m.label ?? 'Item',
      amountInr: m.amountInr ?? 0,
      status: (m.status as BudgetStatus) ?? 'estimate',
      note: m.note,
      custom: true,
      markId: m.id,
    }));
  return [...base, ...customs];
}

export interface BudgetTotals {
  paid: number;
  due: number;
  estimate: number;
  total: number;
  /** lines that still have no amount */
  needsAmount: number;
}

export function budgetTotals(lines: BudgetView[]): BudgetTotals {
  const t: BudgetTotals = { paid: 0, due: 0, estimate: 0, total: 0, needsAmount: 0 };
  for (const l of lines) {
    if (l.status === 'placeholder' || (l.amountInr === 0 && l.status !== 'paid')) t.needsAmount++;
    const bucket = l.status === 'placeholder' ? 'estimate' : l.status;
    t[bucket] += l.amountInr;
    t.total += l.amountInr;
  }
  return t;
}
