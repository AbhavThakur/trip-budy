import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export type OtaState = 'idle' | 'checking' | 'downloading' | 'ready' | 'up-to-date' | 'error';

/**
 * Over-the-air updates (EAS Update, channel "production").
 * Checks on launch (expo-updates ON_LOAD) and again whenever the app returns to the foreground;
 * a downloaded update is applied with a one-tap restart instead of interrupting the user.
 */
export async function checkForOta(set: (s: OtaState) => void) {
  if (__DEV__ || !Updates.isEnabled) return set('idle');
  try {
    set('checking');
    const res = await Updates.checkForUpdateAsync();
    if (!res.isAvailable) return set('up-to-date');
    set('downloading');
    await Updates.fetchUpdateAsync();
    set('ready');
  } catch {
    set('error');
  }
}

export function useOta() {
  const [state, setState] = useState<OtaState>('idle');
  useEffect(() => {
    void checkForOta(setState);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void checkForOta((n) => setState((prev) => (prev === 'ready' ? prev : n)));
    });
    return () => sub.remove();
  }, []);
  return { state, check: () => checkForOta(setState), restart: () => Updates.reloadAsync() };
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
