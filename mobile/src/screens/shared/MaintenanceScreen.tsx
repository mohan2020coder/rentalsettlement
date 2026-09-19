import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { maintenanceApi } from '../../api/endpoints';
import { Badge, Button, Card, EmptyState, Screen, Section } from '../../components';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../store/AuthContext';
import { theme } from '../../theme';
import { MaintenanceRequest } from '../../types';
import { formatDateTime } from '../../utils/format';
import { statusColor, statusLabel } from '../../utils/status';

export function MaintenanceScreen({ route, navigation }: any) {
  const { tenancyId } = route.params as { tenancyId: string };
  const { user } = useAuth();
  const { data, loading, reload } = useApi<MaintenanceRequest[]>(
    () => maintenanceApi.list(tenancyId),
    [tenancyId],
  );

  return (
    <Screen>
      <Section title="Maintenance requests" />
      {loading && !data ? null : !data || data.length === 0 ? (
        <EmptyState message="No maintenance requests." />
      ) : (
        data.map((req) => (
          <Card key={req.id}>
            <View style={styles.head}>
              <Text style={styles.title}>{req.title}</Text>
              <Badge label={statusLabel(req.status)} color={statusColor(req.status)} />
            </View>
            <Text style={styles.meta}>
              {statusLabel(req.category)} · {statusLabel(req.priority)} priority
            </Text>
            <Text style={styles.meta}>Reported {formatDateTime(req.reported_at)}</Text>
            <Button
              variant="secondary"
              title="View details"
              onPress={() => navigation.navigate('MaintenanceDetail', { requestId: req.id })}
            />
          </Card>
        ))
      )}
      <Button title="Report an issue" onPress={() => navigation.navigate('NewMaintenance', { tenancyId })} />
      <Button variant="ghost" title="Refresh" onPress={reload} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.text.body,
    fontWeight: '700',
    color: theme.colors.text,
    flexShrink: 1,
    marginRight: theme.spacing.sm,
  },
  meta: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
});