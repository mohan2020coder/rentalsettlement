import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get } from '../../api/client';
import { MaintenanceRequest } from '../../api/types';
import { useLoad } from '../../hooks';
import { Badge, Button, Card, EmptyState, ErrorView, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { formatDate, humanize, statusColor } from '../../utils/format';
import { theme } from '../../theme';

export default function MaintenanceScreen({
  route,
  navigation,
}: RootStackScreenProps<'Maintenance'>) {
  const { tenancyId } = route.params;
  const list = useLoad(
    async () => get<MaintenanceRequest[]>(`/maintenance/tenancy/${tenancyId}`),
    [tenancyId],
  );

  if (list.loading) return <LoadingView label="Loading maintenance…" />;
  if (list.error) return <ErrorView message={list.error} onRetry={list.reload} />;

  const items = list.data ?? [];

  return (
    <Screen scroll refreshing={list.loading} onRefresh={list.reload}>
      <SectionHeader
        title="Maintenance"
        action={
          <Button
            label="+ Report"
            small
            onPress={() => navigation.navigate('NewMaintenance', { tenancyId })}
          />
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No maintenance requests"
          subtitle="Report a plumbing, electrical or other issue to keep a clear record."
        />
      ) : (
        items.map((m) => (
          <Card
            key={m.id}
            onPress={() => navigation.navigate('MaintenanceDetail', { maintenanceId: m.id })}
          >
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.title}>{m.title}</Text>
                <Text style={styles.sub}>
                  {m.category.replace(/_/g, ' ')} · {humanize(m.priority)} priority ·{' '}
                  {formatDate(m.reported_at)}
                </Text>
              </View>
              <Badge label={humanize(m.status)} color={statusColor(m.status)} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  info: { flex: 1, paddingRight: theme.spacing.md },
  title: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  sub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
});