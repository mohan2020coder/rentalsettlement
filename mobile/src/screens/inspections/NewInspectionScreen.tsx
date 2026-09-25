import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { post, get, extractError } from '../../api/client';
import { Inspection, InspectionTemplate } from '../../api/types';
import { useLoad } from '../../hooks';
import { Button, ErrorView, Input, LoadingView, Pill, Screen } from '../../components/ui';
import { humanize } from '../../utils/format';
import { theme } from '../../theme';

export default function NewInspectionScreen({
  route,
  navigation,
}: RootStackScreenProps<'NewInspection'>) {
  const { tenancyId, kind } = route.params;
  const [notes, setNotes] = useState('');
  const [rooms, setRooms] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tpl = useLoad<InspectionTemplate>(
    async () =>
      get<InspectionTemplate>(`/inspections/tenancy/${tenancyId}/template?kind=${kind}`),
    [tenancyId, kind],
  );

  if (tpl.loading) return <LoadingView label="Preparing the checklist…" />;
  if (tpl.error || !tpl.data) {
    return <ErrorView message={tpl.error ?? 'Missing'} onRetry={tpl.reload} />;
  }

  const template = tpl.data;
  const reused = template.reused_from_move_in && kind === 'MOVE_OUT';
  const toggle = (name: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const included = template.rooms.filter((r) => !excluded.has(r.name));
  const unitType = template.bedrooms
    ? `${template.bedrooms} BHK`
    : humanize(template.property_type);

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
        exclude_rooms: excluded.size ? Array.from(excluded) : undefined,
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
        {kind === 'MOVE_IN' ? 'Start Move-In Inspection' : 'Start Move-Out Inspection'}
      </Text>
      <Text style={styles.hint}>
        {kind === 'MOVE_IN'
          ? 'A move-in report is created from the rooms of this unit so the checklist matches the property.'
          : reused
            ? 'The move-out report reuses the move-in checklist and adds a departure checklist — no need to pick rooms again.'
            : 'A move-out report is created from the rooms of this unit and adds a departure checklist.'}
      </Text>

      <View style={styles.unitCard}>
        <View style={styles.unitIcon}>
          <Ionicons name="home-outline" size={18} color={theme.colors.primary} />
        </View>
        <View style={styles.unitCopy}>
          <Text style={styles.unitName}>{template.property_name}</Text>
          <View style={styles.unitMeta}>
            <Text style={styles.unitType}>{unitType}</Text>
            {template.furnishing_status ? (
              <Text style={styles.unitType}>· {humanize(template.furnishing_status)}</Text>
            ) : null}
          </View>
        </View>
        <Pill label={reused ? 'reuses move-in' : `${included.length} rooms`} active={!reused} />
      </View>

      {reused ? (
        <>
          <View style={styles.reuseCard}>
            <Ionicons name="git-branch-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.reuseText}>
              The rooms and items already recorded at move-in will be carried over, plus a departure
              checklist. You can still add new rooms and notes after starting.
            </Text>
          </View>
          <View style={styles.reuseRooms}>
            {template.rooms.map((room) => (
              <View key={room.name} style={styles.reuseRoom}>
                <Ionicons name="checkmark-circle-outline" size={15} color={theme.colors.success} />
                <Text style={styles.reuseRoomName}>{room.name}</Text>
                <Text style={styles.reuseRoomMeta}>
                  {room.items.length} {room.items.length === 1 ? 'item' : 'items'}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <>
          {template.rooms.length > 0 && (
            <Text style={styles.sectionLabel}>Rooms in this unit</Text>
          )}
          {template.rooms.length === 0 ? (
            <Text style={styles.hint}>No rooms found for this unit.</Text>
          ) : (
            template.rooms.map((room) => {
              const selected = !excluded.has(room.name);
              return (
                <Pressable
                  key={room.name}
                  style={[styles.roomRow, !selected && styles.roomRowOff]}
                  onPress={() => toggle(room.name)}
                >
                  <Ionicons
                    name={selected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={selected ? theme.colors.primary : theme.colors.border}
                  />
                  <View style={styles.roomRowCopy}>
                    <Text style={[styles.roomName, !selected && styles.roomNameOff]}>{room.name}</Text>
                    <Text style={styles.roomItems}>
                      {room.items.length} {room.items.length === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                  {selected ? (
                    <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.textSubtle} />
                  ) : (
                    <Text style={styles.skipped}>skipped</Text>
                  )}
                </Pressable>
              );
            })
          )}
        </>
      )}

      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        placeholder="Optional notes for this inspection"
        style={styles.multiline}
        icon="create-outline"
      />
      {!reused ? (
        <Input
          label="Extra rooms (comma separated, optional)"
          value={rooms}
          onChangeText={setRooms}
          placeholder="Store room, Terrace"
          icon="add-circle-outline"
        />
      ) : null}

      {!reused && excluded.size > 0 ? <AlertCallout count={excluded.size} /> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label={
          kind === 'MOVE_IN'
            ? included.length === 0
              ? 'Every room was skipped'
              : `Start move-in inspection${included.length ? ` (${included.length} rooms)` : ''}`
            : 'Start move-out inspection'
        }
        icon={kind === 'MOVE_IN' ? 'log-in-outline' : 'log-out-outline'}
        onPress={() => void submit()}
        loading={submitting}
        disabled={!reused && included.length === 0}
      />
    </Screen>
  );
}

function AlertCallout({ count }: { count: number }) {
  return (
    <View style={styles.alertRow}>
      <Ionicons name="information-circle-outline" size={15} color={theme.colors.warning} />
      <Text style={styles.alertText}>
        {count} {count === 1 ? 'room is' : 'rooms are'} skipped from the checklist. You can add them
        back anytime while the inspection is a draft.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: theme.text.screenTitle, fontWeight: '800', color: theme.colors.text },
  hint: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  unitCard: {
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
  unitIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitCopy: { flex: 1, minWidth: 0 },
  unitName: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  unitMeta: { flexDirection: 'row', gap: 4, marginTop: 2 },
  unitType: { fontSize: theme.text.small, color: theme.colors.textSubtle },
  sectionLabel: {
    fontSize: theme.text.body,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  roomRowOff: { opacity: 0.55, backgroundColor: theme.colors.background },
  roomRowCopy: { flex: 1, minWidth: 0 },
  roomName: { fontSize: theme.text.body, fontWeight: '600', color: theme.colors.text },
  roomNameOff: { color: theme.colors.textSubtle },
  roomItems: { fontSize: theme.text.small, color: theme.colors.textSubtle, marginTop: 1 },
  skipped: {
    fontSize: theme.text.small,
    fontWeight: '700',
    color: theme.colors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  reuseCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  reuseText: { color: theme.colors.text, fontSize: theme.text.caption, flex: 1, lineHeight: 17 },
  reuseRooms: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  reuseRoom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 6,
  },
  reuseRoomName: { flex: 1, fontSize: theme.text.body, fontWeight: '600', color: theme.colors.text },
  reuseRoomMeta: { fontSize: theme.text.small, color: theme.colors.textSubtle },
  multiline: { height: 90, textAlignVertical: 'top' },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: theme.colors.warningBg,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  alertText: { color: theme.colors.warning, fontSize: theme.text.caption, flex: 1, lineHeight: 17 },
  error: { color: theme.colors.danger, fontSize: theme.text.caption, marginBottom: theme.spacing.md },
});