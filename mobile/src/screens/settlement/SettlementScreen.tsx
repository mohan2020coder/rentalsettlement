import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError, ApiClientError } from '../../api/client';
import { Settlement } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button, EmptyState, ErrorView, Input, LoadingView, Screen, ScreenTitle, StatusBadge } from '../../components/ui';
import { formatDate, formatMoney, humanize } from '../../utils/format';
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
  }, [tenancyId], { refreshOnFocus: true });

  if (settlement.loading) return <LoadingView label="Loading settlement…" />;
  if (settlement.error && !notFound) {
    return <ErrorView message={settlement.error} onRetry={settlement.reload} />;
  }

  const set = notFound ? null : settlement.data;

  const generate = async () => {
    setBusy('generate');
    try {
      await post<Settlement>(`/settlements/tenancy/${tenancyId}`, {
        recorded_deposit_minor: deposit ? Math.round(parseFloat(deposit) * 100) : undefined,
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
          icon="receipt-outline"
          title="No settlement yet"
          subtitle={
            isLandlord
              ? 'Once the tenancy has moved out and deductions are agreed, generate the settlement statement.'
              : 'The landlord generates the settlement statement after move-out.'
          }
        />
        {isLandlord && !genMode && (
          <Button label="Generate settlement" icon="add-circle-outline" onPress={() => setGenMode(true)} />
        )}
        {isLandlord && genMode && (
          <View style={styles.card}>
            <Input
              label="Recorded deposit (₹, optional)"
              value={deposit}
              onChangeText={setDeposit}
              keyboardType="decimal-pad"
              placeholder="100000"
              icon="shield-checkmark-outline"
            />
            <Text style={styles.hint}>Leave blank to use the tenancy's recorded deposit.</Text>
            <Button label="Generate" onPress={() => void generate()} loading={busy === 'generate'} />
            <Button label="Cancel" variant="ghost" small onPress={() => setGenMode(false)} style={styles.gap} />
          </View>
        )}
      </Screen>
    );
  }

  const mineConfirmed = isLandlord ? !!set.landlord_confirmed_at : !!set.tenant_confirmed_at;
  const canConfirm = set.status !== 'CONFIRMED' && !mineConfirmed;
  const remaining = set.remaining_amount_minor;
  const owed = remaining < 0;

  return (
    <Screen scroll>
      <ScreenTitle title="Settlement" />
      <Text style={styles.subtitle}>
        Statement for this tenancy · Version {set.version_number} · {formatDate(set.created_at)}
      </Text>

      <View style={styles.statementCard}>
        <View style={styles.statusRow}>
          <StatusBadge label={humanize(set.status)} />
        </View>

        <View style={styles.depositRow}>
          <View style={styles.depositIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionLabel}>Security Deposit Recorded</Text>
            <Text style={styles.bigValue}>{formatMoney(set.recorded_deposit_minor, set.currency)}</Text>
          </View>
        </View>

        <View style={styles.statementBody}>
          <Text style={styles.sectionLabel}>Agreed Deductions</Text>
          {(set.items?.length ?? 0) > 0 ? (
            <>
              {set.items!.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <Text style={styles.itemLabel}>{it.title}</Text>
                  <Text style={styles.itemValue}>− {formatMoney(it.amount_minor, set.currency)}</Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.hint}>No agreed deductions.</Text>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Deductions</Text>
            <Text style={styles.totalValue}>− {formatMoney(set.total_deduction_minor, set.currency)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.remainingCard}>
        <Text style={styles.remainingLabel}>
          {owed ? 'Amount owed' : 'Remaining Deposit'}
        </Text>
        <Text style={styles.remainingValue}>
          {formatMoney(Math.abs(remaining), set.currency)}
        </Text>
        <Text style={styles.remainingNote}>
          {owed
            ? 'The tenant owes this amount towards agreed deductions.'
            : `Parties agreed that ${formatMoney(Math.abs(remaining), set.currency)} is payable to the tenant.`}
        </Text>
      </View>

      {canConfirm && (
        <Button
          label="Confirm Settlement"
          icon="checkmark-circle-outline"
          loading={busy === 'confirm'}
          onPress={() => void confirm()}
        />
      )}

      {isLandlord && set.status !== 'CONFIRMED' && (
        <View style={[styles.card, styles.gapTop]}>
          <Text style={styles.sectionLabel}>Regenerate settlement</Text>
          <Text style={styles.hint}>
            If anything changed — a new agreed deduction or a revised deposit — regenerate to rebuild the
            statement with a new version. Confirmations are reset and the tenant reviews again.
          </Text>
          {!regenMode ? (
            <Button
              label="Regenerate"
              variant="secondary"
              icon="refresh-outline"
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
        </View>
      )}

      {(set.events?.length ?? 0) > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Events</Text>
          {set.events!.map((e) => (
            <View key={e.id} style={styles.eventRow}>
              <Text style={styles.eventAction}>{humanize(e.action)}</Text>
              <Text style={styles.subtitleSmall}>
                {e.notes ?? ''} · {formatDate(e.created_at)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 4, marginBottom: theme.spacing.md },
  subtitleSmall: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  statementCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  statusRow: { flexDirection: 'row', marginBottom: theme.spacing.md },
  depositRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  depositIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: theme.colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: { fontSize: theme.text.caption, color: theme.colors.textSubtle, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  bigValue: { fontSize: 24, fontWeight: '800', color: theme.colors.text, marginTop: 4 },
  statementBody: {},
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.sm },
  itemLabel: { color: theme.colors.text, fontSize: theme.text.body },
  itemValue: { color: theme.colors.text, fontSize: theme.text.body, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  totalLabel: { color: theme.colors.textSubtle, fontSize: theme.text.body, fontWeight: '600' },
  totalValue: { color: theme.colors.textSubtle, fontSize: theme.text.body, fontWeight: '700' },
  remainingCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
  },
  remainingLabel: {
    color: theme.colors.primaryLight,
    fontSize: theme.text.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  remainingValue: { color: theme.colors.white, fontSize: 32, fontWeight: '800', marginTop: 8 },
  remainingNote: {
    color: theme.colors.primaryLight,
    fontSize: theme.text.caption,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  hint: { color: theme.colors.textSubtle, fontSize: theme.text.small, marginBottom: theme.spacing.sm, marginTop: 2 },
  gap: { marginTop: theme.spacing.sm },
  gapTop: { marginTop: theme.spacing.sm },
  eventRow: { paddingVertical: theme.spacing.xs, marginTop: theme.spacing.sm },
  eventAction: { fontSize: theme.text.body, fontWeight: '600', color: theme.colors.text },
});