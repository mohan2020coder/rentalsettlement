import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { maintenanceApi } from '../../api/endpoints';
import { Badge, Button, Card, Field, Row, Screen, Section } from '../../components';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../store/AuthContext';
import { theme } from '../../theme';
import { MaintenanceRequest } from '../../types';
import { formatDateTime } from '../../utils/format';
import { statusColor, statusLabel } from '../../utils/status';

const RESOLUTION: { label: string; value: string }[] = [
  { label: 'Acknowledge', value: 'ACKNOWLEDGED' },
  { label: 'Work in progress', value: 'IN_PROGRESS' },
  { label: 'Resolve', value: 'RESOLVED' },
  { label: 'Reject', value: 'REJECTED' },
];

export function MaintenanceDetailScreen({ route, navigation }: any) {
  const { requestId } = route.params as { requestId: string };
  const { user } = useAuth();
  const { data, loading, reload } = useApi<MaintenanceRequest>(
    () => maintenanceApi.get(requestId),
    [requestId],
  );
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading && !data) {
    return <Screen>{null}</Screen>;
  }
  if (!data) {
    return (
      <Screen>
        <Text style={styles.error}>Request not found.</Text>
      </Screen>
    );
  }

  const update = async (status: string) => {
    setBusy(status);
    setMessage(null);
    try {
      await maintenanceApi.updateStatus(requestId, status, comment || undefined);
      setComment('');
      setMessage('Status updated.');
      reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Section title={data.title} />
      <Card>
        <View style={styles.head}>
          <Badge label={statusLabel(data.status)} color={statusColor(data.status)} />
          <Text style={styles.meta}>{statusLabel(data.category)} · {statusLabel(data.priority)}</Text>
        </View>
        {data.description ? <Text style={styles.desc}>{data.description}</Text> : null}
        <Row label="Reported" value={formatDateTime(data.reported_at)} />
        <Row label="Resolved" value={data.resolved_at ? formatDateTime(data.resolved_at) : '—'} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Add a comment</Text>
        <Field label="Comment" value={comment} onChangeText={setComment} multiline placeholder="Optional update" />
      </Card>

      {user?.role === 'LANDLORD'
        ? RESOLUTION.map((r) => (
            <Button
              key={r.value}
              title={r.label}
              variant={r.value === 'REJECTED' ? 'danger' : 'secondary'}
              loading={busy === r.value}
              onPress={() => update(r.value)}
            />
          ))
        : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  meta: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
  },
  desc: {
    color: theme.colors.text,
    fontSize: theme.text.body,
    marginVertical: theme.spacing.sm,
  },
  message: {
    color: theme.colors.success,
    fontSize: theme.text.caption,
    marginTop: theme.spacing.sm,
  },
  cardTitle: {
    fontSize: theme.text.body,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  error: {
    color: theme.colors.danger,
  },
});