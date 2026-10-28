import type { IconName } from '@/components/ui';
import type { ExpenseCategory } from '@/types/trip';

import { colors } from './index';

export const CATEGORY_META: Record<ExpenseCategory, { label: string; icon: IconName; color: string }> = {
  flights: { label: 'Flights', icon: 'airplane', color: colors.sky },
  stays: { label: 'Stays', icon: 'bed', color: colors.violet },
  tours: { label: 'Tours', icon: 'ticket', color: colors.gold },
  transport: { label: 'Cabs', icon: 'car', color: colors.textDim },
  food: { label: 'Food', icon: 'restaurant', color: colors.emerald },
  shopping: { label: 'Shopping', icon: 'bag-handle', color: '#F472B6' },
  visa: { label: 'Visas', icon: 'document-text', color: '#FB923C' },
  other: { label: 'Other', icon: 'ellipsis-horizontal-circle', color: colors.textMute },
};
