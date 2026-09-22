import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { get } from '../../api/client';
import { MaintenanceRequest } from '../../api/types';
import { useLoad } from '../../hooks';
import { Button, EmptyState, ErrorView, LoadingView, Screen, ScreenTitle, StatusBadge, Tag } from '../../components/ui';
import { formatDate, humanize, statusColor } from '../../utils/format';
import { theme } from '../../theme';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: theme.colors.success,
  MEDIUM: theme.colors.warning,
  HIGH: theme.colors.danger,
  URGENT: theme.colors.danger,
};

export default function MaintenanceScreen({
  route,
  navigation,
}: RootStackScreenProps<'Maintenance'>) {
  const { tenancyId } = route.params;
  const list = useLoad(
    async () => get<MaintenanceRequest[]>(`/maintenance/tenancy/${tenancyId}`),
    [tenancyId],
    { refreshOnFocus: true },
  );

  if (list.loading) return <LoadingView label="Loading maintenance…" />;
  if (list.error) return <ErrorView message={list.error} onRetry={list.reload} />;

  const items = list.data ?? [];

  return (
    <Screen scroll refreshing={list.loading} onRefresh={list.reload}>
      <View style={styles.head}>
        <View>
          <ScreenTitle title="Maintenance" />
          <Text style={styles.subtitle}>Keep a clear record of every reported issue.</Text>
        </View>
      </View>

      <Button
        label="Report Issue"
        icon="add"
        onPress={() => navigation.navigate('NewMaintenance', { tenancyId })}
        style={styles.reportButton}
      />

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <EmptyState
            icon="construct-outline"
            title="No maintenance requests"
            subtitle="Report a plumbing, electrical or other issue to keep a clear record."
          />
        </View>
      ) : (
        items.map((m) => {
          const priorityColor = PRIORITY_COLORS[m.priority] ?? theme.colors.textSubtle;
          return (
            <Pressable
              key={m.id}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
              onPress={() => navigation.navigate('MaintenanceDetail', { maintenanceId: m.id })}
            >
              <View style={styles.cardTop}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>{m.title}</Text>
                  <StatusBadge label={humanize(m.status)} />
                </View>
              </View>
              <View style={styles.metaRow}>
                <Tag label={m.category.replace(/_/g, ' ')} color={theme.colors.primary} />
                <Tag label={`${humanize(m.priority)} priority`} color={priorityColor} />
                <View style={styles.dateWrap}>
                  <Ionicons name="calendar-outline" size={14} color={theme.colors.textSubtle} />
                  <Text style={styles.dateText}>{formatDate(m.reported_at)}</Text>
                </View>
              </View>
              <Text style={styles.viewText}>View details</Text>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: theme.spacing.md },
  subtitle: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  reportButton: { marginBottom: theme.spacing.md },
  emptyCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.card,
  },
  cardTop: { marginBottom: theme.spacing.md },
  titleWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md },
  title: { fontSize: theme.text.cardTitle, fontWeight: '700', color: theme.colors.text, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  dateWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  dateText: { fontSize: theme.text.small, color: theme.colors.textSubtle },
  viewText: { color: theme.colors.primary, fontSize: theme.text.caption, fontWeight: '700', marginTop: theme.spacing.md },
});