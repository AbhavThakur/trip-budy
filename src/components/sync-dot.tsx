import { View } from 'react-native';

import { useLedger } from '@/store/ledger';
import { cloudConfigured } from '@/lib/supabase';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

import { Row, Txt } from './ui';

const LABEL = { 'local-only': 'On this phone', offline: 'Offline', syncing: 'Syncing', synced: 'Synced', error: 'Sync error' } as const;
const COLOR = { 'local-only': colors.textMute, offline: colors.gold, syncing: colors.sky, synced: colors.emerald, error: colors.rose } as const;

export function SyncDot() {
  const status = useSession((s) => s.sync.status);
  const pending = useLedger((s) => s.outbox.length);
  return (
    <Row gap={6} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surface }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLOR[status] }} />
      <Txt v="small" color={colors.textDim} style={{ fontSize: 11 }}>
        {status === 'local-only' && cloudConfigured ? 'Not shared yet' : LABEL[status]}
        {pending > 0 && status !== 'local-only' ? ` · ${pending} pending` : ''}
      </Txt>
    </Row>
  );
}
