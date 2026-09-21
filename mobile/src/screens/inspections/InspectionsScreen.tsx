import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get } from '../../api/client';
import { InspectionSummary } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, EmptyState, ErrorView, ListItem, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { formatDate, humanize, statusColor } from '../../utils/format';
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
  );

  if (list.loading) return <LoadingView label="Loading inspections…" />;
  if (list.error) return <ErrorView message={list.error} onRetry={list.reload} />;

  const items = list.data ?? [];

  return (
    <Screen scroll refreshing={list.loading} onRefresh={list.reload}>
      <SectionHeader
        title="Inspections"
        action={
          <View style={styles.actions}>
            <Button
              label="Move-out"
              small
              onPress={() => navigation.navigate('NewInspection', { tenancyId, kind: 'MOVE_OUT' })}
            />
            {isLandlord && (
              <Button
                label="Move-in"
                small
                onPress={() => navigation.navigate('NewInspection', { tenancyId, kind: 'MOVE_IN' })}
              />
            )}
          </View>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No inspections yet"
          subtitle="Create a move-in inspection when a tenancy starts and a move-out inspection when it ends."
        />
      ) : (
        items.map((i) => (
          <ListItem
            key={i.id}
            title={i.kind === 'MOVE_IN' ? 'Move-in inspection' : 'Move-out inspection'}
            subtitle={`${humanize(i.status)} · ${formatDate(i.created_at)}`}
            right={<Badge label={humanize(i.status)} color={statusColor(i.status)} />}
            onPress={() => navigation.navigate('InspectionDetail', { inspectionId: i.id })}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: theme.spacing.sm },
});