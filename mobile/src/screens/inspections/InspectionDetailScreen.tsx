import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, put, upload, extractError, mediaUrl } from '../../api/client';
import { Inspection, InspectionItem, InspectionMedia, SaveItemPayload, UploadRef } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button, ErrorView, Lightbox, LoadingView, Pill, Screen, SectionHeader, StatusBadge } from '../../components/ui';
import { CONDITION_COLORS, formatDateTime, humanize } from '../../utils/format';
import { theme } from '../../theme';

const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'NOT_PRESENT'];

function isVideo(m: InspectionMedia): boolean {
  return (m.mime_type || '').toLowerCase().startsWith('video/');
}

export default function InspectionDetailScreen({
  route,
}: RootStackScreenProps<'InspectionDetail'>) {
  const { inspectionId } = route.params;
  const { user } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ uris: string[]; index: number } | null>(null);

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
  const rooms = insp.rooms ?? [];
  const media = insp.media ?? [];

  const roomMediaOf = (roomId: string) => media.filter((m) => m.room_id === roomId && !m.item_id);
  const itemMediaOf = (itemId: string) => media.filter((m) => m.item_id === itemId);

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

  const buildForm = async (
    asset: ImagePicker.ImagePickerAsset,
    isVideo: boolean,
  ): Promise<{ form: FormData; mime: string }> => {
    const mime = asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg');
    const ext = (mime.split('/')[1] || (isVideo ? 'mp4' : 'jpg')).replace('jpeg', 'jpg');
    const form = new FormData();
    if (asset.uri.startsWith('data:')) {
      const blob = await (await fetch(asset.uri)).blob();
      form.append('file', blob, `media.${ext}`);
    } else {
      form.append('file', { uri: asset.uri, name: `media.${ext}`, type: mime } as unknown as Blob);
    }
    return { form, mime };
  };

  const attachMedia = async (scope: { roomId?: string; itemId?: string }, isVideo: boolean) => {
    if (!canEdit) return;
    const scopeKey = scope.itemId ? `item:${scope.itemId}` : `room:${scope.roomId}`;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to attach inspection media.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: isVideo ? ['videos'] : ['images'],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset) return;

      setUploading(scopeKey);
      const { form, mime } = await buildForm(asset, isVideo);
      const ref = await upload<UploadRef>('/storage/upload', form);
      await post<InspectionMedia>(`/inspections/${inspectionId}/media`, {
        room_id: scope.roomId ?? undefined,
        item_id: scope.itemId ?? undefined,
        file_path: ref.file_path,
        mime_type: ref.mime_type || mime,
        file_size: ref.size,
        sha256_hash: '',
      });
      inspection.reload();
      Alert.alert('Attached', isVideo ? 'Video attached to the inspection.' : 'Photo attached to the inspection.');
    } catch (err) {
      Alert.alert('Could not attach media', extractError(err).message);
    } finally {
      setUploading(null);
    }
  };

  const chooseMediaSource = (scope: { roomId?: string; itemId?: string }) => {
    if (!canEdit) {
      Alert.alert('Read-only', 'You can only add media while the inspection is a draft.');
      return;
    }
    Alert.alert('Attach photo or video', 'Where is this evidence from?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Photo', onPress: () => void attachMedia(scope, false) },
      { text: 'Video', onPress: () => void attachMedia(scope, true) },
    ]);
  };

  const openGallery = (list: InspectionMedia[], index = 0) => {
    const uris = list.filter((m) => !isVideo(m)).map((m) => mediaUrl(m.file_path) ?? '');
    if (uris.length) {
      setPreview({ uris: uris.filter(Boolean), index });
    }
  };

  const openMedia = (m: InspectionMedia) => {
    const uri = mediaUrl(m.file_path);
    if (!uri) return;
    if (isVideo(m)) {
      void Linking.openURL(uri);
      return;
    }
    const list = media.filter((x) => !isVideo(x));
    const index = list.findIndex((x) => x.id === m.id);
    openGallery(list, Math.max(index, 0));
  };

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
            Tap a room to expand it, set item conditions and attach photos or videos.
          </Text>
          {rooms.map((room, roomIndex) => {
            const expanded = expandedRooms[room.id] ?? roomIndex === 0;
            const itemCount = room.items?.length ?? 0;
            const roomMedia = roomMediaOf(room.id);
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
                      {roomMedia.length > 0 ? ` · ${roomMedia.length} media` : ''}
                    </Text>
                  </View>
                  {canEdit ? (
                    <View style={styles.mediaActions}>
                      <Pressable
                        style={styles.mediaAction}
                        hitSlop={8}
                        disabled={uploading !== null}
                        onPress={(e) => {
                          e.stopPropagation();
                          chooseMediaSource({ roomId: room.id });
                        }}
                      >
                        {uploading === `room:${room.id}` ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : (
                          <Ionicons name="camera-outline" size={18} color={theme.colors.primary} />
                        )}
                      </Pressable>
                      <Pressable
                        style={styles.mediaAction}
                        hitSlop={8}
                        disabled={uploading !== null}
                        onPress={(e) => {
                          e.stopPropagation();
                          chooseMediaSource({ roomId: room.id });
                        }}
                      >
                        <Ionicons name="videocam-outline" size={18} color={theme.colors.primary} />
                      </Pressable>
                    </View>
                  ) : null}
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.colors.textSubtle}
                  />
                </View>

                {roomMedia.length > 0 ? (
                  <MediaStrip items={roomMedia} onOpen={openMedia} />
                ) : null}

                {expanded ? (
                  <View style={styles.itemsWrap}>
                    {itemCount === 0 ? (
                      <Text style={styles.itemNotes}>No items recorded for this room.</Text>
                    ) : (
                      (room.items ?? []).map((item) => {
                        const cond = item.condition ?? 'NOT_PRESENT';
                        const condColor = CONDITION_COLORS[cond] ?? theme.colors.textSubtle;
                        const isOpen = openItem === item.id;
                        const itemMedia = itemMediaOf(item.id);
                        return (
                          <View key={item.id}>
                            <Pressable
                              style={styles.itemRow}
                              onPress={() => canEdit && setOpenItem(isOpen ? null : item.id)}
                              disabled={!canEdit}
                            >
                              <View style={styles.itemNameWrap}>
                                <Text style={styles.itemName}>{item.name}</Text>
                                {itemMedia.length > 0 ? (
                                  <View style={styles.itemMediaCount}>
                                    <Ionicons name="images-outline" size={11} color={theme.colors.primary} />
                                    <Text style={styles.itemMediaCountText}>{itemMedia.length}</Text>
                                  </View>
                                ) : null}
                              </View>
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
                            {itemMedia.length > 0 ? (
                              <MediaStrip items={itemMedia} onOpen={openMedia} />
                            ) : null}
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
                                <View style={styles.itemAttachRow}>
                                  <Pill label="Photo" active={false} onPress={() => chooseMediaSource({ roomId: room.id, itemId: item.id })} />
                                  <Pill label="Video" active={false} onPress={() => chooseMediaSource({ roomId: room.id, itemId: item.id })} />
                                </View>
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

      {media.length > 0 ? (
        <View style={styles.mediaCard}>
          <View style={styles.mediaHead}>
            <Ionicons name="images-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.mediaTitle}>Photos & videos</Text>
            <Text style={styles.mediaCount}>{media.length}</Text>
          </View>
          <View style={styles.galleryGrid}>
            {media.map((m) => (
              <Pressable key={m.id} style={styles.galleryTile} onPress={() => openMedia(m)}>
                <MediaThumb m={m} size={96} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {canEdit ? (
        <View style={styles.tipCard}>
          <Ionicons name="camera-outline" size={15} color={theme.colors.textSubtle} />
          <Text style={styles.tipText}>
            Attach photos to a room or to a specific item so both parties can review the same
            evidence.
          </Text>
        </View>
      ) : null}

      <Lightbox
        visible={!!preview}
        uris={preview?.uris ?? []}
        initialIndex={preview?.index ?? 0}
        onClose={() => setPreview(null)}
      />
    </Screen>
  );
}

function MediaThumb({ m, size = 56 }: { m: InspectionMedia; size?: number }) {
  const uri = mediaUrl(m.file_path);
  if (!uri) return null;
  if (!isVideo(m)) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 10 }} resizeMode="cover" />;
  }
  return (
    <View style={[styles.videoTile, { width: size, height: size }]}>
      <Ionicons name="videocam" size={size * 0.32} color={theme.colors.white} />
      <Text style={styles.videoTileText}>Video</Text>
    </View>
  );
}

function MediaStrip({ items, onOpen }: { items: InspectionMedia[]; onOpen: (m: InspectionMedia) => void }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 4);
  const extra = items.length - shown.length;
  return (
    <View style={styles.stripWrap}>
      {shown.map((m) => (
        <Pressable key={m.id} onPress={() => onOpen(m)} style={styles.stripThumb}>
          <MediaThumb m={m} />
        </Pressable>
      ))}
      {extra > 0 ? (
        <View style={styles.stripExtra}>
          <Text style={styles.stripExtraText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
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
  mediaActions: { flexDirection: 'row', gap: theme.spacing.xs },
  mediaAction: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsWrap: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: theme.spacing.md, paddingTop: theme.spacing.xs },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  itemNameWrap: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexShrink: 1 },
  itemName: { fontSize: theme.text.body, fontWeight: '600', color: theme.colors.text, flexShrink: 1 },
  itemMediaCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  itemMediaCountText: { fontSize: theme.text.small, fontWeight: '700', color: theme.colors.primary },
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
  itemAttachRow: { flexDirection: 'row', gap: theme.spacing.xs, marginLeft: 'auto' },
  itemNotes: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 4 },
  stripWrap: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  stripThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  stripExtra: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripExtraText: { fontSize: theme.text.body, fontWeight: '800', color: theme.colors.primary },
  videoTile: {
    backgroundColor: '#1A1F35',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    gap: 2,
  },
  videoTileText: { color: theme.colors.white, fontSize: 9, fontWeight: '700' },
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
  mediaTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text, flex: 1 },
  mediaCount: {
    fontSize: theme.text.small,
    fontWeight: '700',
    color: theme.colors.textSubtle,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  galleryTile: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  tipText: { color: theme.colors.textSubtle, fontSize: theme.text.caption, flex: 1, lineHeight: 17 },
});