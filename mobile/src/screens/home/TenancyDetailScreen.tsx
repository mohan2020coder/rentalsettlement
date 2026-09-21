import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError, ApiClientError } from '../../api/client';
import { Tenancy } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, Divider, EmptyState, ErrorView, ListItem, LoadingView, Row, Screen, SectionHeader } from '../../components/ui';
import { downloadEvidencePdf, shareFile } from '../../utils/evidence';
import { formatDate, formatMoney, statusColor } from '../../utils/format';
import { theme } from '../../theme';

export default function TenancyDetailScreen({
  route,
  navigation,
}: RootStackScreenProps<'TenancyDetail'>) {
  const { tenancyId, propertyName } = route.params;
  const { user } = useAuth();
  const [action, setAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [evidence, setEvidence] = useState(false);

  const tenancy = useLoad(async () => get<Tenancy>(`/tenancies/${tenancyId}`), [tenancyId]);

  const isLandlord = user?.id === tenancy.data?.landlord_id;
  const isTenant = user?.id === tenancy.data?.tenant_id;

  const setStatus = async (status: string) => {
    setBusy(true);
    setAction(status);
    try {
      await post<Tenancy>(`/tenancies/${tenancyId}/status`, { status });
      tenancy.reload();
      Alert.alert('Tenancy updated', `Tenancy is now ${status.replace(/_/g, ' ')}.`);
    } catch (err) {
      Alert.alert('Could not update', extractError(err).message);
    } finally {
      setBusy(false);
      setAction(null);
    }
  };

  const accept = async () => {
    setBusy(true);
    setAction('ACCEPT');
    try {
      await post<Tenancy>(`/tenancies/${tenancyId}/accept`);
      tenancy.reload();
      Alert.alert('Invitation accepted', 'You are now a tenant of this property.');
    } catch (err) {
      Alert.alert('Could not accept', extractError(err).message);
    } finally {
      setBusy(false);
      setAction(null);
    }
  };

  const confirmTransition = (status: string, message: string) => {
    Alert.alert('Update tenancy', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Update', onPress: () => void setStatus(status) },
    ]);
  };

  const onEvidence = async () => {
    setEvidence(true);
    try {
      const path = await downloadEvidencePdf(tenancyId);
      await shareFile(path);
    } catch (err) {
      Alert.alert('Could not download', extractError(err).message);
    } finally {
      setEvidence(false);
    }
  };

  if (tenancy.loading) return <LoadingView label="Loading tenancy…" />;
  if (tenancy.error || !tenancy.data) {
    return <ErrorView message={tenancy.error ?? 'Missing data'} onRetry={tenancy.reload} />;
  }

  const t = tenancy.data;

  const canNotice = isTenant && t.status === 'ACTIVE';
  const canMoveOut =
    (t.status === 'ACTIVE' || t.status === 'NOTICE_GIVEN') && (isLandlord || isTenant);
  const canCancel = isLandlord && ['INVITED', 'ACTIVE', 'NOTICE_GIVEN'].includes(t.status);
  const canAccept = isTenant && t.status === 'INVITED';
  const canDeclineInvite = isTenant && t.status === 'INVITED';

  return (
    <Screen scroll refreshing={false} onRefresh={tenancy.reload} padded>
      <Text style={styles.title}>{propertyName ?? 'Rental property'}</Text>
      <View style={styles.badgeRow}>
        <Badge label={t.status.replace(/_/g, ' ')} color={statusColor(t.status)} />
      </View>

      <Card>
        <Row label="Monthly rent" value={formatMoney(t.monthly_rent_minor, t.currency)} />
        <Row label="Security deposit" value={formatMoney(t.security_deposit_minor, t.currency)} />
        <Divider />
        <Row label="Start date" value={formatDate(t.start_date)} />
        <Row label="End date" value={formatDate(t.end_date)} />
        <Row label="Notice period" value={t.notice_period_days ? `${t.notice_period_days} days` : '—'} />
        <Row label="Rent due day" value={t.rent_due_day ? `Day ${t.rent_due_day}` : '—'} />
      </Card>

      <SectionHeader title="Documents & records" />

      <ListItem
        title="Rental agreement"
        subtitle="View and approve the latest agreement version"
        onPress={() => navigation.navigate('Agreement', { tenancyId })}
      />
      <ListItem
        title="Inspections"
        subtitle="Move-in and move-out condition reports"
        onPress={() => navigation.navigate('Inspections', { tenancyId })}
      />
      <ListItem
        title="Maintenance"
        subtitle="Reported issues and their status"
        onPress={() => navigation.navigate('Maintenance', { tenancyId })}
      />
      <ListItem
        title="Deductions & disputes"
        subtitle="Deposit claims and negotiation"
        onPress={() => navigation.navigate('Deductions', { tenancyId })}
      />
      <ListItem
        title="Settlement statement"
        subtitle="Itemized refund record for this tenancy"
        onPress={() => navigation.navigate('Settlement', { tenancyId })}
      />
      <ListItem
        title="Audit trail"
        subtitle="Append-only history for this tenancy"
        onPress={() => navigation.navigate('Audit', { tenancyId })}
      />

      <SectionHeader title="Tenancy actions" />

      {canAccept && (
        <Button
          label="Accept invitation"
          onPress={() => void accept()}
          loading={busy && action === 'ACCEPT'}
        />
      )}

      {canDeclineInvite && (
        <View style={styles.actionGap}>
          <Button
            label="Decline invitation"
            variant="ghost"
            onPress={() =>
              confirmTransition('CANCELLED', 'Decline this invitation? This cannot be undone.')
            }
            loading={busy && action === 'CANCELLED'}
          />
        </View>
      )}

      {canNotice && (
        <Button
          label="Give move-out notice"
          variant="danger"
          onPress={() =>
            confirmTransition('NOTICE_GIVEN', 'Give notice that the tenant intends to leave?')
          }
          loading={busy && action === 'NOTICE_GIVEN'}
        />
      )}

      {canMoveOut && (
        <View style={styles.actionGap}>
          <Button
            label="Record move-out"
            variant="danger"
            onPress={() =>
              confirmTransition('MOVE_OUT', 'Mark this tenancy as moved out?')
            }
            loading={busy && action === 'MOVE_OUT'}
          />
        </View>
      )}

      {canCancel && (
        <View style={styles.actionGap}>
          <Button
            label="Cancel tenancy"
            variant="ghost"
            onPress={() =>
              confirmTransition('CANCELLED', 'Cancel this tenancy? This cannot be undone.')
            }
            loading={busy && action === 'CANCELLED'}
          />
        </View>
      )}

      {!canAccept && !canDeclineInvite && !canNotice && !canMoveOut && !canCancel && (
        t.status === 'SETTLED' ? (
          <Card>
            <View style={styles.scoreRow}>
              <Text style={styles.title}>Tenancy complete</Text>
              <Badge label="Complete" color={theme.colors.primary} />
            </View>
            <Text style={styles.settledText}>
              The deposit was settled and this property is{' '}
              {isLandlord
                ? 'listed back on the marketplace and accepting new requests.'
                : 'back on the marketplace. Your next home could be waiting in Discover.'}
            </Text>
            {isTenant && (
              <Button
                label="Find your next home"
                onPress={() => navigation.navigate('Main', { screen: 'Discover' })}
                style={styles.actionGap}
              />
            )}
          </Card>
        ) : (
          <EmptyState
            title="No pending actions"
            subtitle="This tenancy has no state transitions available from its current status."
          />
        )
      )}

      <View style={styles.actionGap}>
        <Button label="Download evidence dossier" variant="secondary" loading={evidence} onPress={() => void onEvidence()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: theme.text.title, fontWeight: '800', color: theme.colors.text },
  badgeRow: { flexDirection: 'row', marginTop: theme.spacing.sm, marginBottom: theme.spacing.md },
  actionGap: { marginTop: theme.spacing.sm },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settledText: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
    marginTop: theme.spacing.sm,
  },
});