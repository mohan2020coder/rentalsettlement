import React, { useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, del, upload, extractError, mediaUrl } from '../../api/client';
import { ClaimEvidence, DeductionClaim, Dispute } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button, Divider, ErrorView, Input, Lightbox, LoadingView, Row, Screen, ScreenTitle, StatusBadge } from '../../components/ui';
import { formatDate, humanize } from '../../utils/format';
import { theme } from '../../theme';

function isVideo(m: ClaimEvidence): boolean {
  return (m.mime_type || '').toLowerCase().startsWith('video/');
}

export default function ClaimDetailScreen({
  route,
}: RootStackScreenProps<'ClaimDetail'>) {
  const { claimId } = route.params;
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [disputeMode, setDisputeMode] = useState(false);
  const [reason, setReason] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ uris: string[]; index: number } | null>(null);

  const claim = useLoad(async () => get<DeductionClaim>(`/deductions/${claimId}`), [claimId], { refreshOnFocus: true });

  if (claim.loading) return <LoadingView label="Loading claim…" />;
  if (claim.error || !claim.data) {
    return <ErrorView message={claim.error ?? 'Missing'} onRetry={claim.reload} />;
  }

  const c = claim.data;
  const isLandlord = user?.role === 'LANDLORD';
  const isTenant = user?.role === 'TENANT';
  const open = ['PROPOSED', 'DISPUTED', 'COUNTER_OFFERED'].includes(c.status);

  const run = async (label: string, fn: () => Promise<unknown>, reload = true) => {
    setBusy(label);
    try {
      await fn();
      if (reload) claim.reload();
    } catch (err) {
      Alert.alert('Could not complete', extractError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const accept = () => {
    Alert.alert('Accept deduction?', 'Accepting records your agreement to the full claimed amount.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: () => void run('accept', () => post(`/deductions/${claimId}/accept`, {})) },
    ]);
  };

  const submitDispute = () => {
    if (!reason.trim()) {
      Alert.alert('Add a reason', 'Tell the landlord why you are disputing this amount.');
      return;
    }
    void run('dispute', () =>
      post<Dispute>(`/deductions/${claimId}/dispute`, { reason: reason.trim() }),
    ).then(() => setDisputeMode(false));
  };

  const withdraw = () => {
    Alert.alert('Withdraw claim?', 'The claim will return to a withdrawn state.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: () => void run('withdraw', () => post(`/deductions/${claimId}/withdraw`, {})) },
    ]);
  };

  const amount = `${c.currency === 'INR' ? '\u20B9' : c.currency} ${(c.claimed_amount_minor / 100).toLocaleString('en-IN')}`;
  const evidence = c.evidence ?? [];

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

  const attachEvidence = async (isVideo: boolean) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to attach evidence.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: isVideo ? ['videos'] : ['images'],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset) return;

      setUploading(true);
      const { form, mime } = await buildForm(asset, isVideo);
      const ref = await upload<{ file_path: string; mime_type: string; size: number }>('/storage/upload', form);
      await post<ClaimEvidence>(`/deductions/${claimId}/media`, {
        file_path: ref.file_path,
        mime_type: ref.mime_type || mime,
        file_size: ref.size,
        sha256_hash: '',
      });
      claim.reload();
    } catch (err) {
      Alert.alert('Could not attach evidence', extractError(err).message);
    } finally {
      setUploading(false);
    }
  };

  const chooseEvidence = () => {
    Alert.alert('Add evidence', 'Attach photos or videos that support this claim.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Photo', onPress: () => void attachEvidence(false) },
      { text: 'Video', onPress: () => void attachEvidence(true) },
    ]);
  };

  const openEvidence = (m: ClaimEvidence) => {
    const uri = mediaUrl(m.file_path);
    if (!uri) return;
    if (isVideo(m)) {
      void Linking.openURL(uri);
      return;
    }
    const list = evidence.filter((x) => !isVideo(x));
    const index = list.findIndex((x) => x.id === m.id);
    const uris = list.map((x) => mediaUrl(x.file_path) ?? '');
    setPreview({ uris: uris.filter(Boolean), index: Math.max(index, 0) });
  };

  const removeEvidence = (m: ClaimEvidence) => {
    Alert.alert('Remove evidence?', 'This file will be removed from the claim for both parties.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setDeleting(m.id);
          del(`/deductions/${claimId}/media/${m.id}`)
            .then(() => claim.reload())
            .catch((err) => Alert.alert('Could not remove', extractError(err).message))
            .finally(() => setDeleting(null));
        },
      },
    ]);
  };

  return (
    <Screen scroll keyboard>
      <ScreenTitle title="Deduction Claim" />
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.amountWrap}>
            <Text style={styles.category}>{c.category.replace(/_/g, ' ')}</Text>
            <Text style={styles.amount}>{amount}</Text>
            <Text style={styles.sub}>Proposed {formatDate(c.created_at)}</Text>
          </View>
          <StatusBadge label={humanize(c.status)} />
        </View>
        {c.description ? <Text style={styles.desc}>{c.description}</Text> : null}

        <Divider />
        <Row label="Claimed amount" value={amount} />
        <Row label="Category" value={c.category.replace(/_/g, ' ')} />
        <Row label="Status" value={humanize(c.status)} />
      </View>

      <View style={styles.evidenceCard}>
        <View style={styles.evidenceHead}>
          <Ionicons name="images-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.evidenceTitle}>Evidence</Text>
          {evidence.length > 0 ? <Text style={styles.evidenceCount}>{evidence.length}</Text> : null}
        </View>
        <Text style={styles.evidenceSub}>
          {evidence.length === 0
            ? 'Attach move-in / move-out photos and quotations so the claim is clear for both parties.'
            : 'Photos and videos backing this claim.'}
        </Text>
        {evidence.length > 0 ? (
          <View style={styles.evidenceGrid}>
            {evidence.map((m) => (
              <Pressable key={m.id} style={styles.evidenceTile} onPress={() => openEvidence(m)}>
                {isVideo(m) ? (
                  <View style={styles.videoTile}>
                    <Ionicons name="videocam" size={24} color={theme.colors.white} />
                    <Text style={styles.videoTileText}>Video</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: mediaUrl(m.file_path) ?? undefined }}
                    style={styles.evidenceImage}
                    resizeMode="cover"
                  />
                )}
                <Pressable
                  style={styles.removeBtn}
                  hitSlop={8}
                  onPress={() => removeEvidence(m)}
                  disabled={deleting !== null}
                >
                  {deleting === m.id ? (
                    <Ionicons name="hourglass-outline" size={12} color={theme.colors.white} />
                  ) : (
                    <Ionicons name="close" size={12} color={theme.colors.white} />
                  )}
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.evidenceActions}>
          <Button
            label={uploading ? 'Uploading…' : 'Add evidence'}
            variant="ghost"
            small
            icon="cloud-upload-outline"
            onPress={chooseEvidence}
            loading={uploading}
            disabled={uploading}
          />
        </View>
      </View>

      {isTenant && c.status === 'PROPOSED' && (
        <View style={styles.evidenceCard}>
          <Button label="Accept the full deduction" icon="checkmark-circle-outline" onPress={accept} loading={busy === 'accept'} />
          <Button
            label="Open a dispute instead"
            variant="secondary"
            icon="chatbubble-ellipses-outline"
            onPress={() => setDisputeMode(true)}
            style={styles.gap}
          />
        </View>
      )}

      {isTenant && disputeMode && (
        <View style={styles.evidenceCard}>
          <Input
            label="Why are you disputing this?"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            placeholder="Explain your reasons…"
            style={styles.multiline}
          />
          <Button label="Submit dispute" onPress={submitDispute} loading={busy === 'dispute'} />
        </View>
      )}

      {isLandlord && open && (
        <View style={styles.evidenceCard}>
          <Button label="Withdraw this claim" variant="danger" icon="close-circle-outline" onPress={withdraw} loading={busy === 'withdraw'} />
        </View>
      )}

      {(c.status === 'AGREED' || c.status === 'ACCEPTED') && (
        <View style={styles.agreedCard}>
          <Ionicons name="checkmark-done-circle-outline" size={22} color={theme.colors.success} />
          <Text style={styles.agreed}>
            This deduction is agreed and will be included in the settlement statement.
          </Text>
        </View>
      )}

      <Lightbox
        visible={!!preview}
        uris={preview?.uris ?? []}
        initialIndex={preview?.index ?? 0}
        onClose={() => setPreview(null)}
      />
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
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  amountWrap: { flex: 1, paddingRight: theme.spacing.md },
  category: {
    fontSize: theme.text.small,
    fontWeight: '700',
    color: theme.colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  amount: { fontSize: 24, fontWeight: '800', color: theme.colors.text, marginTop: 6 },
  sub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 4 },
  desc: { color: theme.colors.text, fontSize: theme.text.body, marginTop: theme.spacing.md },
  evidenceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  evidenceTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  evidenceHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  evidenceCount: {
    fontSize: theme.text.small,
    fontWeight: '700',
    color: theme.colors.textSubtle,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  evidenceSub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  evidenceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  evidenceTile: {
    width: 92,
    height: 92,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  evidenceImage: { width: '100%', height: '100%' },
  videoTile: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1A1F35',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  videoTileText: { color: theme.colors.white, fontSize: 9, fontWeight: '700' },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evidenceActions: { marginTop: theme.spacing.md },
  gap: { marginTop: theme.spacing.sm },
  multiline: { height: 90, textAlignVertical: 'top' },
  agreedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.successBg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#C6ECDC',
    padding: theme.spacing.lg,
  },
  agreed: { color: theme.colors.success, fontSize: theme.text.body, fontWeight: '600', flex: 1 },
});