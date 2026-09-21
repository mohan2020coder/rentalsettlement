import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { post, extractError } from '../../api/client';
import { Inspection } from '../../api/types';
import { Button, Input, Screen } from '../../components/ui';
import { theme } from '../../theme';

export default function NewInspectionScreen({
  route,
  navigation,
}: RootStackScreenProps<'NewInspection'>) {
  const { tenancyId, kind } = route.params;
  const [notes, setNotes] = useState('');
  const [rooms, setRooms] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const extraRooms = rooms
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      const endpoint = kind === 'MOVE_IN' ? 'move-in' : 'move-out';
      const created = await post<Inspection>(`/inspections/tenancy/${tenancyId}/${endpoint}`, {
        notes: notes.trim() || undefined,
        rooms: extraRooms.length ? extraRooms : undefined,
      });
      navigation.replace('InspectionDetail', { inspectionId: created.id });
    } catch (err) {
      setError(extractError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboard scroll>
      <Text style={styles.pageTitle}>
        {kind === 'MOVE_IN' ? 'New move-in inspection' : 'New move-out inspection'}
      </Text>
      <Text style={styles.hint}>
        A {kind === 'MOVE_IN' ? 'move-in' : 'move-out'} report is created with a standard room and
        item checklist. You can add extra rooms and record conditions on each item.
      </Text>

      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        placeholder="Optional notes for this inspection"
        style={styles.multiline}
      />
      <Input
        label="Extra rooms (comma separated, optional)"
        value={rooms}
        onChangeText={setRooms}
        placeholder="Store room, Terrace"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label={kind === 'MOVE_IN' ? 'Start move-in inspection' : 'Start move-out inspection'}
        onPress={() => void submit()}
        loading={submitting}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: theme.text.title, fontWeight: '800', color: theme.colors.text },
  hint: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg },
  multiline: { height: 90, textAlignVertical: 'top' },
  error: { color: theme.colors.danger, fontSize: theme.text.caption, marginBottom: theme.spacing.md },
});