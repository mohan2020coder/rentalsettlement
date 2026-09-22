import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { post, extractError } from '../../api/client';
import { MaintenanceRequest } from '../../api/types';
import { Button, Input, Screen } from '../../components/ui';
import { theme } from '../../theme';

const CATEGORIES = ['PLUMBING', 'ELECTRICAL', 'APPLIANCE', 'STRUCTURAL', 'CLEANING', 'OTHER'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function NewMaintenanceScreen({
  route,
  navigation,
}: RootStackScreenProps<'NewMaintenance'>) {
  const { tenancyId } = route.params;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('PLUMBING');
  const [priority, setPriority] = useState('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (title.trim().length < 3) {
      setError('Add a short title for the issue');
      return;
    }
    setSubmitting(true);
    try {
      const m = await post<MaintenanceRequest>(`/maintenance/tenancy/${tenancyId}`, {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        priority,
      });
      Alert.alert('Reported', 'Maintenance request recorded.', [
        { text: 'OK', onPress: () => navigation.replace('MaintenanceDetail', { maintenanceId: m.id }) },
      ]);
    } catch (err) {
      setError(extractError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  const segmented = (opts: string[], value: string, set: (v: string) => void) => (
    <View style={styles.tags}>
      {opts.map((o) => (
        <Button
          key={o}
          label={o === 'OTHER' ? o : o.charAt(0).toUpperCase() + o.slice(1).toLowerCase()}
          variant={value === o ? 'primary' : 'ghost'}
          small
          onPress={() => set(o)}
        />
      ))}
    </View>
  );

  return (
    <Screen keyboard scroll>
      <Text style={styles.pageTitle}>Report an Issue</Text>
      <Text style={styles.hint}>
        Describe the problem so both parties have a clear, dated record.
      </Text>
      <Input
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="E.g. Water leakage under kitchen sink"
      />
      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={styles.multiline}
        placeholder="What's happening, since when, any impact…"
        icon="create-outline"
      />

      <Text style={styles.label}>Category</Text>
      {segmented(CATEGORIES, category, setCategory)}

      <Text style={styles.label}>Priority</Text>
      {segmented(PRIORITIES, priority, setPriority)}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Submit Request" icon="paper-plane-outline" onPress={() => void submit()} loading={submitting} />
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