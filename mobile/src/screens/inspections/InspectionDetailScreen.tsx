import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, put, extractError } from '../../api/client';
import { Inspection, InspectionItem, SaveItemPayload } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, Divider, ErrorView, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { formatDateTime, humanize, statusColor } from '../../utils/format';
import { theme } from '../../theme';

const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'NOT_PRESENT'];

export default function InspectionDetailScreen({
  route,
}: RootStackScreenProps<'InspectionDetail'>) {
  const { inspectionId } = route.params;
  const { user } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const inspection = useLoad(async () => get<Inspection>(`/inspections/${inspectionId}`), [
    inspectionId,
  ]);

  if (inspection.loading) return <LoadingView label="Loading inspection…" />;
  if (inspection.error || !inspection.data) {
    return <ErrorView message={inspection.error ?? 'Missing'} onRetry={inspection.reload} />;
  }

  const insp = inspection.data;
  const canEdit = insp.status === 'DRAFT' || insp.status === 'PENDING_CONFIRMATION';
  const alreadyConfirmed = (insp.confirmed_by ?? []).includes(user?.id ?? '');
  const canConfirm = insp.status !== 'CONFIRMED' && !alreadyConfirmed;

  const saveItem = async (item: InspectionItem, roomId: string, payload: SaveItemPayload) => {
    setSaving(item.id);
    try {
      await put<InspectionItem>(`/inspections/${inspectionId}/rooms/${roomId}/items/${item.id}`, payload);
      inspection.reload();
    } catch (err) {
      Alert.alert('Could not save', extractError(err).message);
    } finally {
      setSaving(null);
    }
  };

  const confirm = async () => {
    setConfirming(true);
    try {
      await post<Inspection>(`/inspections/${inspectionId}/confirm`, {});
      inspection.reload();
      Alert.alert('Confirmed', 'Your confirmation has been recorded.');
    } catch (err) {
      Alert.alert('Could not confirm', extractError(err).message);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Screen scroll>
      <Card>
        <View style={styles.headRow}>
          <Text style={styles.kindTitle}>
            {insp.kind === 'MOVE_IN' ? 'Move-in inspection' : 'Move-out inspection'}
          </Text>
          <Badge label={humanize(insp.status)} color={statusColor(insp.status)} />
        </View>
        <Text style={styles.sub}>
          Started {formatDateTime(insp.created_at)}
          {insp.conducted_by ? ' · jointly conducted' : ''}
        </Text>
        {insp.notes ? <Text style={styles.notes}>{insp.notes}</Text> : null}
        {canConfirm && (
          <View style={styles.confirmWrap}>
            <Button label="Confirm this inspection" onPress={() => void confirm()} loading={confirming} />
          </View>
        )}
      </Card>

      {canEdit ? (
        <Text style={styles.editableHint}>
          Tap a condition to record the item's state at {insp.kind === 'MOVE_IN' ? 'move-in' : 'move-out'}.
        </Text>
      ) : null}

      {(insp.rooms ?? []).map((room) => (
        <View key={room.id}>
          <SectionHeader title={room.name} />
          <Card style={styles.roomCard}>
            {(room.items ?? []).map((item, idx) => {
              const cond = item.condition ?? '';
              return (
                <View key={item.id}>
                  {idx > 0 ? <Divider /> : null}
                  <View style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
                    </View>
                    <View style={styles.condRow}>
                      {CONDITIONS.map((c) => (
                        <Button
                          key={c}
                          label={c === 'NOT_PRESENT' ? 'N/A' : c.charAt(0)}
                          small
                          variant={cond === c ? 'primary' : 'ghost'}
                          disabled={!canEdit}
                          loading={saving === item.id && cond !== c}
                          style={styles.condBtn}
                          onPress={() =>
                            void saveItem(item, room.id, {
                              condition: c,
                              notes: item.notes ?? '',
                            })
                          }
                        />
                      ))}
                    </View>
                  </View>
                </View>
              );
            })}
            {(room.items ?? []).length === 0 ? <Text style={styles.itemNotes}>No items recorded.</Text> : null}
          </Card>
        </View>
      ))}

      {insp.media && insp.media.length > 0 ? (
        <>
          <SectionHeader title="Photos" />
          <Text style={styles.itemNotes}>{insp.media.length} photo(s) attached.</Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kindTitle: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.text },
  sub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: theme.spacing.xs },
  notes: { color: theme.colors.text, fontSize: theme.text.body, marginTop: theme.spacing.sm },
  confirmWrap: { marginTop: theme.spacing.lg },
  editableHint: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.small,
    marginTop: theme.spacing.sm,
    marginBottom: 0,
  },
  roomCard: { padding: theme.spacing.md },
  itemRow: { paddingVertical: theme.spacing.sm },
  itemInfo: { marginBottom: theme.spacing.xs },
  itemName: { fontSize: theme.text.body, fontWeight: '600', color: theme.colors.text },
  itemNotes: { color: theme.colors.textSubtle, fontSize: theme.text.caption },
  condRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  condBtn: { paddingHorizontal: theme.spacing.sm, minWidth: 34 },
});