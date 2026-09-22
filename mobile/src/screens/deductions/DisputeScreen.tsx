import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError } from '../../api/client';
import { DeductionClaim, Dispute, DisputeEvent } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button, ErrorView, Input, LoadingView, Screen, ScreenTitle, StatusBadge, TimelineItem } from '../../components/ui';
import { formatDateTime, formatMoney, humanize, timeAgo } from '../../utils/format';
import { theme } from '../../theme';

interface DisputePayload {
  dispute: Dispute;
  events: DisputeEvent[];
}

function eventIcon(e: DisputeEvent): { icon: 'arrow-up-circle-outline' | 'hand-left-outline' | 'checkmark-done-outline' | 'refresh-outline'; color: string } {
  const a = e.action.toLowerCase();
  if (a.includes('accepted') || a.includes('agreed')) {
    return { icon: 'checkmark-done-outline', color: theme.colors.success };
  }
  if (a.includes('disputed') || a.includes('counter')) {
    return { icon: 'refresh-outline', color: theme.colors.warning };
  }
  if (a.includes('withdraw')) {
    return { icon: 'arrow-up-circle-outline', color: theme.colors.textSubtle };
  }
  return { icon: 'hand-left-outline', color: theme.colors.primary };
}

export default function DisputeScreen({ route }: RootStackScreenProps<'Dispute'>) {
  const { disputeId } = route.params;
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [offerMode, setOfferMode] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const dispute = useLoad(async () => get<DisputePayload>(`/disputes/${disputeId}`), [disputeId], { refreshOnFocus: true });

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
      <ScreenTitle title="Dispute" />
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
            <Text style={styles.title}>{d.category?.replace(/_/g, ' ') || 'Deduction negotiation'}</Text>
            <Text style={styles.sub}>Opened {formatDateTime(d.created_at)}</Text>
          </View>
          <StatusBadge label={humanize(d.status)} />
        </View>
        {d.description ? <Text style={styles.desc}>{d.description}</Text> : null}
      </View>

      {active && (
        <>
          {!isLandlord && (
            <View style={styles.card}>
              <Button label="Accept the current offer" icon="checkmark-circle-outline" onPress={acceptOffer} loading={busy === 'accept'} />
              <Button
                label="Withdraw negotiation"
                variant="ghost"
                onPress={withdraw}
                style={styles.gap}
                loading={busy === 'withdraw'}
              />
            </View>
          )}
          {isLandlord && (
            <View style={styles.card}>
              {!offerMode ? (
                <Button label="Make a counter-offer" icon="refresh-outline" onPress={() => setOfferMode(true)} />
              ) : (
                <>
                  <Input
                    label="New amount (₹)"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="4000"
                    icon="cash-outline"
                  />
                  <Input
                    label="Reason (optional)"
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    numberOfLines={3}
                    style={styles.multiline}
                  />
                  <Button label="Send counter-offer" icon="send-outline" onPress={submitOffer} loading={busy === 'offer'} />
                  <Button label="Cancel" variant="ghost" small onPress={() => setOfferMode(false)} style={styles.gap} />
                </>
              )}
            </View>
          )}
        </>
      )}

      <Text style={styles.section}>Negotiation timeline</Text>
      <View style={styles.timelineCard}>
        {events.length === 0 ? (
          <Text style={styles.sub}>No events yet.</Text>
        ) : (
          events.map((e, i) => {
            const meta = eventIcon(e);
            const seq = sequence(e);
            const isLast = i === events.length - 1;
            const parts: string[] = [timeAgo(e.created_at)];
            if (e.reason) parts.push(`“${e.reason}”`);
            return (
              <TimelineItem
                key={e.id}
                icon={meta.icon}
                color={meta.color}
                title={humanize(e.action)}
                meta={parts.join(' · ')}
                amount={seq || undefined}
                isLast={isLast}
              />
            );
          })
        )}
      </View>
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
  headerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.text },
  sub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  desc: { color: theme.colors.text, fontSize: theme.text.body, marginTop: theme.spacing.md },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  gap: { marginTop: theme.spacing.sm },
  multiline: { height: 70, textAlignVertical: 'top' },
  section: {
    fontSize: theme.text.heading,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  timelineCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
});