import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError } from '../../api/client';
import { AgreementVersion } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, Divider, EmptyState, ErrorView, LoadingView, Row, Screen, SectionHeader } from '../../components/ui';
import { formatDate, formatMoney, humanize } from '../../utils/format';
import { theme } from '../../theme';

export default function AgreementScreen({ route }: RootStackScreenProps<'Agreement'>) {
  const { tenancyId } = route.params;
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const current = useLoad(
    async () => get<AgreementVersion>(`/agreements/tenancy/${tenancyId}/current`),
    [tenancyId],
  );
  const versions = useLoad(
    async () => get<AgreementVersion[]>(`/agreements/tenancy/${tenancyId}/versions`),
    [tenancyId],
  );

  if (current.loading || versions.loading) return <LoadingView label="Loading agreement…" />;
  if (current.error && versions.data?.length === 0) {
    return <ErrorView message={current.error} onRetry={current.reload} />;
  }

  const agreement = current.data;
  if (!agreement) {
    return (
      <Screen scroll>
        <EmptyState
          title="No agreement yet"
          subtitle="The landlord can draft the first version of the rental agreement."
        />
      </Screen>
    );
  }

  const terms = agreement.terms;
  const isLandlord = user?.role === 'LANDLORD';
  const mineConfirmed = isLandlord
    ? !!agreement.landlord_confirmed_at
    : !!agreement.tenant_confirmed_at;
  const canApprove = !agreement.fully_confirmed && !mineConfirmed;

  const approve = async () => {
    setBusy(true);
    try {
      await post<AgreementVersion>(
        `/agreements/tenancy/${tenancyId}/versions/${agreement.version_number}/approve`,
        {},
      );
      current.reload();
      versions.reload();
      Alert.alert('Confirmed', 'Your confirmation has been recorded.');
    } catch (err) {
      Alert.alert('Could not confirm', extractError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Card>
        <View style={styles.headRow}>
          <Text style={styles.headTitle}>Version {agreement.version_number}</Text>
          <Badge label={agreement.fully_confirmed ? 'Fully confirmed' : 'Pending confirmation'} />
        </View>
        {!agreement.fully_confirmed ? (
          <Text style={styles.pendingNote}>
            {agreement.landlord_confirmed_at && agreement.tenant_confirmed_at
              ? ''
              : agreement.landlord_confirmed_at
                ? 'Landlord confirmed — awaiting tenant'
                : agreement.tenant_confirmed_at
                  ? 'Tenant confirmed — awaiting landlord'
                  : 'Both parties still need to confirm'}
          </Text>
        ) : null}

        <Divider />
        <Row label="Monthly rent" value={formatMoney(terms.monthly_rent_minor, terms.currency)} />
        <Row label="Security deposit" value={formatMoney(terms.security_deposit_minor, terms.currency)} />
        <Row label="Payment day" value={terms.monthly_payment_day ? `Day ${terms.monthly_payment_day}` : '—'} />
        <Row label="Late fee" value={formatMoney(terms.late_fee_minor, terms.currency)} />
        <Row label="Notice period" value={`${terms.notice_period_days} days`} />
        <Row label="Drafted" value={formatDate(agreement.created_at)} />

        {canApprove && (
          <View style={styles.approve}>
            <Button label="Approve this agreement" loading={busy} onPress={() => void approve()} />
          </View>
        )}
      </Card>

      {(terms.utility_inclusions?.length > 0 || terms.clauses?.length > 0) && (
        <Card>
          {terms.utility_inclusions?.length > 0 && (
            <>
              <Text style={styles.subHead}>Utility inclusions</Text>
              {terms.utility_inclusions.map((u, i) => (
                <Text key={i} style={styles.bullet}>· {u}</Text>
              ))}
            </>
          )}
          {terms.clauses?.length > 0 && (
            <>
              <Text style={[styles.subHead, terms.utility_inclusions?.length > 0 && styles.mt]}>Clauses</Text>
              {terms.clauses.map((c, i) => (
                <Text key={i} style={styles.bullet}>· {c}</Text>
              ))}
            </>
          )}
        </Card>
      )}

      {(versions.data?.length ?? 0) > 1 && (
        <>
          <SectionHeader title="Version history" />
          {versions.data!.map((v) => (
            <Card key={v.id}>
              <View style={styles.headRow}>
                <Text style={styles.headTitle}>Version {v.version_number}</Text>
                <Text style={styles.verMeta}>{formatDate(v.created_at)}</Text>
              </View>
              <Row label="Rent" value={formatMoney(v.terms.monthly_rent_minor, v.terms.currency)} />
              <Row
                label="State"
                value={
                  v.fully_confirmed
                    ? 'Fully confirmed'
                    : `${humanize(v.landlord_confirmed_at ? 'confirmed' : 'pending')} · ${humanize(v.tenant_confirmed_at ? 'confirmed' : 'pending')}`
                }
              />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headTitle: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.text },
  pendingNote: { color: theme.colors.warning, fontSize: theme.text.caption, marginTop: theme.spacing.xs },
  approve: { marginTop: theme.spacing.lg },
  subHead: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.xs },
  mt: { marginTop: theme.spacing.md },
  bullet: { color: theme.colors.textSubtle, fontSize: theme.text.body, marginVertical: 2 },
  verMeta: { color: theme.colors.textSubtle, fontSize: theme.text.caption },
});