import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError } from '../../api/client';
import { DeductionClaim, Dispute } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, Divider, ErrorView, Input, LoadingView, Row, Screen } from '../../components/ui';
import { formatDate, humanize, statusColor } from '../../utils/format';
import { theme } from '../../theme';

export default function ClaimDetailScreen({
  route,
}: RootStackScreenProps<'ClaimDetail'>) {
  const { claimId } = route.params;
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [disputeMode, setDisputeMode] = useState(false);
  const [reason, setReason] = useState('');

  const claim = useLoad(async () => get<DeductionClaim>(`/deductions/${claimId}`), [claimId]);

  if (claim.loading) return <LoadingView label="Loading claim…" />;
  if (claim.error || !claim.data) {
    return <ErrorView message={claim.error ?? 'Missing'} onRetry={claim.reload} />;
  }

  const c = claim.data;
  const isLandlord = user?.role === 'LANDLORD';
  const isTenant = user?.role === 'TENANT';
  const open = ['PROPOSED', 'DISPUTED', 'COUNTER_OFFERED'].includes(c.status);

  const run = async (label: string, fn: () => Promise<unknown>, reload = true) => {
    setBusy(label);
    try {
      await fn();
      if (reload) claim.reload();
    } catch (err) {
      Alert.alert('Could not complete', extractError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const accept = () => {
    Alert.alert('Accept deduction?', 'Accepting records your agreement to the full claimed amount.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: () => void run('accept', () => post(`/deductions/${claimId}/accept`, {})) },
    ]);
  };

  const submitDispute = () => {
    if (!reason.trim()) {
      Alert.alert('Add a reason', 'Tell the landlord why you are disputing this amount.');
      return;
    }
    void run('dispute', () =>
      post<Dispute>(`/deductions/${claimId}/dispute`, { reason: reason.trim() }),
    ).then(() => setDisputeMode(false));
  };

  const withdraw = () => {
    Alert.alert('Withdraw claim?', 'The claim will return to a withdrawn state.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: () => void run('withdraw', () => post(`/deductions/${claimId}/withdraw`, {})) },
    ]);
  };

  return (
    <Screen scroll keyboard>
      <Card>
        <View style={styles.headRow}>
          <Text style={styles.title}>{c.title}</Text>
          <Badge label={humanize(c.status)} color={statusColor(c.status)} />
        </View>
        <Text style={styles.sub}>
          {c.category.replace(/_/g, ' ')} · proposed {formatDate(c.created_at)}
        </Text>
        {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}
        <Divider />
        <Row label="Claimed amount" value={`${c.currency === 'INR' ? '\u20B9' : c.currency} ${(c.claimed_amount_minor / 100).toLocaleString('en-IN')}`} />
      </Card>

      {isTenant && c.status === 'PROPOSED' && (
        <Card>
          <Button label="Accept the full deduction" onPress={accept} loading={busy === 'accept'} />
          <Button
            label="Open a dispute instead"
            variant="secondary"
            onPress={() => setDisputeMode(true)}
            style={styles.gap}
          />
        </Card>
      )}

      {isTenant && disputeMode && (
        <Card>
          <Input
            label="Why are you disputing this?"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            placeholder="Explain your reasons…"
            style={styles.multiline}
          />
          <Button label="Submit dispute" onPress={submitDispute} loading={busy === 'dispute'} />
        </Card>
      )}

      {isLandlord && open && (
        <Card>
          <Button label="Withdraw this claim" variant="danger" onPress={withdraw} loading={busy === 'withdraw'} />
        </Card>
      )}

      {(c.status === 'AGREED' || c.status === 'ACCEPTED') && (
        <Card>
          <Text style={styles.agreed}>
            This deduction is agreed and will be included in the settlement statement.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.text, flex: 1, paddingRight: theme.spacing.md },
  sub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: theme.spacing.xs },
  desc: { color: theme.colors.text, fontSize: theme.text.body, marginTop: theme.spacing.sm },
  gap: { marginTop: theme.spacing.sm },
  multiline: { height: 90, textAlignVertical: 'top' },
  agreed: { color: theme.colors.success, fontSize: theme.text.body, fontWeight: '600' },
});