import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get } from '../../api/client';
import { InspectionSummary } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button, EmptyState, ErrorView, ListItem, LoadingView, Screen, ScreenTitle, StatusBadge } from '../../components/ui';
import { formatDate, humanize } from '../../utils/format';
import { theme } from '../../theme';

export default function InspectionsScreen({
  route,
  navigation,
}: RootStackScreenProps<'Inspections'>) {
  const { tenancyId } = route.params;
  const { user } = useAuth();
  const isLandlord = user?.role === 'LANDLORD';

  const list = useLoad(
    async () => get<InspectionSummary[]>(`/inspections/tenancy/${tenancyId}`),
    [tenancyId],
    { refreshOnFocus: true },
  );

  if (list.loading) return <LoadingView label="Loading inspections…" />;
  if (list.error) return <ErrorView message={list.error} onRetry={list.reload} />;

  const items = list.data ?? [];

  return (
    <Screen scroll refreshing={list.loading} onRefresh={list.reload}>
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <ScreenTitle title="Inspections" />
          <Text style={styles.subtitle}>Condition reports for this tenancy.</Text>
        </View>
        <View style={styles.actions}>
          <Button
            label="Move-out"
            small
            onPress={() => navigation.navigate('NewInspection', { tenancyId, kind: 'MOVE_OUT' })}
            icon="log-out-outline"
          />
          {isLandlord && (
            <Button
              label="Move-in"
              small
              variant="secondary"
              onPress={() => navigation.navigate('NewInspection', { tenancyId, kind: 'MOVE_IN' })}
              icon="log-in-outline"
            />
          )}
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <EmptyState
            icon="camera-outline"
            title="No inspections yet"
            subtitle="Create a move-in inspection when a tenancy starts and a move-out inspection when it ends."
          />
        </View>
      ) : (
        items.map((i) => (
          <ListItem
            key={i.id}
            icon={i.kind === 'MOVE_IN' ? 'log-in-outline' : 'log-out-outline'}
            iconColor={i.kind === 'MOVE_IN' ? theme.colors.success : theme.colors.warning}
            title={i.kind === 'MOVE_IN' ? 'Move-in inspection' : 'Move-out inspection'}
            subtitle={`${formatDate(i.created_at)}${i.conducted_by ? ' · jointly conducted' : ''}`}
            right={<StatusBadge label={humanize(i.status)} />}
            onPress={() => navigation.navigate('InspectionDetail', { inspectionId: i.id })}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  headCopy: { flex: 1, minWidth: 0 },
  subtitle: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, flexShrink: 0 },
  emptyCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg },
});