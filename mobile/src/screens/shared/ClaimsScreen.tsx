import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { deductionsApi } from '../../api/endpoints';
import { Badge, Button, Card, EmptyState, Screen, Section } from '../../components';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../store/AuthContext';
import { theme } from '../../theme';
import { DeductionClaim } from '../../types';
import { formatMoney } from '../../utils/format';
import { claimCategoryLabel, statusColor, statusLabel } from '../../utils/status';

export function ClaimsScreen({ route, navigation }: any) {
  const { tenancyId } = route.params as { tenancyId: string };
  const { user } = useAuth();
  const { data, loading, reload } = useApi<DeductionClaim[]>(() => deductionsApi.list(tenancyId), [tenancyId]);

  return (
    <Screen>
      <Section title="Deduction claims" />
      {loading && !data ? null : !data || data.length === 0 ? (
        <EmptyState message="No claims proposed." />
      ) : (
        data.map((claim) => (
          <Pressable key={claim.id} onPress={() => navigation.navigate('ClaimDetail', { claimId: claim.id })}>
            <Card>
              <View style={styles.head}>
                <Text style={styles.title}>{claim.title}</Text>
                <Badge label={statusLabel(claim.status)} color={statusColor(claim.status)} />
              </View>
              <Text style={styles.category}>{claimCategoryLabel(claim.category)}</Text>
              <Text style={styles.amount}>{formatMoney(claim.claimed_amount_minor, claim.currency)}</Text>
            </Card>
          </Pressable>
        ))
      )}
      {user?.role === 'LANDLORD' ? (
        <Button title="Propose a claim" onPress={() => navigation.navigate('NewClaim', { tenancyId })} />
      ) : null}
      <Button variant="ghost" title="Refresh" onPress={reload} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: theme.text.body,
    fontWeight: '700',
    color: theme.colors.text,
    flexShrink: 1,
    marginRight: theme.spacing.sm,
  },
  category: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
  amount: {
    fontSize: theme.text.body,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.xs,
  },
});