import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError } from '../../api/client';
import { AgreementVersion } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button, Divider, EmptyState, ErrorView, LoadingView, Screen, ScreenTitle, SectionHeader, StatusBadge } from '../../components/ui';
import { formatDate, formatMoney } from '../../utils/format';
import { theme } from '../../theme';

export default function AgreementScreen({ route, navigation }: RootStackScreenProps<'Agreement'>) {
  const { tenancyId } = route.params;
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  const current = useLoad(
    async () => get<AgreementVersion>(`/agreements/tenancy/${tenancyId}/current`),
    [tenancyId],
    { refreshOnFocus: true },
  );
  const versions = useLoad(
    async () => get<AgreementVersion[]>(`/agreements/tenancy/${tenancyId}/versions`),
    [tenancyId],
    { refreshOnFocus: true },
  );

  if (current.loading || versions.loading) return <LoadingView label="Loading rental terms…" />;
  if (current.error && versions.data?.length === 0) {
    return <ErrorView message={current.error} onRetry={current.reload} />;
  }

  const agreement = current.data;
  if (!agreement) {
    return (
      <Screen scroll>
        <EmptyState
          icon="document-text-outline"
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

  const confirmationDate = agreement.fully_confirmed
    ? agreement.landlord_confirmed_at ?? agreement.tenant_confirmed_at ?? agreement.created_at
    : agreement.landlord_confirmed_at ?? agreement.tenant_confirmed_at;

  return (
    <Screen scroll>
      <ScreenTitle title="Rental Terms" />
      <Text style={styles.subtitle}>The agreed terms both parties confirm for this tenancy.</Text>

      <View style={styles.versionCard}>
        <View style={styles.versionTop}>
          <View style={styles.versionCopy}>
            <View style={styles.versionIcon}>
              <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={styles.versionTitle}>Version {agreement.version_number}</Text>
              <Text style={styles.versionMeta}>Drafted {formatDate(agreement.created_at)}</Text>
            </View>
          </View>
          <StatusBadge label={agreement.fully_confirmed ? 'CONFIRMED' : 'PENDING'} />
        </View>
        {!agreement.fully_confirmed ? (
          <View style={styles.pendingCallout}>
            <Ionicons name="time-outline" size={15} color={theme.colors.warning} />
            <Text style={styles.pendingNote}>
              {agreement.landlord_confirmed_at && agreement.tenant_confirmed_at
                ? 'Awaiting final confirmation'
                : agreement.landlord_confirmed_at
                  ? 'Landlord confirmed — awaiting tenant'
                  : agreement.tenant_confirmed_at
                    ? 'Tenant confirmed — awaiting landlord'
                    : 'Both parties still need to confirm'}
            </Text>
          </View>
        ) : (
          <View style={styles.pendingCalloutSuccess}>
            <Ionicons name="checkmark-done-outline" size={15} color={theme.colors.success} />
            <Text style={styles.confirmedNote}>
              Confirmed by both parties{confirmationDate ? ` · ${formatDate(confirmationDate)}` : ''}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.termsCard}>
        <TermCell label="Monthly Rent" value={formatMoney(terms.monthly_rent_minor, terms.currency)} icon="cash-outline" />
        <TermCell label="Security Deposit" value={formatMoney(terms.security_deposit_minor, terms.currency)} icon="shield-checkmark-outline" />
        <Divider />
        <TermCell label="Payment Day" value={terms.monthly_payment_day ? `Day ${terms.monthly_payment_day}` : '—'} icon="flag-outline" />
        <TermCell label="Late Fee" value={formatMoney(terms.late_fee_minor, terms.currency)} icon="alert-circle-outline" />
        <TermCell label="Notice Period" value={`${terms.notice_period_days} days`} icon="time-outline" />
      </View>

      {(terms.utility_inclusions?.length > 0 || terms.clauses?.length > 0) && (
        <View style={styles.termsCard}>
          {terms.utility_inclusions?.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Utility inclusions</Text>
              {terms.utility_inclusions.map((u, i) => (
                <View key={`u-${i}`} style={styles.bulletRow}>
                  <Ionicons name="checkmark-circle-outline" size={15} color={theme.colors.success} />
                  <Text style={styles.bullet}>{u}</Text>
                </View>
              ))}
            </>
          )}
          {terms.clauses?.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, terms.utility_inclusions?.length > 0 && styles.mt]}>Clauses</Text>
              {terms.clauses.map((c, i) => (
                <View key={`c-${i}`} style={styles.bulletRow}>
                  <Ionicons name="document-text-outline" size={15} color={theme.colors.primary} />
                  <Text style={styles.bullet}>{c}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {isLandlord ? (
        <Button
          label="Renew / update terms"
          variant="secondary"
          icon="create-outline"
          onPress={() => navigation.navigate('NewAgreementVersion', { tenancyId })}
          style={styles.renewButton}
        />
      ) : null}

      {canApprove && (
        <Button label="Approve this agreement" icon="checkmark-circle-outline" loading={busy} onPress={() => void approve()} />
      )}

      {(versions.data?.length ?? 0) > 1 ? (
        <>
          <SectionHeader title="Version history" />
          {versions.data!.slice(0, showAll ? versions.data!.length : 3).map((v) => {
            const expanded = expandedVersion === v.version_number;
            return (
              <View key={v.id} style={styles.versionHistoryCard}>
                <Pressable
                  style={styles.versionHistoryHead}
                  onPress={() => setExpandedVersion(expanded ? null : v.version_number)}
                >
                  <View style={styles.versionCopy}>
                    <View style={styles.versionIcon}>
                      <Ionicons name="git-branch-outline" size={18} color={theme.colors.primary} />
                    </View>
                    <View>
                      <Text style={styles.versionTitle}>
                        Version {v.version_number}
                        {v.version_number === agreement.version_number ? ' · current' : ''}
                      </Text>
                      <Text style={styles.versionMeta}>{formatDate(v.created_at)}</Text>
                    </View>
                  </View>
                  <View style={styles.versionRight}>
                    <StatusBadge label={v.fully_confirmed ? 'CONFIRMED' : 'PENDING'} />
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={theme.colors.textSubtle}
                    />
                  </View>
                </Pressable>
                {expanded ? (
                  <View style={styles.historyTerms}>
                    <VersionTerms version={v} currentVersionNumber={agreement.version_number} />
                  </View>
                ) : null}
              </View>
            );
          })}
          {versions.data!.length > 3 && (
            <Button
              label={showAll ? 'Show fewer versions' : 'View all versions'}
              variant="ghost"
              icon={showAll ? 'chevron-up-outline' : 'list-outline'}
              onPress={() => setShowAll((s) => !s)}
            />
          )}
        </>
      ) : null}
    </Screen>
  );
}

function VersionTerms({
  version,
  currentVersionNumber,
}: {
  version: AgreementVersion;
  currentVersionNumber: number;
}) {
  const t = version.terms;
  const isCurrent = version.version_number === currentVersionNumber;
  return (
    <View style={styles.termsCard}>
      <TermCell label="Monthly Rent" value={formatMoney(t.monthly_rent_minor, t.currency)} icon="cash-outline" />
      <TermCell label="Security Deposit" value={formatMoney(t.security_deposit_minor, t.currency)} icon="shield-checkmark-outline" />
      <Divider />
      <TermCell label="Payment Day" value={t.monthly_payment_day ? `Day ${t.monthly_payment_day}` : '—'} icon="flag-outline" />
      <TermCell label="Late Fee" value={formatMoney(t.late_fee_minor, t.currency)} icon="alert-circle-outline" />
      <TermCell label="Notice Period" value={`${t.notice_period_days} days`} icon="time-outline" />
      {!isCurrent ? (
        <Text style={styles.historyNote}>
          This is an earlier version. The current terms are shown above.
        </Text>
      ) : null}
    </View>
  );
}

function TermCell({
  icon,
  label,
  value,
}: {
  icon: 'cash-outline' | 'shield-checkmark-outline' | 'flag-outline' | 'alert-circle-outline' | 'time-outline';
  label: string;
  value: string;
}) {
  return (
    <View style={styles.termCell}>
      <View style={styles.termIcon}>
        <Ionicons name={icon} size={15} color={theme.colors.primary} />
      </View>
      <Text style={styles.termLabel}>{label}</Text>
      <Text style={styles.termValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 4, marginBottom: theme.spacing.md },
  renewButton: { marginBottom: theme.spacing.md },
  versionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  versionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  versionCopy: { flexDirection: 'row', alignItems: 'center' },
  versionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  versionTitle: { fontSize: theme.text.cardTitle, fontWeight: '700', color: theme.colors.text },
  versionMeta: { fontSize: theme.text.small, color: theme.colors.textSubtle, marginTop: 2 },
  pendingCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.warningBg,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  pendingCalloutSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.successBg,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  pendingNote: { color: theme.colors.warning, fontSize: theme.text.caption, fontWeight: '600', flex: 1 },
  confirmedNote: { color: theme.colors.success, fontSize: theme.text.caption, fontWeight: '600', flex: 1 },
  termsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  termCell: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  termIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  termLabel: { flex: 1, fontSize: theme.text.body, color: theme.colors.textSubtle },
  termValue: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  sectionLabel: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  bullet: { color: theme.colors.textSubtle, fontSize: theme.text.body, flex: 1, lineHeight: 19 },
  mt: { marginTop: theme.spacing.lg },
  versionHistoryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  versionHistoryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  versionRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  historyTerms: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  historyNote: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
    marginTop: theme.spacing.sm,
  },
});