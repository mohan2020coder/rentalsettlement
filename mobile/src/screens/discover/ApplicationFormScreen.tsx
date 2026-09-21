import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { post, extractError, ApiClientError } from '../../api/client';
import { Application } from '../../api/types';
import { Button, Card, Input, Screen } from '../../components/ui';
import { formatMoney } from '../../utils/format';
import { theme } from '../../theme';

export default function ApplicationFormScreen({
  route,
  navigation,
}: RootStackScreenProps<'ApplicationForm'>) {
  const { propertyId, propertyName, monthlyRentMinor, currency } = route.params;
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const trimmedDate = date.trim();
    if (trimmedDate && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setError('Preferred date must be in YYYY-MM-DD format');
      return;
    }
    setSubmitting(true);
    try {
      const app = await post<Application>('/applications', {
        property_id: propertyId,
        preferred_date: trimmedDate || undefined,
        note: note.trim() || undefined,
      });
      Alert.alert('Request sent', 'The landlord has been notified of your interest.', [
        { text: 'OK', onPress: () => navigation.replace('Applications') },
      ]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not send request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboard scroll>
      <Text style={styles.pageTitle}>Request visit</Text>

      <Card>
        <Text style={styles.name}>{propertyName}</Text>
        <Text style={styles.rent}>{formatMoney(monthlyRentMinor, currency)}/mo</Text>
      </Card>

      <Input
        label="Preferred date (optional)"
        value={date}
        onChangeText={setDate}
        autoCapitalize="none"
        placeholder="2026-10-05"
      />
      <Input
        label="Message to the landlord (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={3}
        style={styles.multiline}
        placeholder="Tell the landlord about yourself or when you'd like to visit"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Send request" onPress={() => void submit()} loading={submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: theme.text.title,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  name: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  rent: {
    fontSize: theme.text.heading,
    fontWeight: '800',
    color: theme.colors.primaryDark,
    marginTop: theme.spacing.sm,
  },
  multiline: { height: 90, textAlignVertical: 'top' },
  error: { color: theme.colors.danger, fontSize: theme.text.caption, marginBottom: theme.spacing.md },
});