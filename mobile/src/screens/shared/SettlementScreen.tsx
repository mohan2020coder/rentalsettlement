import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { settlementsApi } from '../../api/endpoints';
import { Badge, Button, Card, EmptyState, Money, Row, Screen, Section } from '../../components';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../store/AuthContext';
import { theme } from '../../theme';
import { Settlement } from '../../types';
import { formatMoney, formatDateTime } from '../../utils/format';
import { statusColor, statusLabel } from '../../utils/status';

export function SettlementScreen({ route }: any) {
  const { tenancyId } = route.params as { tenancyId: string };
  const { user } = useAuth();
  const { data, loading, reload } = useApi<Settlement>(() => settlementsApi.get(tenancyId), [tenancyId]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      setMessage('Done.');
      reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  // 404 surfaces as an error state; the landlord can then generate.
  const missing = !loading && !data;

  return (
    <Screen>
      <Section title="Settlement statement" />
      {missing ? (
        <Card>
          <EmptyState message="No settlement yet." />
          {user?.role === 'LANDLORD' ? (
            <Button title="Generate settlement" loading={busy === 'generate'} onPress={() => run('generate', () => settlementsApi.generate(tenancyId))} />
          ) : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </Card>
      ) : data ? (
        <>
          <Card>
            <View style={styles.head}>
              <Badge label={statusLabel(data.status)} color={statusColor(data.status)} />
              <Text style={styles.version}>v{data.version_number}</Text>
            </View>
            <Row label="Recorded deposit" value={formatMoney(data.recorded_deposit_minor, data.currency)} />
            <Row label="Agreed deductions" value={`− ${formatMoney(data.total_deduction_minor, data.currency)}`} />
            <Money amountMinor={data.remaining_amount_minor} currency={data.currency} />
            <Text style={[styles.remainingLabel, data.remaining_amount_minor < 0 && styles.remainingNegative]}>
              {data.remaining_amount_minor < 0
                ? 'Amount still owed by the tenant'
                : 'Refund due to the tenant (off-platform)'}
            </Text>
          </Card>

          {(data.items ?? []).length > 0 ? (
            <Card>
              <Text style={styles.cardTitle}>Itemised deductions</Text>
              {data.items?.map((item) => (
                <Row key={item.id} label={item.title} value={formatMoney(item.amount_minor, data.currency)} />
              ))}
            </Card>
          ) : null}

          {(data.events ?? []).length > 0 ? (
            <Card>
              <Text style={styles.cardTitle}>Settlement trail</Text>
              {data.events?.map((ev) => (
                <Row key={ev.id} label={`${ev.action} · ${formatDateTime(ev.created_at)}`} value={ev.notes ?? ''} />
              ))}
            </Card>
          ) : null}

          {data.status !== 'CONFIRMED' ? (
            <Card>
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <Button
                title="Confirm settlement"
                loading={busy === 'confirm'}
                onPress={() => run('confirm', () => settlementsApi.confirm(tenancyId))}
              />
              <Text style={styles.hint}>
                Both parties must confirm. Once confirmed, the tenancy is marked settled.
              </Text>
            </Card>
          ) : null}
        </>
      ) : null}
      {loading && !data ? null : null}
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
  version: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
  },
  remainingLabel: {
    color: theme.colors.success,
    fontSize: theme.text.caption,
    marginTop: theme.spacing.xs,
  },
  remainingNegative: {
    color: theme.colors.danger,
  },
  cardTitle: {
    fontSize: theme.text.body,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  message: {
    color: theme.colors.success,
    fontSize: theme.text.caption,
    marginBottom: theme.spacing.sm,
  },
  hint: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.small,
    marginTop: theme.spacing.sm,
  },
});