import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  keyboard?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
}

export function Screen({
  children,
  scroll,
  padded = true,
  keyboard = false,
  refreshing,
  onRefresh,
  contentStyle,
}: ScreenProps) {
  const inner = (
    <View style={[padded && styles.padded, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.grow}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.colors.primary}
                />
              ) : undefined
            }
          >
            {inner}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
              />
            ) : undefined
          }
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function ScreenNoPad({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={styles.safe}>{children}</SafeAreaView>;
}

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  const content = <View style={[styles.card, style]}>{children}</View>;
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  small?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  small,
}: ButtonProps) {
  const bg =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'danger'
        ? theme.colors.danger
        : variant === 'secondary'
          ? theme.colors.primarySoft
          : 'transparent';
  const fg =
    variant === 'primary' || variant === 'danger'
      ? theme.colors.white
      : variant === 'secondary'
        ? theme.colors.primaryDark
        : theme.colors.text;
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, borderColor: theme.colors.border },
        variant === 'ghost' && { borderWidth: 1 },
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && { opacity: 0.9 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[styles.buttonLabel, { color: fg }, small && styles.buttonLabelSmall]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...rest }: InputProps) {
  return (
    <View style={styles.inputWrap}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={theme.colors.textSubtle}
        style={[styles.input, error && styles.inputError, style]}
        {...rest}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Badge({ label, color }: { label: string; color?: string }) {
  const bg = color ?? theme.colors.primary;
  return (
    <View style={[styles.badge, { backgroundColor: `${bg}18` }]}>
      <Text style={[styles.badgeText, { color: bg }]}>{label}</Text>
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.loading}>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry ? <Button label="Retry" onPress={onRetry} variant="secondary" small /> : null}
    </View>
  );
}

interface RowProps {
  label: string;
  value?: React.ReactNode;
  subtle?: boolean;
}

export function Row({ label, value, subtle }: RowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueWrap}>
        {typeof value === 'string' ? (
          <Text style={[styles.rowValue, subtle && { color: theme.colors.textSubtle }]}>
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function ListItem({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Card style={styles.listItem} onPress={onPress}>
      <View style={styles.listItemBody}>
        <Text style={styles.listItemTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.listItemSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.listItemRight}>
        {right}
        {onPress ? <Text style={styles.chevron}>›</Text> : null}
      </View>
    </Card>
  );
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  padded: { padding: theme.spacing.lg },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  button: {
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  buttonSmall: {
    height: 36,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  buttonLabelSmall: { fontSize: 14 },
  inputWrap: { marginBottom: theme.spacing.md },
  inputLabel: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    marginBottom: theme.spacing.xs,
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.text.body,
    color: theme.colors.text,
  },
  inputError: { borderColor: theme.colors.danger },
  errorText: { color: theme.colors.danger, fontSize: theme.text.small, marginTop: 4 },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: theme.text.small, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.text.heading,
    fontWeight: '700',
    color: theme.colors.text,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl + 8,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.text.body,
    fontWeight: '600',
    color: theme.colors.textSubtle,
    marginBottom: theme.spacing.xs,
  },
  emptySubtitle: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    textAlign: 'center',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxl,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
  },
  errorTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.danger },
  errorMessage: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
    textAlign: 'center',
    marginVertical: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
  },
  rowLabel: { color: theme.colors.textSubtle, fontSize: theme.text.body },
  rowValueWrap: { flex: 1, alignItems: 'flex-end', paddingLeft: theme.spacing.md },
  rowValue: { color: theme.colors.text, fontSize: theme.text.body, fontWeight: '600', textAlign: 'right' },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.sm },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  listItemBody: { flex: 1, paddingRight: theme.spacing.md },
  listItemTitle: { fontSize: theme.text.body, fontWeight: '600', color: theme.colors.text },
  listItemSubtitle: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  listItemRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  chevron: { fontSize: 22, color: theme.colors.textSubtle },
  field: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    fontSize: theme.text.small,
    color: theme.colors.textSubtle,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  fieldValue: { fontSize: theme.text.body, color: theme.colors.text, fontWeight: '500' },
});