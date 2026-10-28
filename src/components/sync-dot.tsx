import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { cloudConfigured } from '@/lib/supabase';
import { useLedger } from '@/store/ledger';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

import { Row, Txt } from './ui';

const LABEL = { 'local-only': 'Not shared yet', offline: 'Offline', syncing: 'Syncing…', synced: 'Synced', error: 'Sync error' } as const;
const COLOR = { 'local-only': colors.textMute, offline: colors.gold, syncing: colors.sky, synced: colors.emerald, error: colors.rose } as const;

export function SyncDot() {
  const status = useSession((s) => s.sync.status);
  const pending = useLedger((s) => s.outbox.length);
  return (
    <Row gap={6} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR[status] }} />
      <Txt v="small" color={colors.textDim} style={{ fontSize: 11 }}>
        {!cloudConfigured && status === 'local-only' ? 'On this phone' : LABEL[status]}
        {pending > 0 && status !== 'local-only' ? ` · ${pending} pending` : ''}
      </Txt>
    </Row>
  );
}

const ago = (iso: string, now: number) => {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  return s < 8 ? 'just now' : s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 3600)} h ago`;
};

/** One quiet line for trip screens: "● Synced 12s ago · pull down to refresh". */
export function SyncLine() {
  const { status, lastSyncAt } = useSession((s) => s.sync);
  const pending = useLedger((s) => s.outbox.length);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  const text =
    status === 'synced' && lastSyncAt
      ? `Synced ${ago(lastSyncAt, now)}`
      : status === 'syncing'
        ? 'Syncing…'
        : status === 'offline'
          ? `Offline${pending ? ` · ${pending} change${pending > 1 ? 's' : ''} will sync later` : ' · showing saved data'}`
          : status === 'error'
            ? 'Sync problem — pull down to retry'
            : cloudConfigured
              ? 'Waiting for the trip leader to share this trip'
              : 'Saved on this phone';
  return (
    <Row gap={6}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLOR[status] }} />
      <Txt v="small" color={colors.textMute} style={{ fontSize: 11 }}>
        {text}
        {status !== 'local-only' ? ' · pull down to refresh' : ''}
      </Txt>
    </Row>
  );
}
