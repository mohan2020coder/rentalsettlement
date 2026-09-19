import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { deductionsApi } from '../../api/endpoints';
import { Button, Card, Field, Screen, Section } from '../../components';
import { theme } from '../../theme';
import {
  CLAIM_CATEGORIES,
  claimCategoryLabel,
} from '../../utils/status';
import { parseAmountMinor } from '../../utils/format';

export function NewClaimScreen({ route, navigation }: any) {
  const { tenancyId } = route.params as { tenancyId: string };
  const [category, setCategory] = useState('PROPERTY_DAMAGE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const claimedAmountMinor = parseAmountMinor(amount);
    if (!title.trim()) {
      setError('Give the claim a short title.');
      return;
    }
    if (claimedAmountMinor === null || claimedAmountMinor <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setBusy(true);
    try {
      await deductionsApi.propose(tenancyId, {
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        claimed_amount_minor: claimedAmountMinor,
        currency: 'INR',
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not propose the claim.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Section title="Propose a deduction claim" />
      <Card>
        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {CLAIM_CATEGORIES.map((c) => (
            <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{claimCategoryLabel(c)}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Repainting living room walls" />
        <Field label="Description" value={description} onChangeText={setDescription} multiline placeholder="Optional details" />
        <Field label="Amount (Rs)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="e.g. 25000" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Propose claim" onPress={submit} loading={busy} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: theme.text.small,
    color: theme.colors.text,
  },
  chipTextActive: {
    color: theme.colors.white,
    fontWeight: '600',
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.text.caption,
    marginBottom: theme.spacing.sm,
  },
});