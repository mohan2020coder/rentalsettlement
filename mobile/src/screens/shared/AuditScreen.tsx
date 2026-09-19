import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { auditApi } from '../../api/endpoints';
import { Card, EmptyState, Section } from '../../components';
import { useApi } from '../../hooks/useApi';
import { theme } from '../../theme';
import { AuditLog } from '../../types';
import { formatDateTime, shortId } from '../../utils/format';
import { statusColor, statusLabel } from '../../utils/status';

export function AuditScreen({ route }: any) {
  const { tenancyId } = route.params as { tenancyId: string };
  const { data, loading, reload } = useApi<AuditLog[]>(() => auditApi.tenancy(tenancyId), [tenancyId]);

  return (
    <Screen>
      <Section title="Audit trail" />
      {loading && !data ? null : !data || data.length === 0 ? (
        <EmptyState message="Nothing recorded yet." />
      ) : (
        <Card>
          {data.map((log) => (
            <View key={log.id} style={styles.row}>
              <View
                style={[styles.dot, { backgroundColor: statusColor(log.action).fg }]}
              />
              <View style={styles.body}>
                <Text style={styles.action}>{statusLabel(log.action)}</Text>
                <Text style={styles.meta}>
                  {formatDateTime(log.created_at)} · by {log.actor_id ? shortId(log.actor_id) : 'system'}
                </Text>
              </View>
            </View>
          ))}
          <Text style={styles.footer} onPress={reload} accessibilityRole="button">
            Refresh
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: theme.spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: theme.spacing.sm,
  },
  body: {
    flex: 1,
  },
  action: {
    fontSize: theme.text.body,
    color: theme.colors.text,
    fontWeight: '600',
  },
  meta: {
    fontSize: theme.text.small,
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
  footer: {
    color: theme.colors.primary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    fontWeight: '600',
  },
});