import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { agreementsApi } from '../../api/endpoints';
import { Badge, Button, Card, EmptyState, Money, Row, Screen, Section } from '../../components';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../store/AuthContext';
import { theme } from '../../theme';
import { AgreementVersion } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';

export function AgreementScreen({ route, navigation }: any) {
  const { tenancyId } = route.params as { tenancyId: string };
  const { user } = useAuth();
  const { data, loading, reload } = useApi<AgreementVersion[]>(
    () => agreementsApi.versions(tenancyId),
    [tenancyId],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const approve = async (version: number) => {
    setBusyId(String(version));
    setMessage(null);
    try {
      await agreementsApi.approve(tenancyId, version);
      setMessage('Approval recorded.');
      reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Approval failed.');
    } finally {
      setBusyId(null);
    }
  };

  // Any confirmed version becomes the effective terms.
  const confirmed = (data ?? []).find((v) => v.fully_confirmed);

  return (
    <Screen>
      <Section title="Rental agreement" />
      {loading && !data ? null : !data || data.length === 0 ? (
        <EmptyState message="No agreement versions yet." />
      ) : (
        <>
          {confirmed ? (
            <Card>
              <Text style={styles.subtitle}>Currently in effect</Text>
              <Money amountMinor={confirmed.terms.monthly_rent_minor} currency={confirmed.terms.currency} />
              <Row label="Security deposit" value={formatMoney(confirmed.terms.security_deposit_minor, confirmed.terms.currency)} />
              <Row label="Notice period" value={`${confirmed.terms.notice_period_days} days`} />
              <Row label="Payment day" value={`Day ${confirmed.terms.monthly_payment_day}`} />
              <Row label="Clauses" value={`${confirmed.terms.clauses.length}`} />
            </Card>
          ) : null}

          {message ? <Text style={styles.message}>{message}</Text> : null}

          {(data ?? [])
            .slice()
            .sort((a, b) => b.version_number - a.version_number)
            .map((version) => {
              const canApprove =
                !version.fully_confirmed &&
                (user?.role === 'LANDLORD' ? !version.landlord_confirmed_at : !version.tenant_confirmed_at);
              return (
                <Card key={version.id} style={styles.versionCard}>
                  <View style={styles.versionHead}>
                    <Text style={styles.versionTitle}>Version {version.version_number}</Text>
                    <Badge
                      label={version.fully_confirmed ? 'Agreed' : 'Pending'}
                      color={version.fully_confirmed ? { bg: '#dcfce7', fg: '#15803d' } : { bg: '#fef3c7', fg: '#b45309' }}
                    />
                  </View>
                  <Row label="Landlord" value={version.landlord_confirmed_at ? formatDate(version.landlord_confirmed_at) : 'Not yet'} />
                  <Row label="Tenant" value={version.tenant_confirmed_at ? formatDate(version.tenant_confirmed_at) : 'Not yet'} />
                  {canApprove ? (
                    <Button title={`Approve version ${version.version_number}`} onPress={() => approve(version.version_number)} loading={busyId === String(version.version_number)} />
                  ) : null}
                </Card>
              );
            })}
        </>
      )}
      <Button variant="ghost" title="Cancel" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    marginBottom: theme.spacing.xs,
  },
  versionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  versionTitle: {
    fontSize: theme.text.body,
    fontWeight: '700',
    color: theme.colors.text,
  },
  versionCard: {
    paddingVertical: theme.spacing.md,
  },
  message: {
    color: theme.colors.success,
    fontSize: theme.text.caption,
    marginBottom: theme.spacing.sm,
  },
});