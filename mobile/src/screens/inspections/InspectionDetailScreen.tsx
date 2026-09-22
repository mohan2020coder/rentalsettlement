import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, put, extractError } from '../../api/client';
import { Inspection, InspectionItem, SaveItemPayload } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button, ErrorView, LoadingView, Pill, Screen, SectionHeader, StatusBadge } from '../../components/ui';
import { CONDITION_COLORS, formatDateTime, humanize } from '../../utils/format';
import { theme } from '../../theme';

const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'NOT_PRESENT'];

export default function InspectionDetailScreen({
  route,
}: RootStackScreenProps<'InspectionDetail'>) {
  const { inspectionId } = route.params;
  const { user } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});
  const [openItem, setOpenItem] = useState<string | null>(null);

  const inspection = useLoad(async () => get<Inspection>(`/inspections/${inspectionId}`), [
    inspectionId,
  ], { refreshOnFocus: true });

  if (inspection.loading) return <LoadingView label="Loading inspection…" />;
  if (inspection.error || !inspection.data) {
    return <ErrorView message={inspection.error ?? 'Missing'} onRetry={inspection.reload} />;
  }

  const insp = inspection.data;
  const canEdit = insp.status === 'DRAFT' || insp.status === 'PENDING_CONFIRMATION';
  const alreadyConfirmed = (insp.confirmed_by ?? []).includes(user?.id ?? '');
  const canConfirm = insp.status !== 'CONFIRMED' && !alreadyConfirmed;
  const kindLabel = insp.kind === 'MOVE_IN' ? 'Move-In Inspection' : 'Move-Out Inspection';

  const saveItem = async (item: InspectionItem, roomId: string, payload: SaveItemPayload) => {
    setSaving(item.id);
    try {
      await put<InspectionItem>(`/inspections/${inspectionId}/rooms/${roomId}/items/${item.id}`, payload);
      inspection.reload();
      setOpenItem(null);
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

  const rooms = insp.rooms ?? [];

  return (
    <Screen scroll refreshing={inspection.loading} onRefresh={inspection.reload}>
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.headerIcon}>
            <Ionicons
              name={insp.kind === 'MOVE_IN' ? 'log-in-outline' : 'log-out-outline'}
              size={22}
              color={insp.kind === 'MOVE_IN' ? theme.colors.success : theme.colors.warning}
            />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{kindLabel}</Text>
            <Text style={styles.sub}>Started {formatDateTime(insp.created_at)}</Text>
          </View>
          <StatusBadge label={humanize(insp.status)} />
        </View>
        {insp.notes ? <Text style={styles.notes}>{insp.notes}</Text> : null}
        {canConfirm && (
          <View style={styles.confirmWrap}>
            <Button label="Confirm this inspection" icon="checkmark-circle-outline" onPress={() => void confirm()} loading={confirming} />
          </View>
        )}
      </View>

      {rooms.length > 0 ? (
        <>
          <SectionHeader title="Rooms & items" />
          <Text style={styles.hint}>
            Tap a room to expand it, then tap an item to set its condition.
          </Text>
          {rooms.map((room, roomIndex) => {
            const expanded = expandedRooms[room.id] ?? roomIndex === 0;
            const itemCount = room.items?.length ?? 0;
            return (
              <Pressable
                key={room.id}
                style={styles.roomCard}
                onPress={() => setExpandedRooms((s) => ({ ...s, [room.id]: !expanded }))}
              >
                <View style={styles.roomHead}>
                  <View style={styles.roomIcon}>
                    <Ionicons name="bed-outline" size={16} color={theme.colors.primary} />
                  </View>
                  <View style={styles.roomCopy}>
                    <Text style={styles.roomName}>{room.name}</Text>
                    <Text style={styles.roomCount}>
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.colors.textSubtle}
                  />
                </View>

                {expanded ? (
                  <View style={styles.itemsWrap}>
                    {itemCount === 0 ? (
                      <Text style={styles.itemNotes}>No items recorded for this room.</Text>
                    ) : (
                      (room.items ?? []).map((item) => {
                        const cond = item.condition ?? 'NOT_PRESENT';
                        const condColor = CONDITION_COLORS[cond] ?? theme.colors.textSubtle;
                        const isOpen = openItem === item.id;
                        return (
                          <View key={item.id}>
                            <Pressable
                              style={styles.itemRow}
                              onPress={() => canEdit && setOpenItem(isOpen ? null : item.id)}
                              disabled={!canEdit}
                            >
                              <Text style={styles.itemName}>{item.name}</Text>
                              <View style={[styles.condPill, { backgroundColor: `${condColor}1A` }]}>
                                <View style={[styles.condDot, { backgroundColor: condColor }]} />
                                <Text style={[styles.condText, { color: condColor }]}>
                                  {humanize(cond)}
                                </Text>
                                {canEdit ? (
                                  <Ionicons name="chevron-down" size={12} color={condColor} />
                                ) : null}
                              </View>
                            </Pressable>
                            {isOpen && canEdit ? (
                              <View style={styles.condRow}>
                                {CONDITIONS.map((c) => (
                                  <Pill
                                    key={c}
                                    label={c === 'NOT_PRESENT' ? 'N/A' : c.charAt(0).toUpperCase()}
                                    active={cond === c}
                                    onPress={() =>
                                      void saveItem(item, room.id, {
                                        condition: c,
                                        notes: item.notes ?? '',
                                      })
                                    }
                                  />
                                ))}
                              </View>
                            ) : null}
                            {!canEdit && item.notes ? (
                              <Text style={styles.itemNotes}>{item.notes}</Text>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </>
      ) : (
        <View style={styles.roomCard}>
          <Text style={styles.itemNotes}>No rooms recorded yet.</Text>
        </View>
      )}

      {insp.media && insp.media.length > 0 ? (
        <View style={styles.mediaCard}>
          <View style={styles.mediaHead}>
            <Ionicons name="images-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.mediaTitle}>Photos</Text>
          </View>
          <Text style={styles.itemNotes}>{insp.media.length} photo(s) attached to this report.</Text>
        </View>
      ) : null}
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
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  headerCopy: { flex: 1, minWidth: 0 },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: theme.text.body, fontWeight: '800', color: theme.colors.text },
  sub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  notes: { color: theme.colors.text, fontSize: theme.text.body, marginTop: theme.spacing.md },
  confirmWrap: { marginTop: theme.spacing.lg },
  hint: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.small,
    marginBottom: theme.spacing.sm,
    marginTop: -2,
  },
  roomCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  roomHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  roomIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCopy: { flex: 1, minWidth: 0 },
  roomName: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  roomCount: { fontSize: theme.text.small, color: theme.colors.textSubtle, marginTop: 1 },
  itemsWrap: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: theme.spacing.md, paddingTop: theme.spacing.xs },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  itemName: { fontSize: theme.text.body, fontWeight: '600', color: theme.colors.text, flexShrink: 1 },
  condPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  condDot: { width: 6, height: 6, borderRadius: 3 },
  condText: {
    fontSize: theme.text.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  condRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  itemNotes: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 4 },
  mediaCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  mediaHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  mediaTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
});