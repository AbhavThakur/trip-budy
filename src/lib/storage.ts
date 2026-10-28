import Storage from 'expo-sqlite/kv-store';
import { createJSONStorage } from 'zustand/middleware';

/** Synchronous SQLite-backed key/value storage: instant hydration, survives restarts, works offline. */
export const kvStorage = createJSONStorage(() => ({
  getItem: (k: string) => Storage.getItemSync(k),
  setItem: (k: string, v: string) => Storage.setItemSync(k, v),
  removeItem: (k: string) => {
    Storage.removeItemSync(k);
  },
}));

/** Async adapter for libraries that need an AsyncStorage-like interface (Supabase auth). */
export const asyncKv = {
  getItem: (k: string) => Storage.getItemAsync(k),
  setItem: (k: string, v: string) => Storage.setItemAsync(k, v),
  removeItem: async (k: string) => {
    await Storage.removeItemAsync(k);
  },
};

export const nowIso = () => new Date().toISOString();

export function uid(prefix = '') {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}${rnd}`;
}
