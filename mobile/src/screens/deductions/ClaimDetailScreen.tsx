import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError } from '../../api/client';
import { DeductionClaim, Dispute } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button, Divider, ErrorView, Input, LoadingView, Row, Screen, ScreenTitle, StatusBadge } from '../../components/ui';
import { formatDate, humanize } from '../../utils/format';
import { theme } from '../../theme';

export default function ClaimDetailScreen({
  route,
}: RootStackScreenProps<'ClaimDetail'>) {
  const { claimId } = route.params;
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [disputeMode, setDisputeMode] = useState(false);
  const [reason, setReason] = useState('');

  const claim = useLoad(async () => get<DeductionClaim>(`/deductions/${claimId}`), [claimId], { refreshOnFocus: true });

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

  const amount = `${c.currency === 'INR' ? '\u20B9' : c.currency} ${(c.claimed_amount_minor / 100).toLocaleString('en-IN')}`;

  return (
    <Screen scroll keyboard>
      <ScreenTitle title="Deduction Claim" />
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.amountWrap}>
            <Text style={styles.category}>{c.category.replace(/_/g, ' ')}</Text>
            <Text style={styles.amount}>{amount}</Text>
            <Text style={styles.sub}>Proposed {formatDate(c.created_at)}</Text>
          </View>
          <StatusBadge label={humanize(c.status)} />
        </View>
        {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}

        <Divider />
        <Row label="Claimed amount" value={amount} />
        <Row label="Category" value={c.category.replace(/_/g, ' ')} />
        <Row label="Status" value={humanize(c.status)} />
      </View>

      <View style={styles.evidenceCard}>
        <Text style={styles.evidenceTitle}>Evidence</Text>
        <Text style={styles.evidenceSub}>Attach move-in / move-out photos and quotations for this claim.</Text>
        <View style={styles.evidenceActions}>
          <Button label="Add evidence" variant="ghost" small icon="cloud-upload-outline" onPress={() => {}} />
        </View>
      </View>

      {isTenant && c.status === 'PROPOSED' && (
        <View style={styles.evidenceCard}>
          <Button label="Accept the full deduction" icon="checkmark-circle-outline" onPress={accept} loading={busy === 'accept'} />
          <Button
            label="Open a dispute instead"
            variant="secondary"
            icon="chatbubble-ellipses-outline"
            onPress={() => setDisputeMode(true)}
            style={styles.gap}
          />
        </View>
      )}

      {isTenant && disputeMode && (
        <View style={styles.evidenceCard}>
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
        </View>
      )}

      {isLandlord && open && (
        <View style={styles.evidenceCard}>
          <Button label="Withdraw this claim" variant="danger" icon="close-circle-outline" onPress={withdraw} loading={busy === 'withdraw'} />
        </View>
      )}

      {(c.status === 'AGREED' || c.status === 'ACCEPTED') && (
        <View style={styles.agreedCard}>
          <Ionicons name="checkmark-done-circle-outline" size={22} color={theme.colors.success} />
          <Text style={styles.agreed}>
            This deduction is agreed and will be included in the settlement statement.
          </Text>
        </View>
      )}
    </Screen>
  );
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
  amountWrap: { flex: 1, paddingRight: theme.spacing.md },
  category: {
    fontSize: theme.text.small,
    fontWeight: '700',
    color: theme.colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amount: { fontSize: 24, fontWeight: '800', color: theme.colors.text, marginTop: 6 },
  sub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 4 },
  desc: { color: theme.colors.text, fontSize: theme.text.body, marginTop: theme.spacing.md },
  evidenceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  evidenceTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  evidenceSub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  evidenceActions: { marginTop: theme.spacing.md },
  gap: { marginTop: theme.spacing.sm },
  multiline: { height: 90, textAlignVertical: 'top' },
  agreedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.successBg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#C6ECDC',
    padding: theme.spacing.lg,
  },
  agreed: { color: theme.colors.success, fontSize: theme.text.body, fontWeight: '600', flex: 1 },
});