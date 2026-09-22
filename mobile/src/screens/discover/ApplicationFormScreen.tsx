import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { post, extractError, ApiClientError } from '../../api/client';
import { Application } from '../../api/types';
import { Button, Input, Screen, ScreenTitle } from '../../components/ui';
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
      void app;
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
      <ScreenTitle title="Request visit" />
      <Text style={styles.hint}>
        The landlord reviews this request and can invite you to a tenancy.
      </Text>

      <View style={styles.propertyCard}>
        <View style={styles.propertyIcon}>
          <Ionicons name="home-outline" size={20} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{propertyName}</Text>
          <Text style={styles.rent}>{formatMoney(monthlyRentMinor, currency)}/mo</Text>
        </View>
      </View>

      <Input
        label="Preferred visit date (optional)"
        value={date}
        onChangeText={setDate}
        autoCapitalize="none"
        placeholder="2026-10-05"
        icon="calendar-outline"
      />
      <Input
        label="Message to the landlord (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={3}
        style={styles.multiline}
        placeholder="Tell the landlord about yourself or when you'd like to visit"
        icon="create-outline"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Send request" icon="send-outline" onPress={() => void submit()} loading={submitting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  propertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  propertyIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  rent: {
    fontSize: theme.text.body,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    marginTop: 2,
  },
  multiline: { height: 90, textAlignVertical: 'top' },
  error: { color: theme.colors.danger, fontSize: theme.text.caption, marginBottom: theme.spacing.md },
});