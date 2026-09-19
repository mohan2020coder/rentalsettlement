import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { deductionsApi, disputesApi } from '../../api/endpoints';
import { Badge, Button, Card, EmptyState, Field, Row, Screen, Section } from '../../components';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../store/AuthContext';
import { theme } from '../../theme';
import { DeductionClaim } from '../../types';
import { formatDateTime, formatMoney, parseAmountMinor } from '../../utils/format';
import { claimCategoryLabel, statusColor, statusLabel } from '../../utils/status';

export function ClaimDetailScreen({ route }: any) {
  const { claimId } = route.params as { claimId: string };
  const { user } = useAuth();
  const { data: claim, loading, reload } = useApi<DeductionClaim>(() => deductionsApi.get(claimId), [claimId]);
  const { data: disputes } = useApi(() => (claim ? disputesApi.list(claim.tenancy_id) : Promise.resolve([])), [claim?.tenancy_id]);

  const [reason, setReason] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerReason, setOfferReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (loading && !claim) {
    return <Screen>{null}</Screen>;
  }
  if (!claim) {
    return (
      <Screen>
        <EmptyState message="Could not load the claim." />
      </Screen>
    );
  }

  const dispute = disputes?.find((d) => d.deduction_claim_id === claim.id);
  const isLandlord = user?.role === 'LANDLORD';

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      setMessage('Done.');
      reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  const offerMinor = parseAmountMinor(offerAmount);

  return (
    <Screen>
      <Section title={claim.title} />
      <Card>
        <View style={styles.head}>
          <Badge label={statusLabel(claim.status)} color={statusColor(claim.status)} />
          <Text style={styles.category}>{claimCategoryLabel(claim.category)}</Text>
        </View>
        <Text style={styles.amount}>{formatMoney(claim.claimed_amount_minor, claim.currency)}</Text>
        {claim.description ? <Text style={styles.desc}>{claim.description}</Text> : null}
        <Row label="Proposed" value={formatDateTime(claim.created_at)} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>

      {dispute ? (
        <Card>
          <Text style={styles.cardTitle}>Negotiation</Text>
          <Row label="Dispute status" value={statusLabel(dispute.status)} />
        </Card>
      ) : null}

      {/* Tenant actions */}
      {!isLandlord && claim.status === 'PROPOSED' ? (
        <Card>
          <Button title="Accept claim" loading={busy === 'accept'} onPress={() => run('accept', () => deductionsApi.accept(claim.id))} />
          <Field label="Your reason" value={reason} onChangeText={setReason} placeholder="Why you disagree" />
          <Button
            title="Dispute claim"
            variant="secondary"
            loading={busy === 'dispute'}
            onPress={() => run('dispute', () => deductionsApi.dispute(claim.id, reason || 'Disputed'))}
          />
        </Card>
      ) : null}

      {/* Landlord actions */}
      {isLandlord &&
      ['PROPOSED', 'DISPUTED', 'COUNTER_OFFERED'].includes(claim.status) &&
      claim.status !== 'AGREED' ? (
        <Card>
          {dispute && (dispute.status === 'OPEN' || dispute.status === 'NEGOTIATING') ? (
            <>
              <Field
                label="Offer amount (Rs)"
                value={offerAmount}
                onChangeText={setOfferAmount}
                keyboardType="decimal-pad"
                placeholder="e.g. 25000"
              />
              <Field label="Offer note" value={offerReason} onChangeText={setOfferReason} placeholder="Optional" />
              <Button
                title="Send counter-offer"
                loading={busy === 'counter'}
                disabled={offerMinor === null}
                onPress={() =>
                  offerMinor !== null &&
                  run('counter', () =>
                    disputesApi.counterOffer(dispute.id, offerMinor, offerReason || 'Counter-offer'),
                  )
                }
              />
            </>
          ) : null}
          <Button
            title="Withdraw claim"
            variant="danger"
            loading={busy === 'withdraw'}
            onPress={() => run('withdraw', () => deductionsApi.withdraw(claim.id))}
          />
        </Card>
      ) : null}

      {/* Tenant negotiation actions */}
      {!isLandlord && dispute && (dispute.status === 'OPEN' || dispute.status === 'NEGOTIATING') ? (
        <Card>
          <Button title="Accept offer" loading={busy === 'acceptOffer'} onPress={() => run('acceptOffer', () => disputesApi.accept(dispute.id))} />
          <Button title="Withdraw dispute" variant="ghost" loading={busy === 'withdrawDispute'} onPress={() => run('withdrawDispute', () => disputesApi.withdraw(dispute.id))} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  category: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
  },
  amount: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginVertical: theme.spacing.md,
  },
  desc: {
    fontSize: theme.text.body,
    color: theme.colors.textSubtle,
    marginBottom: theme.spacing.md,
  },
  message: {
    color: theme.colors.success,
    fontSize: theme.text.caption,
    marginTop: theme.spacing.sm,
  },
  cardTitle: {
    fontSize: theme.text.body,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
});