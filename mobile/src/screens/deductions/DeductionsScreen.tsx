import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { get } from '../../api/client';
import { DeductionClaim, Dispute } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button, EmptyState, ErrorView, LoadingView, Screen, ScreenTitle, SectionHeader, StatusBadge, Tag } from '../../components/ui';
import { formatDate, formatMoney, humanize } from '../../utils/format';
import { theme } from '../../theme';

export default function DeductionsScreen({
  route,
  navigation,
}: RootStackScreenProps<'Deductions'>) {
  const { tenancyId } = route.params;
  const { user } = useAuth();
  const isLandlord = user?.role === 'LANDLORD';

  const claims = useLoad(
    async () => get<DeductionClaim[]>(`/deductions/tenancy/${tenancyId}`),
    [tenancyId],
    { refreshOnFocus: true },
  );
  const disputes = useLoad(
    async () => get<Dispute[]>(`/disputes/tenancy/${tenancyId}`),
    [tenancyId],
    { refreshOnFocus: true },
  );

  const loaded = !claims.loading && !disputes.loading;

  if (!loaded) return <LoadingView label="Loading deductions…" />;
  if (claims.error) return <ErrorView message={claims.error} onRetry={claims.reload} />;

  const claimList = claims.data ?? [];
  const disputeList = disputes.data ?? [];

  return (
    <Screen scroll refreshing={false} onRefresh={() => { claims.reload(); disputes.reload(); }}>
      <View style={styles.head}>
        <View>
          <ScreenTitle title="Deductions" />
          <Text style={styles.subtitle}>Deposit claims and their negotiations.</Text>
        </View>
        {isLandlord && (
          <Button
            label="Claim"
            small
            onPress={() => navigation.navigate('NewClaim', { tenancyId })}
            icon="add"
          />
        )}
      </View>

      {claimList.length === 0 ? (
        <View style={styles.emptyCard}>
          <EmptyState
            icon="receipt-outline"
            title="No deduction claims"
            subtitle={
              isLandlord
                ? 'Propose deductions from the security deposit after move-out.'
                : 'A landlord can propose deposit deductions once the tenancy is in notice or move-out.'
            }
          />
        </View>
      ) : (
        claimList.map((c) => {
          const canAct = c.status === 'PROPOSED' && !isLandlord;
          return (
            <Pressable
              key={c.id}
              style={({ pressed }) => [styles.claimCard, pressed && { opacity: 0.92 }]}
              onPress={() => navigation.navigate('ClaimDetail', { claimId: c.id })}
            >
              <View style={styles.claimTop}>
                <View style={styles.claimIcon}>
                  <Ionicons name="receipt-outline" size={18} color={theme.colors.warning} />
                </View>
                <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                  <Text style={styles.claimTitle}>{c.title}</Text>
                  <Text style={styles.claimAmount}>
                    {formatMoney(c.claimed_amount_minor, c.currency)}
                  </Text>
                </View>
                <StatusBadge label={humanize(c.status)} />
              </View>
              <View style={styles.claimFooter}>
                <Tag label={c.category.replace(/_/g, ' ')} color={theme.colors.primary} />
                <Text style={styles.claimMeta}>Proposed {formatDate(c.created_at)}</Text>
                {canAct && (
                  <View style={styles.claimActions}>
                    <Button
                      label="Review"
                      small
                      onPress={() => navigation.navigate('ClaimDetail', { claimId: c.id })}
                    />
                  </View>
                )}
              </View>
            </Pressable>
          );
        })
      )}

      {disputeList.length > 0 ? (
        <>
          <SectionHeader title="Negotiations" />
          {disputeList.map((d) => (
            <Pressable
              key={d.id}
              style={styles.disputeCard}
              onPress={() => navigation.navigate('Dispute', { disputeId: d.id })}
            >
              <View style={styles.disputeTop}>
                <View style={styles.disputeIcon}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.disputeTitle}>{d.category?.replace(/_/g, ' ') || 'Deduction dispute'}</Text>
                  <Text style={styles.disputeSub}>{humanize(d.status)}</Text>
                </View>
                <StatusBadge label={humanize(d.status)} />
              </View>
              <Text style={styles.openNegotiation}>Open negotiation</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  subtitle: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  emptyCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg },
  claimCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.card,
  },
  claimTop: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  claimIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: theme.colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  claimTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  claimAmount: {
    fontSize: theme.text.body,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    marginTop: 3,
  },
  claimFooter: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  claimMeta: { fontSize: theme.text.small, color: theme.colors.textSubtle, marginLeft: 'auto' },
  claimActions: { marginLeft: theme.spacing.sm },
  disputeCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  disputeTop: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  disputeIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  disputeTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  disputeSub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  openNegotiation: { color: theme.colors.primary, fontSize: theme.text.caption, fontWeight: '700' },
});