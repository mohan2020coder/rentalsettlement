import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { propertiesApi, tenanciesApi } from '../api/endpoints';
import { Badge, Button, Card, Field, Money, Row, Screen, Section } from '../components';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../store/AuthContext';
import { theme } from '../theme';
import { Property, Tenancy } from '../types';
import { formatDate } from '../utils/format';
import { statusColor, statusLabel } from '../utils/status';

const LINKS = [
  { key: 'Agreement', label: 'Agreement' },
  { key: 'Inspections', label: 'Inspections' },
  { key: 'Claims', label: 'Deduction claims' },
  { key: 'Settlement', label: 'Settlement' },
  { key: 'Maintenance', label: 'Maintenance' },
  { key: 'Audit', label: 'Audit trail' },
  { key: 'Evidence', label: 'Evidence dossier' },
] as const;

export function TenancyHubScreen({ route, navigation }: any) {
  const { tenancyId } = route.params as { tenancyId: string };
  const { user } = useAuth();
  const { data: tenancy, loading, reload } = useApi<Tenancy>(() => tenanciesApi.get(tenancyId), [tenancyId]);
  const { data: property } = useApi<Property | null>(
    () => (tenancy ? propertiesApi.get(tenancy.property_id) : Promise.resolve(null)),
    [tenancy?.property_id],
  );

  const [inviteToken, setInviteToken] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading && !tenancy) {
    return <Screen>{null}</Screen>;
  }
  if (!tenancy) {
    return (
      <Screen>
        <Text style={styles.error}>Tenancy not found.</Text>
      </Screen>
    );
  }

  const isLandlord = user?.role === 'LANDLORD';

  const run = async (key: string, fn: () => Promise<unknown>, successNote: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      setMessage(successNote);
      reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  const accept = () =>
    run(
      'accept',
      () => tenanciesApi.accept(tenancyId, inviteToken.trim()),
      'Invitation accepted. The tenancy is now active.',
    );

  const changeStatus = (status: 'NOTICE_GIVEN' | 'MOVE_OUT' | 'CANCELLED') =>
    run('status', () => tenanciesApi.updateStatus(tenancyId, status), `Tenancy marked ${statusLabel(status)}.`);

  return (
    <Screen>
      <Section title={property?.property_name || 'Tenancy'} />
      <Card>
        <View style={styles.head}>
          <Badge label={statusLabel(tenancy.status)} color={statusColor(tenancy.status)} />
          <Text style={styles.meta}>Rent per month</Text>
        </View>
        <Money amountMinor={tenancy.monthly_rent_minor} currency={tenancy.currency} />
        <Row
          label="Deposit"
          value={formatMoney(tenancy.security_deposit_minor, tenancy.currency)}
        />
        <Row label="Tenant" value={tenancy.tenant_id ? 'Invited & accepted' : String(tenancy.invited_email ?? '—')} />
        <Row label="Start date" value={formatDate(tenancy.start_date)} />
        <Row label="End date" value={formatDate(tenancy.end_date)} />
        <Row label="Notice period" value={`${tenancy.notice_period_days} days`} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>

      {/* Status actions */}
      {tenancy.status === 'INVITED' &&
        (isLandlord
          ? [
              <Button
                key="invite"
                title="Re-send invite"
                variant="secondary"
                loading={busy === 'invite'}
                onPress={() => run('invite', () => tenanciesApi.regenerateInvite(tenancyId), 'New invite link generated.')}
              />,
              <Button key="cancel" title="Cancel invitation" variant="danger" loading={busy === 'status'} onPress={() => changeStatus('CANCELLED')} />,
            ]
          : [
              <Field key="token" label="Invite token" value={inviteToken} onChangeText={setInviteToken} placeholder="Paste the token from the invitation" />,
              <Button key="accept" title="Accept invitation" loading={busy === 'accept'} onPress={accept} />,
            ])}

      {tenancy.status === 'ACTIVE' ? (
        <Button title="Give notice" variant="secondary" loading={busy === 'status'} onPress={() => changeStatus('NOTICE_GIVEN')} />
      ) : null}
      {tenancy.status === 'NOTICE_GIVEN' ? (
        <>
          <Button title="Confirm move-out" loading={busy === 'status'} onPress={() => changeStatus('MOVE_OUT')} />
          <Button title="Cancel tenancy" variant="danger" loading={busy === 'status'} onPress={() => changeStatus('CANCELLED')} />
        </>
      ) : null}

      {/* Record hub */}
      <Section title="Records" />
      {LINKS.map(({ key, label }) => (
        <Pressable key={key} onPress={() => navigation.navigate(key, { tenancyId })}>
          <Card style={styles.linkCard}>
            <Text style={styles.linkText}>{label}</Text>
            <Text style={styles.chevron}>›</Text>
          </Card>
        </Pressable>
      ))}
      <Text style={styles.disclaimer}>
        This platform records the settlement for reference only. Never move money on-platform.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
  },
  extra: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.small,
    marginBottom: theme.spacing.sm,
  },
  message: {
    color: theme.colors.success,
    fontSize: theme.text.caption,
    marginTop: theme.spacing.sm,
  },
  error: {
    color: theme.colors.danger,
  },
  linkCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  linkText: {
    fontSize: theme.text.body,
    fontWeight: '600',
    color: theme.colors.text,
  },
  chevron: {
    fontSize: 20,
    color: theme.colors.textSubtle,
  },
  disclaimer: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.small,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
});