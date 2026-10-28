import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { kvStorage, nowIso } from '@/lib/storage';
import type { ChecklistMark, DocFile, Expense, LedgerTable, OutboxItem, Settlement } from '@/types/ledger';
import type { ID } from '@/types/trip';

type RowOf<T extends LedgerTable> = T extends 'expenses'
  ? Expense
  : T extends 'settlements'
    ? Settlement
    : T extends 'checklist'
      ? ChecklistMark
      : DocFile;

type Tables = { [K in LedgerTable]: Record<ID, RowOf<K>> };

interface LedgerState extends Tables {
  outbox: OutboxItem[];
  /** local edit: stamps updatedAt and queues the row for upload */
  put: <T extends LedgerTable>(table: T, row: Omit<RowOf<T>, 'updatedAt'> & { updatedAt?: string }) => void;
  remove: (table: LedgerTable, id: ID) => void;
  /** remote rows: last-writer-wins on updatedAt, never re-queued */
  applyRemote: <T extends LedgerTable>(table: T, rows: RowOf<T>[]) => void;
  ack: (items: OutboxItem[]) => void;
  clearTrip: (tripId: ID) => void;
}

export const useLedger = create<LedgerState>()(
  persist(
    (set, get) => ({
      expenses: {},
      settlements: {},
      checklist: {},
      docs: {},
      outbox: [],
      put: (table, row) => {
        const stamped = { ...row, updatedAt: nowIso() } as RowOf<typeof table>;
        set((s) => ({
          [table]: { ...s[table], [row.id]: stamped },
          outbox: [...s.outbox.filter((o) => !(o.table === table && o.id === row.id)), { table, id: row.id, queuedAt: stamped.updatedAt }],
        }) as Partial<LedgerState>);
      },
      remove: (table, id) => {
        const row = get()[table][id];
        if (row) get().put(table, { ...row, deleted: true } as never);
      },
      applyRemote: (table, rows) => {
        if (!rows.length) return;
        set((s) => {
          const next = { ...s[table] } as Record<ID, RowOf<typeof table>>;
          for (const r of rows) {
            const cur = next[r.id];
            if (!cur || cur.updatedAt <= r.updatedAt) next[r.id] = r;
          }
          return { [table]: next } as Partial<LedgerState>;
        });
      },
      ack: (items) =>
        set((s) => ({
          outbox: s.outbox.filter((o) => !items.some((i) => i.table === o.table && i.id === o.id && i.queuedAt === o.queuedAt)),
        })),
      clearTrip: (tripId) =>
        set((s) => {
          const strip = <R extends { tripId: ID }>(rec: Record<ID, R>) =>
            Object.fromEntries(Object.entries(rec).filter(([, r]) => r.tripId !== tripId));
          return {
            expenses: strip(s.expenses),
            settlements: strip(s.settlements),
            checklist: strip(s.checklist),
            docs: strip(s.docs),
            outbox: s.outbox.filter((o) => (s[o.table][o.id] as { tripId?: ID } | undefined)?.tripId !== tripId),
          };
        }),
    }),
    { name: 'tb.ledger.v1', storage: kvStorage },
  ),
);

export const checklistKey = (tripId: ID, itemId: ID, travelerId: ID | '') => `${tripId}:${itemId}:${travelerId}`;

/** Selector helpers that drop deleted rows for a trip. */
export function liveRows<R extends { tripId: ID; deleted?: boolean }>(rec: Record<ID, R>, tripId: ID): R[] {
  return Object.values(rec).filter((r) => r.tripId === tripId && !r.deleted);
}
