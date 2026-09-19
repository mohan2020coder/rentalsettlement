import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { inspectionsApi } from '../../api/endpoints';
import { Badge, Button, Card, EmptyState, Screen, Section } from '../../components';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../store/AuthContext';
import { theme } from '../../theme';
import { Inspection, Tenancy, TenancyStatus } from '../../types';
import { formatDate } from '../../utils/format';
import { inspectionKindLabel, statusColor, statusLabel } from '../../utils/status';

export function InspectionsScreen({ route, navigation }: any) {
  const { tenancyId } = route.params as { tenancyId: string };
  const { user } = useAuth();
  const { data, loading, reload } = useApi<Inspection[]>(() => inspectionsApi.list(tenancyId), [tenancyId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = async (inspectionId: string) => {
    setBusy(inspectionId);
    setError(null);
    try {
      await inspectionsApi.confirm(inspectionId);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed.');
    } finally {
      setBusy(null);
    }
  };

  const actionLabel = (insp: Inspection) => {
    if (insp.status === 'CONFIRMED') {
      return null;
    }
    if (insp.status === 'PENDING_CONFIRMATION') {
      return 'Confirm inspection';
    }
    return insp.kind === 'MOVE_IN' ? (user?.role === 'LANDLORD' ? 'Confirm move-in' : null) : null;
  };

  return (
    <Screen>
      <Section title="Inspections" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !data ? null : !data || data.length === 0 ? (
        <EmptyState message="No inspections yet." />
      ) : (
        data.map((insp) => {
          const label = actionLabel(insp);
          const completed = (insp.confirmed_by ?? []).length;
          return (
            <Card key={insp.id}>
              <Pressable onPress={() => navigation.navigate('InspectionDetail', { inspectionId: insp.id })}>
                <View style={styles.head}>
                  <Text style={styles.kind}>{inspectionKindLabel(insp.kind)}</Text>
                  <Badge label={statusLabel(insp.status)} color={statusColor(insp.status)} />
                </View>
                <Text style={styles.meta}>Conducted: {formatDate(insp.conducted_at)}</Text>
                <Text style={styles.meta}>
                  Confirmations: {completed}/2
                  {insp.notes ? ` · ${insp.notes}` : ''}
                </Text>
              </Pressable>
              {label ? (
                <Button title={label} loading={busy === insp.id} onPress={() => confirm(insp.id)} />
              ) : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  kind: {
    fontSize: theme.text.body,
    fontWeight: '700',
    color: theme.colors.text,
  },
  meta: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
  error: {
    color: theme.colors.danger,
    marginBottom: theme.spacing.sm,
  },
});