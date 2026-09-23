import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError } from '../../api/client';
import { Tenancy } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, EmptyState, ErrorView, ListItem, LoadingView, PropertyImagePlaceholder, Row, Screen, ScreenTitle, SectionHeader, StatusBadge } from '../../components/ui';
import { downloadEvidencePdf, shareFile } from '../../utils/evidence';
import { formatDate, formatMoney, humanize } from '../../utils/format';
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

  const tenancy = useLoad(async () => get<Tenancy>(`/tenancies/${tenancyId}`), [tenancyId], { refreshOnFocus: true });

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
  const canMoveOut = (t.status === 'ACTIVE' || t.status === 'NOTICE_GIVEN') && (isLandlord || isTenant);
  const canCancel = isLandlord && ['INVITED', 'ACTIVE', 'NOTICE_GIVEN'].includes(t.status);
  const canAccept = isTenant && t.status === 'INVITED';
  const canDeclineInvite = isTenant && t.status === 'INVITED';

  const label = propertyName ?? 'Rental property';
  const statusLabel = humanize(t.status);

  return (
    <Screen scroll refreshing={false} onRefresh={tenancy.reload} padded>
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text style={styles.eyebrow}>Tenancy</Text>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.subTitle}>{statusLabel} tenancy</Text>
        </View>
        <StatusBadge label={statusLabel} />
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryCell icon="cash-outline" label="Monthly Rent" value={formatMoney(t.monthly_rent_minor, t.currency)} />
          <SummaryCell icon="shield-checkmark-outline" label="Security Deposit" value={formatMoney(t.security_deposit_minor, t.currency)} />
        </View>
        <View style={styles.summaryRow}>
          <SummaryCell icon="calendar-outline" label="Lease Start" value={formatDate(t.start_date)} />
          <SummaryCell icon="calendar-outline" label="Lease End" value={formatDate(t.end_date)} />
        </View>
        <View style={styles.summaryRow}>
          <SummaryCell icon="time-outline" label="Notice Period" value={t.notice_period_days ? `${t.notice_period_days} days` : '—'} />
          <SummaryCell icon="flag-outline" label="Rent Due Date" value={t.rent_due_day ? `Day ${t.rent_due_day}` : '—'} />
        </View>
      </View>

      <SectionHeader title="Property" />
      <ListItem
        icon="business-outline"
        title={label}
        subtitle="Photos, details and rental context"
        onPress={() => navigation.navigate('PropertyDetail', { propertyId: t.property_id })}
      />

      <SectionHeader title="Documents & records" />
      <ListItem
        icon="document-text-outline"
        title="Rental Terms"
        subtitle="Review and confirm the latest agreement version"
        onPress={() => navigation.navigate('Agreement', { tenancyId })}
      />
      <ListItem
        icon="camera-outline"
        title="Inspections"
        subtitle="Move-in and move-out condition reports"
        onPress={() => navigation.navigate('Inspections', { tenancyId })}
      />
      <ListItem
        icon="construct-outline"
        title="Maintenance"
        subtitle="Reported issues and their status"
        onPress={() => navigation.navigate('Maintenance', { tenancyId })}
      />
      <ListItem
        icon="chatbubble-ellipses-outline"
        title="Deductions & Disputes"
        subtitle="Deposit claims and negotiation"
        onPress={() => navigation.navigate('Deductions', { tenancyId })}
      />
      <ListItem
        icon="receipt-outline"
        title="Settlement"
        subtitle="Itemized refund record for this tenancy"
        onPress={() => navigation.navigate('Settlement', { tenancyId })}
      />
      <ListItem
        icon="time-outline"
        title="Audit trail"
        subtitle="Append-only history for this tenancy"
        onPress={() => navigation.navigate('Audit', { tenancyId })}
      />

      {(canAccept || canDeclineInvite || canNotice || canMoveOut || canCancel) && (
        <>
          <SectionHeader title="Tenancy actions" />
          {canAccept && (
            <Button label="Accept invitation" icon="checkmark-circle-outline" onPress={() => void accept()} loading={busy && action === 'ACCEPT'} />
          )}
          {canDeclineInvite && (
            <View style={styles.actionGap}>
              <Button
                label="Decline invitation"
                variant="ghost"
                onPress={() => confirmTransition('CANCELLED', 'Decline this invitation? This cannot be undone.')}
                loading={busy && action === 'CANCELLED'}
              />
            </View>
          )}
          {canNotice && (
            <Button
              label="Give move-out notice"
              variant="danger"
              icon="log-out-outline"
              onPress={() => confirmTransition('NOTICE_GIVEN', 'Give notice that the tenant intends to leave?')}
              loading={busy && action === 'NOTICE_GIVEN'}
            />
          )}
          {canMoveOut && (
            <View style={styles.actionGap}>
              <Button
                label="Record move-out"
                variant="danger"
                onPress={() => confirmTransition('MOVE_OUT', 'Mark this tenancy as moved out?')}
                loading={busy && action === 'MOVE_OUT'}
              />
            </View>
          )}
          {canCancel && (
            <View style={styles.actionGap}>
              <Button
                label="Cancel tenancy"
                variant="ghost"
                onPress={() => confirmTransition('CANCELLED', 'Cancel this tenancy? This cannot be undone.')}
                loading={busy && action === 'CANCELLED'}
              />
            </View>
          )}
        </>
      )}

      {!canAccept && !canDeclineInvite && !canNotice && !canMoveOut && !canCancel && (
        t.status === 'SETTLED' ? (
          <View style={styles.settledCard}>
            <Ionicons name="checkmark-done-circle-outline" size={26} color={theme.colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.settledTitle}>Tenancy complete</Text>
              <Text style={styles.settledText}>
                The deposit was settled and this property is{' '}
                {isLandlord ? 'listed back on the marketplace.' : 'back on the marketplace.'}
              </Text>
            </View>
            {isTenant && (
              <Button
                label="Find next home"
                small
                onPress={() => navigation.navigate('Main', { screen: 'Discover' })}
              />
            )}
          </View>
        ) : (
          <EmptyState
            icon="checkmark-done-outline"
            title="No pending actions"
            subtitle="This tenancy has no state transitions available from its current status."
          />
        )
      )}

      <View style={styles.actionGap}>
        <Button
          label="Download Evidence Package"
          variant="secondary"
          icon="download-outline"
          loading={evidence}
          onPress={() => void onEvidence()}
        />
      </View>
    </Screen>
  );
}

function SummaryCell({
  icon,
  label,
  value,
}: {
  icon: 'cash-outline' | 'shield-checkmark-outline' | 'calendar-outline' | 'time-outline' | 'flag-outline';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryCell}>
      <View style={styles.summaryCellIcon}>
        <Ionicons name={icon} size={16} color={theme.colors.primary} />
      </View>
      <View style={styles.summaryCellCopy}>
        <Text style={styles.summaryCellLabel}>{label}</Text>
        <Text style={styles.summaryCellValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md },
  headCopy: { flex: 1, paddingRight: theme.spacing.md },
  eyebrow: {
    fontSize: theme.text.small,
    color: theme.colors.textSubtle,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { fontSize: theme.text.screenTitle, fontWeight: '800', color: theme.colors.text, marginTop: 2 },
  subTitle: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  summaryRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  summaryCell: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  summaryCellIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  summaryCellCopy: { flex: 1 },
  summaryCellLabel: { fontSize: theme.text.small, color: theme.colors.textSubtle, fontWeight: '600' },
  summaryCellValue: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text, marginTop: 2 },
  actionGap: { marginTop: theme.spacing.sm },
  settledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.successBg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#C6ECDC',
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  settledTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.success },
  settledText: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
});