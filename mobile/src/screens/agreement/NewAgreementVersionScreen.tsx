import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError, ApiClientError } from '../../api/client';
import { AgreementVersion, CreateAgreementPayload } from '../../api/types';
import { useLoad } from '../../hooks';
import { Button, ErrorView, Input, LoadingView, Screen, ScreenTitle } from '../../components/ui';
import { theme } from '../../theme';

export default function NewAgreementVersionScreen({
  route,
  navigation,
}: RootStackScreenProps<'NewAgreementVersion'>) {
  const { tenancyId } = route.params;
  const current = useLoad(
    async () => get<AgreementVersion>(`/agreements/tenancy/${tenancyId}/current`),
    [tenancyId],
  );

  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [paymentDay, setPaymentDay] = useState('');
  const [lateFee, setLateFee] = useState('');
  const [noticeDays, setNoticeDays] = useState('30');
  const [utilities, setUtilities] = useState('');
  const [clauses, setClauses] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    if (!current.data || prefilled.current) return;
    prefilled.current = true;
    const t = current.data.terms;
    setRent(String(t.monthly_rent_minor / 100));
    setDeposit(String(t.security_deposit_minor / 100));
    setPaymentDay(t.monthly_payment_day ? String(t.monthly_payment_day) : '');
    setLateFee(String(t.late_fee_minor / 100));
    setNoticeDays(String(t.notice_period_days));
    setUtilities((t.utility_inclusions ?? []).join('\n'));
    setClauses((t.clauses ?? []).join('\n'));
  }, [current.data]);

  if (current.loading) return <LoadingView label="Loading current terms…" />;
  if (current.error || !current.data) {
    return <ErrorView message={current.error ?? 'Missing data'} onRetry={current.reload} />;
  }

  const toMinor = (rupees: string): number => {
    const n = parseFloat(rupees);
    return Number.isNaN(n) ? 0 : Math.round(n * 100);
  };

  const submit = async () => {
    setError(null);
    if (toMinor(rent) <= 0) {
      setError('Enter a monthly rent');
      return;
    }
    const body: CreateAgreementPayload = {
      notice_period_days: parseInt(noticeDays, 10) || 30,
      monthly_rent_minor: toMinor(rent),
      security_deposit_minor: toMinor(deposit),
      currency: 'INR',
      monthly_payment_day: paymentDay ? parseInt(paymentDay, 10) : 0,
      late_fee_minor: toMinor(lateFee),
      utility_inclusions: utilities.split('\n').map((s) => s.trim()).filter(Boolean),
      clauses: clauses.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    setSubmitting(true);
    try {
      await post<AgreementVersion>(`/agreements/tenancy/${tenancyId}/versions`, body);
      Alert.alert('Terms updated', 'A new agreement version was drafted and sent to the tenant to confirm.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not update terms');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboard scroll>
      <ScreenTitle title="Renew / update terms" />
      <Text style={styles.hint}>
        Pre-filled from the current terms. Changing them creates a new agreement version the tenant must confirm.
        Add utility inclusions and clauses one per line.
      </Text>

      <View style={styles.row}>
        <View style={styles.col}>
          <Input label="Monthly rent (₹)" value={rent} onChangeText={setRent} keyboardType="decimal-pad" placeholder="30000" />
        </View>
        <View style={styles.col}>
          <Input label="Deposit (₹)" value={deposit} onChangeText={setDeposit} keyboardType="decimal-pad" placeholder="100000" />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Input label="Rent due day" value={paymentDay} onChangeText={setPaymentDay} keyboardType="number-pad" placeholder="5" />
        </View>
        <View style={styles.col}>
          <Input label="Notice period (days)" value={noticeDays} onChangeText={setNoticeDays} keyboardType="number-pad" />
        </View>
      </View>
      <Input label="Late fee (₹)" value={lateFee} onChangeText={setLateFee} keyboardType="decimal-pad" placeholder="500" />

      <Input
        label="Utility inclusions (one per line)"
        value={utilities}
        onChangeText={setUtilities}
        multiline
        style={styles.multiline}
      />
      <Input
        label="Clauses (one per line)"
        value={clauses}
        onChangeText={setClauses}
        multiline
        style={styles.multiline}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Create new version & notify tenant" onPress={() => void submit()} loading={submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
    marginTop: 2,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  row: { flexDirection: 'row', gap: theme.spacing.md },
  col: { flex: 1 },
  multiline: { height: 80, textAlignVertical: 'top', paddingTop: 8 },
  error: { color: theme.colors.danger, fontSize: theme.text.caption, marginBottom: theme.spacing.md },
});