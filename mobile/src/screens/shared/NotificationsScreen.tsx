import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

import { notificationsApi } from '../../api/endpoints';
import { Badge, EmptyState, Screen, Section } from '../../components';
import { useApi } from '../../hooks/useApi';
import { theme } from '../../theme';
import { AppNotification } from '../../types';
import { formatDateTime } from '../../utils/format';
import { statusColor, statusLabel } from '../../utils/status';

function NotificationRow({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.row, !item.is_read && styles.unread]}>
      <Badge label={statusLabel(item.type)} color={statusColor(item.type)} />
      <Text style={styles.title}>{item.title}</Text>
      {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
      <Text style={styles.date}>{formatDateTime(item.created_at)}</Text>
    </Pressable>
  );
}

export function NotificationsScreen() {
  const { data, loading, reload } = useApi<AppNotification[]>(() => notificationsApi.list(), []);

  const markAll = useCallback(async () => {
    await notificationsApi.markAllRead();
    reload();
  }, [reload]);

  const markOne = useCallback(
    async (id: string) => {
      await notificationsApi.markRead(id);
      reload();
    },
    [reload],
  );

  return (
    <Screen>
      <Section title="Notifications" />
      {!loading && (!data || data.length === 0) ? (
        <EmptyState message="No notifications yet." />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <NotificationRow item={item} onPress={() => markOne(item.id)} />}
          ListFooterComponent={
            <Pressable onPress={markAll} style={styles.footer}>
              <Text style={styles.footerText}>Mark all as read</Text>
            </Pressable>
          }
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  unread: {
    borderColor: theme.colors.primary,
  },
  title: {
    fontSize: theme.text.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
  body: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
  date: {
    fontSize: theme.text.small,
    color: theme.colors.textSubtle,
    marginTop: theme.spacing.xs,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  footerText: {
    color: theme.colors.primary,
    fontSize: theme.text.body,
    fontWeight: '600',
  },
});