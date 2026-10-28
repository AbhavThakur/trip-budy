import type { PoiCategory, StopCategory } from '@/types/trip';

export const colors = {
  bg: '#080C14',
  surface: '#111827',
  surface2: '#1E293B',
  border: '#1F2937',
  borderStrong: '#334155',
  text: '#F8FAFC',
  textDim: '#94A3B8',
  textMute: '#64748B',
  gold: '#F59E0B',
  goldSoft: 'rgba(245,158,11,0.14)',
  emerald: '#10B981',
  emeraldSoft: 'rgba(16,185,129,0.14)',
  rose: '#F43F5E',
  roseSoft: 'rgba(244,63,94,0.14)',
  sky: '#38BDF8',
  skySoft: 'rgba(56,189,248,0.14)',
  violet: '#A78BFA',
  violetSoft: 'rgba(167,139,250,0.14)',
  overlay: 'rgba(8,12,20,0.86)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const font = {
  /** large display numbers (countdowns, totals) */
  display: { fontSize: 34, lineHeight: 42, fontWeight: '800' as const, letterSpacing: -1 },
  h1: { fontSize: 26, lineHeight: 33, fontWeight: '800' as const, letterSpacing: -0.6 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  small: { fontSize: 13, fontWeight: '500' as const },
  tiny: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  mono: { fontFamily: 'monospace', fontVariant: ['tabular-nums' as const] },
};

type Cat = StopCategory | PoiCategory;

export const categoryStyle: Record<Cat, { color: string; soft: string; icon: string; label: string }> = {
  sight: { color: colors.gold, soft: colors.goldSoft, icon: 'camera', label: 'Sight' },
  activity: { color: colors.gold, soft: colors.goldSoft, icon: 'compass', label: 'Activity' },
  food: { color: colors.emerald, soft: colors.emeraldSoft, icon: 'leaf', label: 'Pure veg' },
  shopping: { color: colors.violet, soft: colors.violetSoft, icon: 'bag-handle', label: 'Shopping' },
  transit: { color: colors.textDim, soft: 'rgba(148,163,184,0.14)', icon: 'car', label: 'Transit' },
  flight: { color: colors.sky, soft: colors.skySoft, icon: 'airplane', label: 'Flight' },
  stay: { color: colors.sky, soft: colors.skySoft, icon: 'bed', label: 'Stay' },
  hospital: { color: colors.rose, soft: colors.roseSoft, icon: 'medkit', label: 'Hospital' },
};
