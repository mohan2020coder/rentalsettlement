import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { post, extractError } from '../../api/client';
import { DeductionClaim } from '../../api/types';
import { Button, Input, Screen } from '../../components/ui';
import { theme } from '../../theme';

const CATEGORIES = ['UNPAID_RENT', 'UTILITY', 'PROPERTY_DAMAGE', 'MISSING_ITEM', 'CLEANING', 'OTHER'];

export default function NewClaimScreen({
  route,
  navigation,
}: RootStackScreenProps<'NewClaim'>) {
  const { tenancyId } = route.params;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('PROPERTY_DAMAGE');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toMinor = () => {
    const n = parseFloat(amount);
    return Number.isNaN(n) ? 0 : Math.round(n * 100);
  };

  const submit = async () => {
    setError(null);
    if (title.trim().length < 3) {
      setError('Add a title for the claim');
      return;
    }
    if (toMinor() <= 0) {
      setError('Enter a claimed amount');
      return;
    }
    setSubmitting(true);
    try {
      const claim = await post<DeductionClaim>(`/deductions/tenancy/${tenancyId}`, {
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        claimed_amount_minor: toMinor(),
        currency: 'INR',
      });
      Alert.alert('Claim proposed', 'The tenant can now review this deduction.', [
        { text: 'OK', onPress: () => navigation.replace('ClaimDetail', { claimId: claim.id }) },
      ]);
    } catch (err) {
      setError(extractError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboard scroll>
      <Text style={styles.pageTitle}>Propose a Deduction</Text>
      <Text style={styles.hint}>
        Claims are reviewed by the tenant and, once agreed, flow into the settlement statement.
      </Text>
      <Input
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="E.g. Broken bathroom tap"
      />
      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={styles.multiline}
        placeholder="Evidence and context for the claim"
        icon="create-outline"
      />
      <Input
        label="Claimed amount (₹)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="5000"
        icon="cash-outline"
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.tags}>
        {CATEGORIES.map((c) => (
          <Button
            key={c}
            label={c.replace(/_/g, ' ')}
            variant={category === c ? 'primary' : 'ghost'}
            small
            onPress={() => setCategory(c)}
          />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Propose Claim" icon="send-outline" onPress={() => void submit()} loading={submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: theme.text.screenTitle, fontWeight: '800', color: theme.colors.text },
  hint: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg },
  label: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  multiline: { height: 90, textAlignVertical: 'top' },
  error: { color: theme.colors.danger, fontSize: theme.text.caption, marginBottom: theme.spacing.md },
});