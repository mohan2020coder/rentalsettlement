import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLoad } from '../../hooks';
import { get, post } from '../../api/client';
import { Notification } from '../../api/types';
import { Button, Card, EmptyState, ErrorView, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { timeAgo } from '../../utils/format';
import { RootStackParamList } from '../../navigation/types';
import { theme } from '../../theme';

export default function NotificationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const notifications = useLoad(async () => get<Notification[]>('/notifications'), []);
  const unread = useLoad(
    async () => get<{ unread_count: number }>('/notifications/unread-count'),
    [],
  );

  if (notifications.loading) return <LoadingView label="Loading notifications…" />;
  if (notifications.error) {
    return <ErrorView message={notifications.error} onRetry={notifications.reload} />;
  }

  const list = notifications.data ?? [];

  const markRead = async (id: string) => {
    await post(`/notifications/${id}/read`, {});
    notifications.reload();
    unread.reload();
  };

  const markAll = async () => {
    await post('/notifications/read-all', {});
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
      <SectionHeader
        title="Notifications"
        action={
          (unread.data?.unread_count ?? 0) > 0 ? (
            <Button label="Mark all read" variant="secondary" small onPress={() => void markAll()} />
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <EmptyState title="No notifications yet" subtitle="Updates about your tenancies will appear here." />
      ) : (
        list.map((n) => (
          <Card key={n.id} onPress={() => void open(n)} style={n.is_read ? undefined : styles.unread}>
            <View style={styles.row}>
              {!n.is_read ? <View style={styles.dot} /> : null}
              <View style={styles.body}>
                <Text style={styles.title}>{n.title}</Text>
                <Text style={styles.msg}>{n.body}</Text>
                <Text style={styles.meta}>{timeAgo(n.created_at)} · {n.type.replace(/_/g, ' ')}</Text>
              </View>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    marginRight: theme.spacing.sm,
    marginTop: 6,
  },
  body: { flex: 1 },
  title: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  msg: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  meta: { color: theme.colors.textSubtle, fontSize: theme.text.small, marginTop: 4 },
  unread: { borderColor: theme.colors.primary, borderWidth: 1.5 },
});