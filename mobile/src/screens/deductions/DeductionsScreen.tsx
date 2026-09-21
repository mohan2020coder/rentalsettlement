import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get } from '../../api/client';
import { DeductionClaim, Dispute } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, EmptyState, ErrorView, ListItem, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { formatMoney, humanize, statusColor } from '../../utils/format';
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
  );
  const disputes = useLoad(
    async () => get<Dispute[]>(`/disputes/tenancy/${tenancyId}`),
    [tenancyId],
  );

  const loaded = !claims.loading && !disputes.loading;

  const claimRight = (c: DeductionClaim) => {
    if (c.status === 'PROPOSED' && !isLandlord) {
      return (
        <View style={styles.rowBtns}>
          <Button
            label="Accept"
            small
            onPress={() => navigation.navigate('ClaimDetail', { claimId: c.id })}
          />
          <Button
            label="Dispute"
            small
            variant="secondary"
            onPress={() => navigation.navigate('ClaimDetail', { claimId: c.id })}
          />
        </View>
      );
    }
    return <Badge label={humanize(c.status)} color={statusColor(c.status)} />;
  };

  if (!loaded) return <LoadingView label="Loading deductions…" />;
  if (claims.error) return <ErrorView message={claims.error} onRetry={claims.reload} />;

  const claimList = claims.data ?? [];

  return (
    <Screen scroll refreshing={false} onRefresh={() => { claims.reload(); disputes.reload(); }}>
      <SectionHeader
        title="Deduction claims"
        action={
          isLandlord ? (
            <Button
              label="+ Claim"
              small
              onPress={() => navigation.navigate('NewClaim', { tenancyId })}
            />
          ) : undefined
        }
      />

      {claimList.length === 0 ? (
        <EmptyState
          title="No deduction claims"
          subtitle={
            isLandlord
              ? 'Propose deductions from the security deposit after move-out.'
              : 'A landlord can propose deposit deductions once the tenancy is in notice or move-out.'
          }
        />
      ) : (
        claimList.map((c) => (
          <ListItem
            key={c.id}
            title={c.title}
            subtitle={`${formatMoney(c.claimed_amount_minor, c.currency)} · ${c.category.replace(/_/g, ' ')}`}
            right={claimRight(c)}
            onPress={() => navigation.navigate('ClaimDetail', { claimId: c.id })}
          />
        ))
      )}

      {disputes.data && disputes.data.length > 0 ? (
        <>
          <SectionHeader title="Negotiations" />
          {disputes.data.map((d) => (
            <Card key={d.id}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.dTitle}>
                    {d.category?.replace(/_/g, ' ') || 'Deduction dispute'}
                  </Text>
                  <Text style={styles.sub}>{humanize(d.status)}</Text>
                </View>
                <Badge label={humanize(d.status)} color={statusColor(d.status)} />
              </View>
              <Button
                label="Open negotiation"
                small
                variant="secondary"
                onPress={() => navigation.navigate('Dispute', { disputeId: d.id })}
              />
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm },
  info: { flex: 1, paddingRight: theme.spacing.md },
  dTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  sub: { fontSize: theme.text.caption, color: theme.colors.textSubtle },
  rowBtns: { flexDirection: 'row', gap: theme.spacing.xs },
});