import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { formatMoney } from '../utils/format';

// ---- Screen ----------------------------------------------------------------

export function Screen({
  children,
  scroll = false,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={[styles.screen, style]} edges={['top']}>
      <View style={styles.screenInner}>{children}</View>
    </SafeAreaView>
  );
}

// ---- Card ------------------------------------------------------------------

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ---- Button ----------------------------------------------------------------

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'danger'
        ? theme.colors.danger
        : variant === 'secondary'
          ? theme.colors.primarySoft
          : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? theme.colors.white : theme.colors.primary;
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        variant === 'ghost' && styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

// ---- Field -----------------------------------------------------------------

export function Field({
  label,
  error,
  ...inputProps
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={theme.colors.textSubtle}
        style={[styles.input, error ? styles.inputError : undefined]}
        {...inputProps}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

// ---- Badge -----------------------------------------------------------------

export function Badge({ label, color }: { label: string; color: { bg: string; fg: string } }) {
  return (
    <View style={[styles.badge, { backgroundColor: color.bg }]}>
      <Text style={[styles.badgeText, { color: color.fg }]}>{label}</Text>
    </View>
  );
}

// ---- Money -----------------------------------------------------------------

export function Money({ amountMinor, currency }: { amountMinor: number; currency?: string }) {
  return <Text style={styles.money}>{formatMoney(amountMinor, currency)}</Text>;
}

// ---- Section ---------------------------------------------------------------

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ---- EmptyState ------------------------------------------------------------

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

// ---- Row -------------------------------------------------------------------

export function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowValueBold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screenInner: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  button: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.xs,
  },
  buttonGhost: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: theme.text.body,
    fontWeight: '600',
  },
  field: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    marginBottom: theme.spacing.xs,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: theme.text.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.text.small,
    marginTop: theme.spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: theme.text.small,
    fontWeight: '600',
  },
  money: {
    fontSize: theme.text.heading,
    fontWeight: '700',
    color: theme.colors.text,
  },
  section: {
    marginTop: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.text.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: theme.colors.textSubtle,
    marginBottom: theme.spacing.sm,
  },
  empty: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.body,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLabel: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.body,
  },
  rowValue: {
    color: theme.colors.text,
    fontSize: theme.text.body,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: theme.spacing.lg,
  },
  rowValueBold: {
    fontWeight: '700',
  },
});