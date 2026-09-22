import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useLoad } from '../../hooks';
import { get, post } from '../../api/client';
import { Notification } from '../../api/types';
import { Button, EmptyState, ErrorView, LoadingView, Screen, ScreenTitle } from '../../components/ui';
import type { IoniconName } from '../../components/ui';
import { timeAgo } from '../../utils/format';
import { RootStackParamList } from '../../navigation/types';
import { theme } from '../../theme';

const TYPE_ICONS: Record<string, { icon: 'notifications-outline' | 'document-text-outline' | 'shield-checkmark-outline' | 'hand-left-outline' | 'calendar-outline' | 'briefcase-outline'; color: string }> = {
  SETTLEMENT_READY: { icon: 'document-text-outline', color: theme.colors.primary },
  SETTLEMENT_CONFIRMED: { icon: 'shield-checkmark-outline', color: theme.colors.success },
  TENANT_DISPUTE: { icon: 'hand-left-outline', color: theme.colors.warning },
  DISPUTE_RESOLVED: { icon: 'shield-checkmark-outline', color: theme.colors.success },
  INSPECTION_DUE: { icon: 'calendar-outline', color: theme.colors.warning },
  INVITATION: { icon: 'briefcase-outline', color: theme.colors.info },
};

function groupLabel(from: Date): string {
  const now = new Date();
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = dayStart(now);
  if (from.getTime() >= today) return 'Today';
  if (from.getTime() >= today - 86400000) return 'Yesterday';
  if (from.getTime() >= today - 6 * 86400000) return 'Earlier this week';
  return 'Older';
}

export default function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const notifications = useLoad(async () => get<Notification[]>('/notifications'), [], { refreshOnFocus: true });
  const unread = useLoad(
    async () => get<{ unread_count: number }>('/notifications/unread-count'),
    [],
    { refreshOnFocus: true },
  );

  const list = notifications.data ?? [];
  const unreadCount = unread.data?.unread_count ?? 0;

  const groups = useMemo(() => {
    const out: Record<string, Notification[]> = {};
    for (const n of list) {
      const label = groupLabel(new Date(n.created_at));
      (out[label] ??= []).push(n);
    }
    return out;
  }, [list]);

  if (notifications.loading) return <LoadingView label="Loading notifications…" />;
  if (notifications.error) {
    return <ErrorView message={notifications.error} onRetry={notifications.reload} />;
  }

  const markRead = async (id: string) => {
    try {
      await post(`/notifications/${id}/read`, {});
    } catch {
      // non-critical: refreshing below still reflects server state
    }
    notifications.reload();
    unread.reload();
  };

  const markAll = async () => {
    try {
      await post('/notifications/read-all', {});
    } catch (err) {
      // ignore background errors
      void err;
    }
    notifications.reload();
    unread.reload();
  };

  const open = async (n: Notification) => {
    if (!n.is_read) await markRead(n.id);
    if (n.entity_type === 'application') {
      navigation.navigate('Applications');
    } else if (n.entity_type === 'tenancy' && n.entity_id) {
      navigation.navigate('TenancyDetail', { tenancyId: n.entity_id });
    }
  };

  return (
    <Screen scroll refreshing={notifications.loading} onRefresh={notifications.reload}>
      <ScreenTitle title="Updates" />
      <Text style={styles.subtitle}>
        {unreadCount > 0
          ? `${unreadCount} unread · settlement, inspections and tenancy activity`
          : 'You are all caught up'}
      </Text>

      <View style={styles.actions}>
        {unreadCount > 0 ? (
          <Button label="Mark all read" variant="secondary" small icon="checkmark-done-outline" onPress={() => void markAll()} />
        ) : null}
      </View>

      {list.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="No notifications yet"
          subtitle="Updates about your tenancies will appear here."
        />
      ) : (
        Object.entries(groups).map(([label, items]) => (
          <View key={label}>
            <Text style={styles.groupLabel}>{label}</Text>
            {items.map((n) => {
              const meta: { icon: IoniconName; color: string } =
                TYPE_ICONS[n.type] ?? { icon: 'notifications-outline', color: theme.colors.info };
              return (
                <View key={n.id} style={[styles.card, !n.is_read && styles.unread]}>
                  {!n.is_read ? <View style={[styles.accent, { backgroundColor: meta.color }]} /> : null}
                  <View style={styles.row}>
                    <View style={[styles.icon, { backgroundColor: meta.color + '1A' }]}>
                      <Ionicons name={meta.icon} size={20} color={meta.color} />
                    </View>
                    <View style={styles.body}>
                      <View style={styles.titleRow}>
                        <Text style={styles.title}>{n.title}</Text>
                        {!n.is_read ? <View style={[styles.dot, { backgroundColor: meta.color }]} /> : null}
                      </View>
                      <Text style={styles.msg}>{n.body}</Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.meta}>{timeAgo(n.created_at)}</Text>
                        <View style={styles.typeChip}>
                          <Text style={[styles.typeText, { color: meta.color }]}>{n.type.replace(/_/g, ' ')}</Text>
                        </View>
                      </View>
                    </View>
                    {n.entity_type !== null && (
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.border} />
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2, marginBottom: theme.spacing.md },
  actions: { marginBottom: theme.spacing.md },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  unread: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
    backgroundColor: theme.colors.primarySoft,
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  groupLabel: {
    fontSize: theme.text.caption,
    fontWeight: '700',
    color: theme.colors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  body: { flex: 1, paddingRight: theme.spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  title: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text, flexShrink: 1 },
  msg: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2, lineHeight: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: 6 },
  meta: { color: theme.colors.textSubtle, fontSize: theme.text.small },
  typeChip: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  typeText: { fontSize: theme.text.small, fontWeight: '600', textTransform: 'capitalize' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
});