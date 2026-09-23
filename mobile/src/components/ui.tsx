import React, { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  Image,
  ImageStyle,
  TextStyle,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { statusColor } from '../utils/format';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

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

export function ScreenContainer(props: ScreenProps) {
  return <Screen {...props} />;
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
        style={({ pressed }) => pressed && styles.cardPressed}
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
  icon?: IoniconName;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  small,
  icon,
}: ButtonProps) {
  const isSolid = variant === 'primary' || variant === 'danger';
  const bg =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'danger'
        ? theme.colors.danger
        : variant === 'secondary'
          ? theme.colors.primarySoft
          : 'transparent';
  const fg =
    isSolid
      ? theme.colors.white
      : variant === 'secondary'
        ? theme.colors.primaryDark
        : theme.colors.text;
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        !small && styles.buttonFull,
        small && styles.buttonSmall,
        { backgroundColor: bg },
        variant === 'secondary' && { borderWidth: 1.5, borderColor: theme.colors.primaryLight },
        variant === 'ghost' && { borderWidth: 1, borderColor: theme.colors.outline },
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={fg} /> : null}
          <Text
            style={[
              styles.buttonLabel,
              { color: fg },
              small && styles.buttonLabelSmall,
              icon ? { marginLeft: theme.spacing.xs } : null,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: IoniconName;
  accessory?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  icon,
  accessory,
  style,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.inputWrap, containerStyle]}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <View
        style={[
          styles.inputShell,
          focused && styles.inputShellFocused,
          error && styles.inputShellError,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? theme.colors.primary : theme.colors.textSubtle}
          />
        ) : null}
        <TextInput
          placeholderTextColor={theme.colors.textSubtle}
          style={[styles.input, icon ? styles.inputWithIcon : null, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {accessory ? <View style={styles.inputAccessory}>{accessory}</View> : null}
      </View>
      {error ? (
        <View style={styles.inputErrorRow}>
          <Ionicons name="alert-circle" size={13} color={theme.colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  style,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}) {
  return (
    <Input
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder ?? 'Search…'}
      icon="search"
      containerStyle={style}
    />
  );
}

interface BadgeProps {
  label: string;
  color?: string;
}

export function Badge({ label, color }: BadgeProps) {
  const bg = color ?? theme.colors.primary;
  return (
    <View style={[styles.badge, { backgroundColor: `${bg}1A` }]}>
      <View style={[styles.badgeDot, { backgroundColor: bg }]} />
      <Text style={[styles.badgeText, { color: bg }]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ label }: { label: string }) {
  return <Badge label={label} color={statusColor(label)} />;
}

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function SectionHeader({ title, action, style }: SectionHeaderProps) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionHeaderTitleRow}>
        <View style={styles.sectionHeaderAccent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function ScreenTitle({ title, style }: { title: string; style?: TextStyle }) {
  return <Text style={[styles.screenTitle, style]}>{title}</Text>;
}

export function EmptyState({
  title,
  subtitle,
  icon = 'file-tray-outline',
}: {
  title: string;
  subtitle?: string;
  icon?: IoniconName;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={30} color={theme.colors.primary} />
      </View>
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
      <View style={styles.errorIconWrap}>
        <Ionicons name="cloud-offline-outline" size={30} color={theme.colors.danger} />
      </View>
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
          <Text style={[styles.rowValue, subtle && { color: theme.colors.textSubtle, fontWeight: '500' }]}>
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

interface ListItemProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  icon?: IoniconName;
  iconColor?: string;
}

export function ListItem({ title, subtitle, right, onPress, icon, iconColor }: ListItemProps) {
  const accent = iconColor ?? theme.colors.primary;
  return (
    <Card style={styles.listItem} onPress={onPress}>
      {icon ? (
        <View style={[styles.listItemIcon, { backgroundColor: `${accent}14` }]}>
          <Ionicons name={icon} size={18} color={accent} />
        </View>
      ) : null}
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
        {onPress ? <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} /> : null}
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

export function Avatar({
  name,
  size = 44,
  color,
  uri,
}: {
  name: string;
  size?: number;
  color?: string;
  uri?: string | null;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const bg = color ?? theme.colors.primary;
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `${bg}1F` },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.avatarText, { color: bg, fontSize: size * 0.38 }]}>{initials || '?'}</Text>
      )}
    </View>
  );
}

