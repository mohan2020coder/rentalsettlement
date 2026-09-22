import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError, ApiClientError } from '../../api/client';
import { Property, Tenancy } from '../../api/types';
import { useLoad } from '../../hooks';
import { Button, Card, EmptyState, ErrorView, Input, LoadingView, Screen, ScreenTitle } from '../../components/ui';
import { theme } from '../../theme';

export default function NewTenancyScreen({ navigation }: RootStackScreenProps<'NewTenancy'>) {
  const properties = useLoad(async () => get<Property[]>('/properties'), []);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [noticeDays, setNoticeDays] = useState('30');
  const [rentDueDay, setRentDueDay] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (properties.loading) return <LoadingView label="Loading properties…" />;
  if (properties.error) return <ErrorView message={properties.error} onRetry={properties.reload} />;

  const toMinor = (rupees: string): number => {
    const n = parseFloat(rupees);
    return Number.isNaN(n) ? 0 : Math.round(n * 100);
  };

  const submit = async () => {
    setError(null);
    if (!propertyId) {
      setError('Choose a property');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(invitedEmail)) {
      setError('Enter the tenant email to invite');
      return;
    }
    if (toMinor(rent) <= 0) {
      setError('Enter a monthly rent');
      return;
    }
    setSubmitting(true);
    try {
      const tenancy = await post<Tenancy>('/tenancies', {
        property_id: propertyId,
        invited_email: invitedEmail.trim(),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        monthly_rent_minor: toMinor(rent),
        security_deposit_minor: toMinor(deposit),
        currency: 'INR',
        notice_period_days: parseInt(noticeDays, 10) || 30,
        rent_due_day: rentDueDay ? parseInt(rentDueDay, 10) : undefined,
      });
      Alert.alert('Tenancy created', 'The tenant has been invited.', [
        { text: 'OK', onPress: () => navigation.replace('TenancyDetail', { tenancyId: tenancy.id }) },
      ]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not create tenancy');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboard scroll>
      <ScreenTitle title="New Tenancy" />
      <Text style={styles.hint}>Pick a property, set the terms, and invite the tenant by email.</Text>
      {properties.data && properties.data.length > 0 ? (
        <>
          <Text style={styles.label}>Property</Text>
          {properties.data.map((p) => {
            const selected = p.id === propertyId;
            return (
              <Card
                key={p.id}
                style={selected ? [styles.option, styles.optionSelected] : styles.option}
                onPress={() => setPropertyId(p.id)}
              >
                <Text style={styles.optionTitle}>{p.property_name}</Text>
                <Text style={styles.optionSub}>
                  {p.locality ?? p.city ?? '—'} · {p.property_type.replace(/_/g, ' ')}
                </Text>
              </Card>
            );
          })}

          <Input
            label="Tenant email"
            value={invitedEmail}
            onChangeText={setInvitedEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="tenant@example.com"
          />
          <View style={styles.row}>
            <View style={styles.col}>
              <Input label="Start date" value={startDate} onChangeText={setStartDate} placeholder="2026-01-01" />
            </View>
            <View style={styles.col}>
              <Input label="End date" value={endDate} onChangeText={setEndDate} placeholder="2026-12-31" />
            </View>
          </View>
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
              <Input label="Notice period (days)" value={noticeDays} onChangeText={setNoticeDays} keyboardType="number-pad" />
            </View>
            <View style={styles.col}>
              <Input label="Rent due day" value={rentDueDay} onChangeText={setRentDueDay} keyboardType="number-pad" placeholder="5" />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Create & invite tenant" onPress={() => void submit()} loading={submitting} />
        </>
      ) : (
        <EmptyState
          icon="business-outline"
          title="You need a property first"
          subtitle="Add a property before inviting tenants."
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  option: {
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  optionSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  optionTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  optionSub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  row: { flexDirection: 'row', gap: theme.spacing.md },
  col: { flex: 1 },
  error: { color: theme.colors.danger, fontSize: theme.text.caption, marginBottom: theme.spacing.md },
});