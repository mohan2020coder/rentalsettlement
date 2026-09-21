import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError, ApiClientError } from '../../api/client';
import { Settlement } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, Divider, EmptyState, ErrorView, Input, LoadingView, Row, Screen } from '../../components/ui';
import { formatDate, formatMoney, humanize, statusColor } from '../../utils/format';
import { theme } from '../../theme';

export default function SettlementScreen({
  route,
}: RootStackScreenProps<'Settlement'>) {
  const { tenancyId } = route.params;
  const { user } = useAuth();
  const isLandlord = user?.role === 'LANDLORD';
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [genMode, setGenMode] = useState(false);
  const [regenMode, setRegenMode] = useState(false);
  const [deposit, setDeposit] = useState('');

  const settlement = useLoad(async () => {
    try {
      setNotFound(false);
      return await get<Settlement>(`/settlements/tenancy/${tenancyId}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'SETTLEMENT_NOT_FOUND') {
        setNotFound(true);
        return null;
      }
      throw err;
    }
  }, [tenancyId]);

  if (settlement.loading) return <LoadingView label="Loading settlement…" />;
  if (settlement.error && !notFound) {
    return <ErrorView message={settlement.error} onRetry={settlement.reload} />;
  }

  const set = notFound ? null : settlement.data;

  const generate = async () => {
    setBusy('generate');
    try {
      await post<Settlement>(`/settlements/tenancy/${tenancyId}`, {
        recorded_deposit_minor:
          deposit ? Math.round(parseFloat(deposit) * 100) : undefined,
        currency: 'INR',
      });
      setGenMode(false);
      settlement.reload();
    } catch (err) {
      Alert.alert('Could not generate', extractError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const confirm = async () => {
    setBusy('confirm');
    try {
      await post<Settlement>(`/settlements/tenancy/${tenancyId}/confirm`, {});
      settlement.reload();
      Alert.alert('Confirmed', 'Your confirmation has been recorded.');
    } catch (err) {
      Alert.alert('Could not confirm', extractError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async () => {
    setBusy('regenerate');
    try {
      await post<Settlement>(`/settlements/tenancy/${tenancyId}/regenerate`, {
        recorded_deposit_minor: deposit ? Math.round(parseFloat(deposit) * 100) : undefined,
        currency: 'INR',
      });
      setRegenMode(false);
      setDeposit('');
      settlement.reload();
      Alert.alert(
        'Settlement regenerated',
        'A new version was generated from the latest agreed deductions. Confirmations were reset, so the tenant must review and confirm again.',
      );
    } catch (err) {
      Alert.alert('Could not regenerate', extractError(err).message);
    } finally {
      setBusy(null);
    }
  };

  if (!set) {
    return (
      <Screen scroll>
        <EmptyState
          title="No settlement yet"
          subtitle={
            isLandlord
              ? 'Once the tenancy has moved out and deductions are agreed, generate the settlement statement.'
              : 'The landlord generates the settlement statement after move-out.'
          }
        />
        {isLandlord && !genMode && (
          <Button label="Generate settlement" onPress={() => setGenMode(true)} />
        )}
        {isLandlord && genMode && (
          <Card>
            <Input
              label="Recorded deposit (₹, optional)"
              value={deposit}
              onChangeText={setDeposit}
              keyboardType="decimal-pad"
              placeholder="100000"
            />
            <Text style={styles.hint}>Leave blank to use the tenancy's recorded deposit.</Text>
            <Button label="Generate" onPress={() => void generate()} loading={busy === 'generate'} />
            <Button label="Cancel" variant="ghost" small onPress={() => setGenMode(false)} style={styles.gap} />
          </Card>
        )}
      </Screen>
    );
  }

  const mineConfirmed = isLandlord ? !!set.landlord_confirmed_at : !!set.tenant_confirmed_at;
  const canConfirm = set.status !== 'CONFIRMED' && !mineConfirmed;
  const remaining = set.remaining_amount_minor;

  return (
    <Screen scroll>
      <Card>
        <View style={styles.headRow}>
          <Text style={styles.title}>Settlement statement</Text>
          <Badge label={humanize(set.status)} color={statusColor(set.status)} />
        </View>
        <Text style={styles.sub}>Version {set.version_number} · generated {formatDate(set.created_at)}</Text>
        <Divider />
        <Row label="Recorded deposit" value={formatMoney(set.recorded_deposit_minor, set.currency)} />
        <Row label="Total deductions" value={formatMoney(set.total_deduction_minor, set.currency)} />
        <Divider />
        <Row
          label="Remaining refund / due"
          value={`${formatMoney(Math.abs(remaining), set.currency)} ${remaining < 0 ? '(owed)' : ''}`}
          subtle
        />
      </Card>

      {(set.items?.length ?? 0) > 0 && (
        <Card>
          <Text style={styles.subHead}>Itemized deductions</Text>
          {set.items!.map((it) => (
            <Row key={it.id} label={it.title} value={`− ${formatMoney(it.amount_minor, set.currency)}`} />
          ))}
        </Card>
      )}

      {isLandlord && set.status !== 'CONFIRMED' && (
        <Card>
          <Text style={styles.subHead}>Regenerate settlement</Text>
          <Text style={styles.sub}>
            If anything changed — a new agreed deduction or a revised deposit — regenerate to rebuild the statement with
            a new version. Confirmations are reset and the tenant reviews again.
          </Text>
          {!regenMode ? (
            <Button
              label="Regenerate"
              variant="secondary"
              loading={busy === 'regenerate'}
              onPress={() => setRegenMode(true)}
              style={styles.gap}
            />
          ) : (
            <>
              <Input
                label="Recorded deposit (₹, optional)"
                value={deposit}
                onChangeText={setDeposit}
                keyboardType="decimal-pad"
                placeholder="100000"
              />
              <Text style={styles.hint}>Leave blank to keep the current recorded deposit.</Text>
              <Button
                label="Regenerate statement"
                onPress={() => void regenerate()}
                loading={busy === 'regenerate'}
              />
              <Button
                label="Cancel"
                variant="ghost"
                small
                onPress={() => {
                  setRegenMode(false);
                  setDeposit('');
                }}
                style={styles.gap}
              />
            </>
          )}
        </Card>
      )}

      {canConfirm && (
        <Button
          label="Confirm settlement"
          variant="primary"
          loading={busy === 'confirm'}
          onPress={() => void confirm()}
        />
      )}

      {(set.events?.length ?? 0) > 0 && (
        <Card>
          <Text style={styles.subHead}>Events</Text>
          {set.events!.map((e) => (
            <View key={e.id}>
              <Text style={styles.eventAction}>{humanize(e.action)}</Text>
              <Text style={styles.sub}>
                {e.notes ?? ''} · {formatDate(e.created_at)}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.text },
  sub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: theme.spacing.xs },
  subHead: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.sm },
  hint: { color: theme.colors.textSubtle, fontSize: theme.text.small, marginBottom: theme.spacing.sm },
  gap: { marginTop: theme.spacing.sm },
  eventAction: { fontSize: theme.text.body, fontWeight: '600', color: theme.colors.text, marginTop: theme.spacing.sm },
});