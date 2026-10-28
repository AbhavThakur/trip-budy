import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { tap } from '@/lib/haptics';
import { useSession } from '@/store/session';
import { colors, font, radius, space } from '@/theme';
import type { DataStatus, Traveler } from '@/types/trip';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Variant = keyof typeof font;

/** Text that honours the "large text" preference (for senior travelers). */
export function Txt({ v = 'body', color = colors.text, style, ...rest }: TextProps & { v?: Variant; color?: string }) {
  const large = useSession((s) => s.largeText);
  const base = font[v] as TextStyle;
  const scaled = large && base.fontSize ? { fontSize: base.fontSize * 1.18, lineHeight: base.lineHeight ? base.lineHeight * 1.18 : undefined } : null;
  return <Text {...rest} style={[base, { color }, scaled, style]} />;
}

export function Card({ children, style, onPress, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: 'raised' | 'flat' }) {
  const body = [styles.card, tone === 'raised' && { backgroundColor: colors.surface2 }, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [body, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  );
}

export function Row({ children, gap = space.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Icon({ name, size = 18, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export function Pill({
  label,
  icon,
  active,
  color = colors.gold,
  onPress,
  small,
}: {
  label: string;
  icon?: IconName;
  active?: boolean;
  color?: string;
  onPress?: () => void;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={
        onPress &&
        (() => {
          tap();
          onPress();
        })
      }
      style={[
        styles.pill,
        small && { paddingVertical: 4, paddingHorizontal: 9 },
        active ? { backgroundColor: color, borderColor: color } : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
      {icon && <Icon name={icon} size={small ? 12 : 14} color={active ? colors.bg : color} />}
      <Txt v="small" color={active ? colors.bg : colors.text} style={small && { fontSize: 11 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Button({
  label,
  icon,
  onPress,
  kind = 'primary',
  disabled,
  style,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger' | 'success';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = { primary: colors.gold, ghost: colors.surface2, danger: colors.rose, success: colors.emerald }[kind];
  const fg = kind === 'ghost' ? colors.text : colors.bg;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }, style]}>
      {icon && <Icon name={icon} color={fg} size={18} />}
      <Txt v="h3" color={fg}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color = colors.text, bg = colors.surface2, size = 40, label, disabled }: { icon: IconName; onPress: () => void; color?: string; bg?: string; size?: number; label?: string; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
      <Icon name={icon} color={color} size={size * 0.48} />
    </Pressable>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm }}>
      <Txt v="tiny" color={colors.textDim}>
        {title}
      </Txt>
      {action && (
        <Pressable onPress={onAction} hitSlop={10}>
          <Txt v="small" color={colors.gold}>
            {action}
          </Txt>
        </Pressable>
      )}
    </Row>
  );
}

export function StatusBadge({ status }: { status: DataStatus }) {
  if (status === 'confirmed') return null;
  const c = status === 'placeholder' ? colors.rose : colors.gold;
  return (
    <View style={[styles.badge, { borderColor: c }]}>
      <Txt v="tiny" color={c} style={{ fontSize: 9 }}>
        {status === 'placeholder' ? 'Placeholder' : 'Verify'}
      </Txt>
    </View>
  );
}

export function Avatar({ t, size = 32, ring }: { t: Pick<Traveler, 'shortName' | 'color'>; size?: number; ring?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.color,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 0,
        borderColor: colors.bg,
      }}>
      <Text style={{ color: colors.bg, fontWeight: '800', fontSize: size * 0.42 }}>{t.shortName.slice(0, 1)}</Text>
    </View>
  );
}

export function AvatarStack({ travelers, size = 28, max = 6 }: { travelers: Traveler[]; size?: number; max?: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {travelers.slice(0, max).map((t, i) => (
        <View key={t.id} style={{ marginLeft: i ? -size * 0.3 : 0 }}>
          <Avatar t={t} size={size} ring />
        </View>
      ))}
    </View>
  );
}

export function Ring({ pct, size = 72, stroke = 7, color = colors.emerald, children }: { pct: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct)))}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function Empty({ icon, title, body }: { icon: IconName; title: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xxl, gap: space.sm }}>
      <Icon name={icon} size={36} color={colors.textMute} />
      <Txt v="h3">{title}</Txt>
      {body && (
        <Txt v="small" color={colors.textDim} style={{ textAlign: 'center' }}>
          {body}
        </Txt>
      )}
    </View>
  );
}

/** Lightweight bottom sheet (native Modal; no extra native dependency). */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grabber} />
        {title && (
          <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
            <Txt v="h2">{title}</Txt>
            <IconButton icon="close" onPress={onClose} size={34} />
          </Row>
        )}
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function KeyValue({ k, v, mono, onPress }: { k: string; v?: string; mono?: boolean; onPress?: () => void }) {
  if (!v) return null;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: space.md }}>
      <Txt v="small" color={colors.textDim}>
        {k}
      </Txt>
      <Txt v="small" style={[{ flexShrink: 1, textAlign: 'right' }, mono && font.mono]} color={onPress ? colors.gold : colors.text} selectable>
        {v}
      </Txt>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: 14,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
  },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    maxHeight: '88%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: space.md },
});
