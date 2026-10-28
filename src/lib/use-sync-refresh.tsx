import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';

import { success } from '@/lib/haptics';
import { syncNow } from '@/sync/engine';
import { colors } from '@/theme';

/** Pull-down-to-sync control for any ScrollView / FlatList: `<ScrollView refreshControl={useSyncRefresh()} />`. */
export function useSyncRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await syncNow();
      success();
    } finally {
      setRefreshing(false);
    }
  }, []);
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} colors={[colors.gold]} progressBackgroundColor={colors.surface2} />;
}