export function AppHeader({
  name,
  role,
  right,
  uri,
}: {
  name: string;
  role?: string;
  right?: React.ReactNode;
  uri?: string | null;
}) {
  return (
    <View style={styles.appHeader}>
      <View style={styles.appHeaderLeft}>
        <View style={styles.appHeaderAvatarWrap}>
          <Avatar name={name} size={48} uri={uri} />
        </View>
        <View style={styles.appHeaderCopy}>
          <Text style={styles.appHeaderGreeting}>Hello,</Text>
          <Text style={styles.appHeaderTitle} numberOfLines={1}>
            {name}
          </Text>
          {role ? <Text style={styles.appHeaderSubtitle}>{role}</Text> : null}
        </View>
      </View>
      {right ? <View style={styles.appHeaderRight}>{right}</View> : null}
    </View>
  );
}

export function IconButton({
  name,
  onPress,
  badge,
  size = 22,
}: {
  name: IoniconName;
  onPress?: () => void;
  badge?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={name} size={size} color={theme.colors.text} />
      {badge ? <View style={styles.iconButtonDot} /> : null}
    </Pressable>
  );
}

export function StatCard({
  label,
  value,
  color = theme.colors.primary,
  icon,
}: {
  label: string;
  value: string | number;
  color?: string;
  icon: IoniconName;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function ActivityCard({
  icon,
  title,
  description,
  time,
  color = theme.colors.primary,
}: {
  icon: IoniconName;
  title: string;
  description?: string;
  time?: string;
  color?: string;
}) {
  return (
    <View style={styles.activityCard}>
      <View style={[styles.activityIcon, { backgroundColor: `${color}14` }]}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View style={styles.activityBody}>
        <Text style={styles.activityTitle} numberOfLines={1}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.activityDesc} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {time ? <Text style={styles.activityTime}>{time}</Text> : null}
    </View>
  );
}

export function TimelineItem({
  icon,
  title,
  meta,
  amount,
  color = theme.colors.primary,
  isLast = false,
}: {
  icon: IoniconName;
  title: string;
  meta?: string;
  amount?: string;
  color?: string;
  isLast?: boolean;
}) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineIcon, { backgroundColor: `${color}14` }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineBody}>
        <Text style={styles.timelineTitle}>{title}</Text>
        {meta ? <Text style={styles.timelineMeta}>{meta}</Text> : null}
        {amount ? <Text style={[styles.timelineAmount, { color }]}>{amount}</Text> : null}
      </View>
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              active && styles.segmentActive,
            ]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RoleCard({
  title,
  subtitle,
  icon,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: IoniconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        selected && styles.roleCardSelected,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
        <Ionicons
          name={icon}
          size={22}
          color={selected ? theme.colors.primary : theme.colors.textSubtle}
        />
      </View>
      <View style={styles.roleCopy}>
        <Text style={[styles.roleTitle, selected && { color: theme.colors.primaryDark }]}>
          {title}
        </Text>
        <Text style={styles.roleSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? theme.colors.primary : theme.colors.border}
      />
    </Pressable>
  );
}

export function Tag({
  label,
  color = theme.colors.primary,
}: {
  label: string;
  color?: string;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: `${color}14` }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

export function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        active && styles.pillActive,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function PropertyImagePlaceholder({
  name,
  height = 120,
  style,
}: {
  name?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.propertyPlaceholder, { height }, style]}>
      <View style={styles.propertyPlaceholderArt}>
        <View style={styles.buildingRoof} />
        <View style={styles.buildingBlock}>
          <View style={styles.buildingDoor} />
          <View style={styles.buildingWind} />
          <View style={styles.buildingWindA} />
        </View>
      </View>
      {name ? <Text style={styles.propertyPlaceholderText}>{name}</Text> : null}
    </View>
  );
}

