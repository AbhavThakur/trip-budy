import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

import { IconButton, Row, Txt } from './ui';

export function ScreenHeader({ title, subtitle, right, back = true }: { title: string; subtitle?: string; right?: ReactNode; back?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Row style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md }}>
      {back && <IconButton icon="chevron-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} label="Back" />}
      <View style={{ flex: 1 }}>
        <Txt v="h2" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle && (
          <Txt v="small" color={colors.textDim} numberOfLines={1}>
            {subtitle}
          </Txt>
        )}
      </View>
      {right}
    </Row>
  );
}

export function Screen({
  title,
  subtitle,
  right,
  children,
  scroll = true,
  contentStyle,
  footer,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={title} subtitle={subtitle} right={right} />
      {scroll ? (
        <ScrollView contentContainerStyle={[{ padding: space.lg, paddingBottom: insets.bottom + 96 }, contentStyle]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
      {footer && <View style={{ padding: space.lg, paddingBottom: insets.bottom + space.lg, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.bg }}>{footer}</View>}
    </KeyboardAvoidingView>
  );
}
