import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

export type OtaState = 'idle' | 'checking' | 'downloading' | 'ready' | 'up-to-date' | 'error';

interface OtaStore {
  state: OtaState;
  /** true once the very first check after launch has finished (gate stays quiet until then if offline) */
  settled: boolean;
  set: (s: OtaState) => void;
}

export const useOtaStore = create<OtaStore>((set) => ({ state: 'idle', settled: false, set: (state) => set({ state, settled: true }) }));

const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

let inFlight: Promise<void> | null = null;

/**
 * Over-the-air updates (EAS Update). Every update is treated as REQUIRED: once downloaded the
 * app shows a blocking "Update required" screen (see UpdateGate) until the user installs it.
 */
export function checkForOta() {
  const { state, set } = useOtaStore.getState();
  if (__DEV__ || !Updates.isEnabled) return Promise.resolve(set('idle'));
  if (state === 'ready') return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      set('checking');
      const res = await withTimeout(Updates.checkForUpdateAsync(), 10_000);
      if (!res.isAvailable) return set('up-to-date');
      set('downloading');
      await withTimeout(Updates.fetchUpdateAsync(), 60_000);
      set('ready');
    } catch {
      set('error'); // offline / slow network: never trap the user behind an update we couldn't fetch
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Checks on launch and every time the app returns to the foreground. */
export function useOtaLifecycle() {
  useEffect(() => {
    void checkForOta();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void checkForOta());
    return () => sub.remove();
  }, []);
}

export function useOta() {
  const state = useOtaStore((s) => s.state);
  return { state, check: checkForOta, restart: () => Updates.reloadAsync() };
}

export function otaInfo() {
  return {
    enabled: Updates.isEnabled,
    channel: Updates.channel ?? 'none',
    runtime: Updates.runtimeVersion ?? '—',
    updateId: Updates.isEmbeddedLaunch ? 'built-in' : (Updates.updateId?.slice(0, 8) ?? '—'),
    createdAt: Updates.createdAt?.toISOString().slice(0, 16).replace('T', ' '),
  };
}