export function PropertyImage({
  uri,
  name,
  height = 120,
  style,
}: {
  uri?: string | null;
  name?: string;
  height?: number;
  style?: StyleProp<ImageStyle>;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ height }, styles.propertyImage, style]}
        resizeMode="cover"
      />
    );
  }
  return <PropertyImagePlaceholder name={name} height={height} style={style} />;
}

interface LightboxProps {
  visible: boolean;
  uris: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function Lightbox({ visible, uris, initialIndex = 0, onClose }: LightboxProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) setIndex(Math.min(initialIndex, Math.max(uris.length - 1, 0)));
  }, [visible, initialIndex, uris.length]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.lightbox}>
        <View style={styles.lightboxTop}>
          {uris.length > 1 ? (
            <Text style={styles.lightboxCount}>
              {Math.min(index + 1, uris.length)} / {uris.length}
            </Text>
          ) : (
            <View />
          )}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.lightboxClose, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>
        {uris.length === 0 ? null : (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / width);
              setIndex(Math.max(0, Math.min(i, uris.length - 1)));
            }}
          >
            {uris.map((u, i) => (
              <Image
                key={`${u}-${i}`}
                source={{ uri: u }}
                style={{ width, height: '100%' }}
                resizeMode="contain"
              />
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

interface PhotoStripProps {
  uris: string[];
  cover?: string | null;
  size?: number;
}

export function PhotoStrip({ uris, cover, size = 64 }: PhotoStripProps) {
  const list = uris.length ? uris : cover ? [cover] : [];
  if (list.length === 0) return null;
  const shown = list.slice(0, 3);
  const extra = list.length - shown.length;
  return (
    <View style={styles.photoStripRow}>
      {shown.map((u, i) => (
        <View key={`${u}-${i}`} style={[styles.photoStripThumb, { width: size, height: size }]}>
          <Image source={{ uri: u }} style={{ width: size, height: size }} resizeMode="cover" />
          {i === 0 && list.length > 1 ? (
            <View style={[styles.photoStripZag, { position: 'absolute', right: 6, bottom: 6 }]}>
              <Ionicons name="images-outline" size={12} color={theme.colors.white} />
            </View>
          ) : null}
        </View>
      ))}
      {extra > 0 ? (
        <View style={[styles.photoStripExtra, { width: size, height: size }]}>
          <Text style={styles.photoStripExtraText}>+{extra}</Text>
        </View>
      ) : null}
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
  padded: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  cardPressed: { opacity: 0.9 },
  button: {
    height: 52,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  buttonFull: { minHeight: 52 },
  buttonSmall: {
    height: 40,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  buttonContent: { flexDirection: 'row', alignItems: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  buttonLabelSmall: { fontSize: 14 },
  inputWrap: { marginBottom: theme.spacing.md },
  inputLabel: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    marginBottom: 6,
    fontWeight: '600',
  },
  inputShell: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputShellFocused: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
    backgroundColor: theme.colors.primarySoft,
  },
  inputShellError: { borderColor: theme.colors.danger },
  input: {
    flex: 1,
    height: 50,
    fontSize: theme.text.body,
    color: theme.colors.text,
    paddingVertical: 0,
  },
  inputWithIcon: { marginLeft: 10 },
  inputAccessory: { marginLeft: theme.spacing.xs },
  inputErrorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 4 },
  errorText: { color: theme.colors.danger, fontSize: theme.text.small, marginTop: 0 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: theme.text.small, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  sectionHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  sectionHeaderAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginRight: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.text.heading,
    fontWeight: '700',
    color: theme.colors.text,
  },
  screenTitle: {
    fontSize: theme.text.screenTitle,
    fontWeight: '800',
    color: theme.colors.text,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl + 12,
    paddingHorizontal: theme.spacing.xl,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.text.body,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  emptySubtitle: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxl,
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
  },
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  errorTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.danger },
  errorMessage: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
    textAlign: 'center',
    marginVertical: theme.spacing.md,
    lineHeight: 19,
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
  listItemIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  listItemBody: { flex: 1, paddingRight: theme.spacing.md },
  listItemTitle: { fontSize: theme.text.body, fontWeight: '600', color: theme.colors.text },
  listItemSubtitle: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  listItemRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  field: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.outline,
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
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '800' },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.navy,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.card,
  },
  appHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: theme.spacing.md },
  appHeaderAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appHeaderCopy: { marginLeft: theme.spacing.md, flex: 1 },
  appHeaderGreeting: {
    fontSize: theme.text.caption,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '500',
  },
  appHeaderTitle: {
    fontSize: theme.text.heading,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  appHeaderSubtitle: {
    fontSize: theme.text.caption,
    color: 'rgba(255,255,255,0.8)',
  },
  appHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.danger,
    borderWidth: 1.5,
    borderColor: theme.colors.white,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    marginTop: 2,
    fontWeight: '500',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.card,
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  activityBody: { flex: 1, paddingRight: theme.spacing.sm },
  activityTitle: { fontSize: theme.text.body, fontWeight: '600', color: theme.colors.text },
  activityDesc: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  activityTime: { fontSize: theme.text.small, color: theme.colors.textSubtle },
  timelineItem: { flexDirection: 'row' },
  timelineRail: { alignItems: 'center', marginRight: theme.spacing.md },
  timelineIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: { width: 2, flex: 1, backgroundColor: theme.colors.border, minHeight: 18, marginVertical: 4 },
  timelineBody: { flex: 1, paddingBottom: theme.spacing.lg },
  timelineTitle: { fontSize: theme.text.body, fontWeight: '600', color: theme.colors.text },
  timelineMeta: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  timelineAmount: { fontSize: theme.text.body, fontWeight: '700', marginTop: 4 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    marginBottom: theme.spacing.md,
  },
  segment: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: theme.colors.surface,
    shadowColor: '#172033',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  segmentText: {
    fontSize: theme.text.caption,
    fontWeight: '600',
    color: theme.colors.textSubtle,
  },
  segmentTextActive: { color: theme.colors.primary, fontWeight: '700' },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  roleCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  roleIconSelected: { backgroundColor: theme.colors.surface },
  roleCopy: { flex: 1, paddingRight: theme.spacing.md },
  roleTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  roleSubtitle: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
  },
  tagText: { fontSize: theme.text.small, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pillText: { fontSize: theme.text.caption, fontWeight: '600', color: theme.colors.textSubtle },
  pillTextActive: { color: theme.colors.white },
  propertyImage: { borderRadius: theme.radius.md },
  lightbox: { flex: 1, backgroundColor: 'rgba(5,8,20,0.96)' },
  lightboxTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingHorizontal: 18,
  },
  lightboxCount: { color: 'rgba(255,255,255,0.85)', fontSize: theme.text.caption, fontWeight: '700' },
  lightboxClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoStripRow: { flexDirection: 'row', gap: theme.spacing.sm },
  photoStripThumb: {
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.primaryLight,
  },
  photoStripZag: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(11,87,208,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoStripExtra: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoStripExtraText: { color: theme.colors.textSubtle, fontSize: theme.text.body, fontWeight: '800' },
  propertyPlaceholder: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyPlaceholderText: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    color: theme.colors.primaryDark,
    fontSize: theme.text.small,
    fontWeight: '600',
    opacity: 0.6,
  },
  propertyPlaceholderArt: { flexDirection: 'row', alignItems: 'flex-end', opacity: 0.35 },
  buildingRoof: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 46,
    borderRightWidth: 46,
    borderTopWidth: 0,
    borderBottomWidth: 26,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: theme.colors.primaryDark,
  },
  buildingBlock: {
    width: 90,
    height: 54,
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
    marginTop: -2,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
  },
  buildingDoor: {
    position: 'absolute',
    bottom: 0,
    left: 22,
    width: 16,
    height: 24,
    backgroundColor: theme.colors.primaryDark,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  buildingWind: {
    position: 'absolute',
    top: 8,
    right: 12,
    width: 18,
    height: 14,
    borderRadius: 3,
    backgroundColor: theme.colors.primaryDark,
  },
  buildingWindA: {
    position: 'absolute',
    top: 28,
    right: 12,
    width: 18,
    height: 14,
    borderRadius: 3,
    backgroundColor: theme.colors.primaryDark,
  },
});