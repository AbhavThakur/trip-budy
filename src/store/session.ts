import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/storage';
import type { ReminderKind } from '@/lib/reminders';
import type { ID } from '@/types/trip';

export type SyncStatus = 'local-only' | 'offline' | 'syncing' | 'synced' | 'error';

export interface Member {
  travelerId: ID | null;
  joinedAt: string;
  role: 'owner' | 'member';
  isMe: boolean;
}

interface SessionState {
  /** which traveler is using this phone, per trip */
  me: Record<ID, ID>;
  /** trips shared through the cloud, with their join code */
  joinCodes: Record<ID, string>;
  /** server cursor (max server_updated_at seen) per trip */
  cursors: Record<ID, string>;
  fx: Record<string, { inrPerUnit: number; fetchedAt: string }>;
  /** trips the user removed from this phone (never re-added by auto-discovery) */
  hiddenTrips: ID[];
  /** trips shared by code only — they do not appear automatically on other family phones */
  codeOnly: Record<ID, boolean>;
  /** phones that joined each shared trip (refreshed on every sync) */
  members: Record<ID, Member[]>;
  largeText: boolean;
  vaultLock: boolean;
  reminders: { on: boolean; asked: boolean; kinds: Record<ReminderKind, boolean> };
  sync: { status: SyncStatus; lastSyncAt?: string; error?: string };
  setMe: (tripId: ID, travelerId: ID) => void;
  setJoinCode: (tripId: ID, code: string | undefined) => void;
  setCursor: (tripId: ID, at: string) => void;
  setFx: (code: string, inrPerUnit: number) => void;
  setSync: (s: Partial<SessionState['sync']>) => void;
  setMembers: (tripId: ID, members: Member[]) => void;
  hideTrip: (tripId: ID) => void;
  setCodeOnly: (tripId: ID, on: boolean) => void;
  setPref: (p: Partial<Pick<SessionState, 'largeText' | 'vaultLock'>>) => void;
  setReminders: (p: Partial<SessionState['reminders']>) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      me: {},
      joinCodes: {},
      cursors: {},
      fx: {},
      hiddenTrips: [],
      codeOnly: {},
      members: {},
      largeText: false,
      vaultLock: true,
      reminders: { on: true, asked: false, kinds: { flights: true, hotels: true, tickets: true, prep: true, daily: true } },
      sync: { status: 'local-only' },
      setMe: (tripId, travelerId) => set((s) => ({ me: { ...s.me, [tripId]: travelerId } })),
      setJoinCode: (tripId, code) =>
        set((s) => {
          const next = { ...s.joinCodes };
          if (code) next[tripId] = code;
          else delete next[tripId];
          return { joinCodes: next };
        }),
      setCursor: (tripId, at) => set((s) => ({ cursors: { ...s.cursors, [tripId]: at } })),
      setFx: (code, inrPerUnit) => set((s) => ({ fx: { ...s.fx, [code]: { inrPerUnit, fetchedAt: new Date().toISOString() } } })),
      setSync: (p) => set((s) => ({ sync: { ...s.sync, ...p } })),
      hideTrip: (tripId) => set((s) => ({ hiddenTrips: s.hiddenTrips.includes(tripId) ? s.hiddenTrips : [...s.hiddenTrips, tripId] })),
      setCodeOnly: (tripId, on) => set((s) => ({ codeOnly: { ...s.codeOnly, [tripId]: on } })),
      setMembers: (tripId, members) => set((s) => ({ members: { ...s.members, [tripId]: members } })),
      setPref: (p) => set(p),
      setReminders: (p) => set((s) => ({ reminders: { ...s.reminders, ...p } })),
    }),
    {
      name: 'tb.session.v1',
      storage: kvStorage,
      version: 1,
      // Deep-merge saved state over the defaults so a future update that adds a setting (e.g. a new reminder
      // category) never wipes the user's existing choices or leaves the new one undefined.
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<SessionState>;
        return {
          ...current,
          ...p,
          reminders: { ...current.reminders, ...p.reminders, kinds: { ...current.reminders.kinds, ...p.reminders?.kinds } },
          sync: current.sync,
        };
      },
      partialize: ({ sync: _sync, ...rest }) => rest,
    },
  ),
);
