import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { inspectionsApi } from '../../api/endpoints';
import { Badge, Button, Card, EmptyState, Screen, Section } from '../../components';
import { useApi } from '../../hooks/useApi';
import { theme } from '../../theme';
import { Inspection, InspectionItem } from '../../types';
import { formatDate } from '../../utils/format';
import { CONDITIONS, inspectionKindLabel, statusColor, statusLabel } from '../../utils/status';

export function InspectionDetailScreen({ route }: any) {
  const { inspectionId } = route.params as { inspectionId: string };
  const { data, loading, reload } = useApi<Inspection>(() => inspectionsApi.get(inspectionId), [inspectionId]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (loading && !data) {
    return <Screen>{null}</Screen>;
  }
  if (!data) {
    return (
      <Screen>
        <EmptyState message="Could not load the inspection." />
      </Screen>
    );
  }

  const setCondition = async (item: InspectionItem, condition: string) => {
    setSaving(true);
    setMessage(null);
    try {
      await inspectionsApi.saveItem(inspectionId, item.room_id, item.id, { condition });
      setMessage(`"${item.name}" set to ${condition}.`);
      reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Section title={`${inspectionKindLabel(data.kind)} inspection`} />
      <Card>
        <View style={styles.head}>
          <Badge label={statusLabel(data.status)} color={statusColor(data.status)} />
          <Text style={styles.meta}>{formatDate(data.conducted_at)}</Text>
        </View>
        {data.notes ? <Text style={styles.notes}>{data.notes}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>

      {(data.rooms ?? []).length === 0 ? (
        <EmptyState message="No rooms recorded yet." />
      ) : (
        (data.rooms ?? []).map((room) => (
          <Card key={room.id}>
            <Text style={styles.roomName}>{room.name}</Text>
            {(room.items ?? []).map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.chips}>
                  {CONDITIONS.map((c) => (
                    <Pressable
                      key={c}
                      disabled={saving}
                      onPress={() => setCondition(item, c)}
                      style={[styles.chip, item.condition === c && styles.chipActive]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          item.condition === c && styles.chipTextActive,
                        ]}
                      >
                        {c.replace('_', '-').toLowerCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
  },
  notes: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
    marginTop: theme.spacing.sm,
  },
  message: {
    color: theme.colors.success,
    fontSize: theme.text.caption,
    marginTop: theme.spacing.sm,
  },
  roomName: {
    fontSize: theme.text.body,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  itemRow: {
    marginBottom: theme.spacing.md,
  },
  itemName: {
    fontSize: theme.text.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
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
});