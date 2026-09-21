import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError } from '../../api/client';
import { DeductionClaim, Dispute, DisputeEvent } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, Divider, ErrorView, Input, LoadingView, Row, Screen } from '../../components/ui';
import { formatDateTime, formatMoney, humanize, timeAgo, statusColor } from '../../utils/format';
import { theme } from '../../theme';

interface DisputePayload {
  dispute: Dispute;
  events: DisputeEvent[];
}

export default function DisputeScreen({ route }: RootStackScreenProps<'Dispute'>) {
  const { disputeId } = route.params;
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [offerMode, setOfferMode] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const dispute = useLoad(async () => get<DisputePayload>(`/disputes/${disputeId}`), [disputeId]);

  if (dispute.loading) return <LoadingView label="Loading negotiation…" />;
  if (dispute.error || !dispute.data) {
    return <ErrorView message={dispute.error ?? 'Missing'} onRetry={dispute.reload} />;
  }

  const d = dispute.data.dispute;
  const events = dispute.data.events ?? [];
  const isLandlord = user?.role === 'LANDLORD';
  const isOpenedByMe = d.opened_by === user?.id;
  const active = d.status === 'OPEN' || d.status === 'NEGOTIATING';

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      dispute.reload();
    } catch (err) {
      Alert.alert('Could not complete', extractError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const acceptOffer = () => {
    Alert.alert('Accept offer?', 'Accepting agrees to the latest claimed amount.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: () => void run('accept', () => post<DeductionClaim>(`/disputes/${disputeId}/accept`, {})) },
    ]);
  };

  const submitOffer = () => {
    const n = parseFloat(amount);
    if (Number.isNaN(n) || n <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive counter-offer amount.');
      return;
    }
    void run('offer', () =>
      post<Dispute>(`/disputes/${disputeId}/counter-offer`, {
        new_amount_minor: Math.round(n * 100),
        reason: reason.trim() || undefined,
      }),
    ).then(() => setOfferMode(false));
  };

  const withdraw = () => {
    Alert.alert('Withdraw negotiation?', 'Closing the negotiation returns the claim to its proposed state.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: () => void run('withdraw', () => post<Dispute>(`/disputes/${disputeId}/withdraw`, {})) },
    ]);
  };

  return (
    <Screen scroll keyboard>
      <Card>
        <View style={styles.headRow}>
          <Text style={styles.title}>
            {d.category?.replace(/_/g, ' ') || 'Deduction negotiation'}
          </Text>
          <Badge label={humanize(d.status)} color={statusColor(d.status)} />
        </View>
        {d.description ? <Text style={styles.desc}>{d.description}</Text> : null}
        <Text style={styles.sub}>Opened {formatDateTime(d.created_at)}</Text>
      </Card>

      {active && (
        <>
          {!isLandlord && (
            <Card>
              <Button label="Accept the current offer" onPress={acceptOffer} loading={busy === 'accept'} />
              <Button
                label="Withdraw negotiation"
                variant="ghost"
                onPress={withdraw}
                style={styles.gap}
                loading={busy === 'withdraw'}
              />
            </Card>
          )}
          {isLandlord && (
            <Card>
              {!offerMode ? (
                <Button label="Make a counter-offer" onPress={() => setOfferMode(true)} />
              ) : (
                <>
                  <Input
                    label="New amount (₹)"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="4000"
                  />
                  <Input
                    label="Reason (optional)"
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    numberOfLines={3}
                    style={styles.multiline}
                  />
                  <Button label="Send counter-offer" onPress={submitOffer} loading={busy === 'offer'} />
                  <Button label="Cancel" variant="ghost" small onPress={() => setOfferMode(false)} style={styles.gap} />
                </>
              )}
            </Card>
          )}
          {isLandlord && isOpenedByMe && (
            <View style={styles.gap}>
              <Button label="Close this negotiation" variant="ghost" onPress={withdraw} loading={busy === 'withdraw'} />
            </View>
          )}
        </>
      )}

      <Text style={styles.section}>Negotiation trail</Text>
      <Card>
        {events.length === 0 ? (
          <Text style={styles.sub}>No events yet.</Text>
        ) : (
          events.map((e, i) => (
            <View key={e.id}>
              {i > 0 ? <Divider /> : null}
              <Text style={styles.eventAction}>{humanize(e.action)}</Text>
              <Text style={styles.eventMeta}>
                {e.original_amount_minor != null || e.new_amount_minor != null
                  ? sequence(e) + ' · '
                  : ''}
                {timeAgo(e.created_at)}
              </Text>
              {e.reason ? <Text style={styles.eventReason}>“{e.reason}”</Text> : null}
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

function sequence(e: DisputeEvent): string {
  const parts: string[] = [];
  if (e.original_amount_minor != null) parts.push(formatMoney(e.original_amount_minor));
  if (e.new_amount_minor != null) parts.push(`→ ${formatMoney(e.new_amount_minor)}`);
  return parts.join(' ');
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.text, flex: 1, paddingRight: theme.spacing.md },
  sub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: theme.spacing.xs },
  desc: { color: theme.colors.text, fontSize: theme.text.body, marginTop: theme.spacing.sm },
  gap: { marginTop: theme.spacing.sm },
  multiline: { height: 70, textAlignVertical: 'top' },
  section: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.text, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  eventAction: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  eventMeta: { color: theme.colors.textSubtle, fontSize: theme.text.small, marginTop: 2 },
  eventReason: { color: theme.colors.text, fontSize: theme.text.caption, marginTop: 2, fontStyle: 'italic' },
});