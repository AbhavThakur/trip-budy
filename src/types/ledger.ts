import type { ExpenseCategory, ID } from './trip';

/**
 * Shared, row-level synced state. Every row has its own id + updatedAt so concurrent
 * offline edits from different phones merge instead of overwriting each other.
 * Deletes are soft (deleted = true) so they propagate.
 */
interface SyncedRow {
  id: ID;
  tripId: ID;
  updatedAt: string;
  updatedBy?: ID;
  deleted?: boolean;
}

export interface Expense extends SyncedRow {
  title: string;
  category: ExpenseCategory;
  /** integer amount in the currency's minor unit (VND: đồng, INR: paise) */
  amountMinor: number;
  currency: string;
  /** INR value of one unit of `currency`, frozen at the time of entry */
  inrPerUnit: number;
  paidBy: ID;
  /** traveler ids sharing this expense equally */
  splitWith: ID[];
  spentAt: string;
  note?: string;
  receiptPath?: string;
}

export interface Settlement extends SyncedRow {
  from: ID;
  to: ID;
  /** paise */
  amountInrMinor: number;
  settledAt: string;
}

export interface ChecklistMark extends SyncedRow {
  itemId: ID;
  /** '' for group items, traveler id for per-traveler items */
  travelerId: ID | '';
  done: boolean;
  /** Optional override fields used by "budget:<line id>" rows (planned & prepaid edits). */
  amountInr?: number;
  status?: 'paid' | 'due' | 'estimate' | 'placeholder';
  note?: string;
  label?: string;
  category?: string;
}

export interface DocFile extends SyncedRow {
  slotId?: ID;
  title: string;
  travelerIds: ID[];
  mime: string;
  size: number;
  /** object path in the private storage bucket once uploaded */
  remotePath?: string;
  /** id of the stored file; several slots can share one file (e.g. one PDF with all five visas) */
  fileId?: ID;
}

export type LedgerTable = 'expenses' | 'settlements' | 'checklist' | 'docs';

export interface OutboxItem {
  table: LedgerTable;
  id: ID;
  queuedAt: string;
}
