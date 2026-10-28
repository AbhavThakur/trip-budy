import * as Haptics from 'expo-haptics';

export const tap = () => void Haptics.selectionAsync().catch(() => undefined);
export const thud = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
export const success = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
export const warn = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
