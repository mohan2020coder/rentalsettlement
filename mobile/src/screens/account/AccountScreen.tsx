import React, { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { ApiClientError, extractError, mediaUrl, patch, upload } from '../../api/client';
import { UploadRef, User } from '../../api/types';
import { Avatar, Button, Divider, Input, Row, Screen, Tag } from '../../components/ui';
import { RootStackParamList } from '../../navigation/types';
import { theme } from '../../theme';

export default function AccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const photoUri = user.profile_photo ? mediaUrl(user.profile_photo) : null;

  const startEdit = () => {
    setName(user.name);
    setPhone(user.phone ?? '');
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError('Enter your full name');
      return;
    }
    setSaving(true);
    try {
      const updated = await patch<User>('/users/me', {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      updateUser(updated);
      setEditing(false);
    } catch (err) {
      setError(extractError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async () => {
    setError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to add a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset) return;
      setPhotoUploading(true);
      let ref: UploadRef;
      try {
        const form = new FormData();
        if (asset.uri.startsWith('data:')) {
          const blob = await (await fetch(asset.uri)).blob();
          form.append('file', blob, 'photo.jpg');
        } else {
          const mime = asset.mimeType ?? 'image/jpeg';
          const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
          form.append('file', { uri: asset.uri, name: `photo.${ext}`, type: mime } as unknown as Blob);
        }
        ref = await upload<UploadRef>('/storage/upload', form);
        const updated = await patch<User>('/users/me', { name: user.name, photo: ref.file_path });
        updateUser(updated);
      } finally {
        setPhotoUploading(false);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not upload photo');
    }
  };

  const removePhoto = async () => {
    setError(null);
    setPhotoUploading(true);
    try {
      const updated = await patch<User>('/users/me', { name: user.name, photo: '' });
      updateUser(updated);
    } catch (err) {
      setError(extractError(err).message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const busy = saving || photoUploading;

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime with your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen scroll>
      <Text style={styles.pageTitle}>Account</Text>

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Pressable
          onPress={() => void pickPhoto()}
          disabled={photoUploading}
          style={({ pressed }) => [styles.heroPhotoWrap, pressed && { opacity: 0.85 }]}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.heroPhoto} resizeMode="cover" />
          ) : (
            <View style={styles.heroAvatar}>
              <Avatar name={user.name} size={72} />
            </View>
          )}
          <View style={styles.heroCamera}>
            {photoUploading ? (
              <Ionicons name="sync-outline" size={16} color={theme.colors.white} />
            ) : (
              <Ionicons name="camera" size={16} color={theme.colors.white} />
            )}
          </View>
        </Pressable>
        <Text style={styles.heroName}>{user.name}</Text>
        <Text style={styles.heroSub}>{user.email}</Text>
        <View style={styles.heroRoleRow}>
          <Tag label={user.role === 'LANDLORD' ? 'Landlord' : 'Tenant'} color="rgba(255,255,255,0.22)" />
          <Tag label={user.phone ?? 'No phone'} color="rgba(255,255,255,0.12)" />
        </View>
        <Text style={styles.heroHint}>Tap the photo to change your profile picture</Text>
      </View>

      <View style={styles.quickRow}>
        <Pressable style={styles.quickTile} onPress={() => navigation.navigate('Audit', {})}>
          <View style={styles.quickIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
          </View>
          <Text style={styles.quickTitle}>Audit trail</Text>
          <Text style={styles.quickSub}>Your recorded actions</Text>
        </Pressable>
        <Pressable style={styles.quickTile} onPress={() => navigation.navigate('Main', { screen: 'Billing' })}>
          <View style={styles.quickIcon}>
            <Ionicons name="sparkles-outline" size={20} color={theme.colors.primary} />
          </View>
          <Text style={styles.quickTitle}>Plan & usage</Text>
          <Text style={styles.quickSub}>Limits and storage</Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.card}>
          <View style={styles.editHeader}>
            <View style={styles.editIcon}>
              <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.editHeaderCopy}>
              <Text style={styles.editTitle}>Edit profile</Text>
              <Text style={styles.editSub}>Update the details shown to your contacts.</Text>
            </View>
          </View>

          <View style={styles.editPhotoRow}>
            <View style={styles.editPhotoThumb}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.editPhotoThumbImg} resizeMode="cover" />
              ) : (
                <Avatar name={user.name} size={52} />
              )}
            </View>
            <View style={styles.editPhotoActions}>
              <Button
                label={photoUri ? 'Change photo' : 'Add photo'}
                variant="secondary"
                small
                icon="camera-outline"
                onPress={() => void pickPhoto()}
                loading={photoUploading}
                disabled={photoUploading}
              />
              {photoUri ? (
                <Button label="Remove" variant="ghost" small onPress={() => void removePhoto()} disabled={photoUploading} />
              ) : null}
            </View>
          </View>

          <Input label="Full name" value={name} onChangeText={setName} icon="person-outline" />
          <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon="call-outline" />
          <Field label="Email" value={user.email} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Save profile" icon="checkmark-outline" onPress={() => void save()} loading={saving} disabled={photoUploading} />
          <Button label="Cancel" variant="ghost" small onPress={() => setEditing(false)} style={styles.gap} />
        </View>
      ) : (
        <View style={styles.card}>
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone ?? 'Not set'} />
          <Divider />
          <Button label="Edit profile" variant="secondary" icon="create-outline" onPress={startEdit} />
        </View>
      )}

      <View style={styles.logout}>
        <Button label="Sign out" variant="danger" icon="log-out-outline" onPress={confirmSignOut} />
      </View>
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: theme.text.screenTitle, fontWeight: '800', color: theme.colors.text },
  hero: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroPhotoWrap: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    padding: 3,
    marginBottom: theme.spacing.md,
  },
  heroAvatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPhoto: { width: 78, height: 78, borderRadius: 39 },
  heroCamera: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { fontSize: theme.text.heading, fontWeight: '800', color: theme.colors.white },
  heroSub: { fontSize: theme.text.caption, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  heroRoleRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  heroHint: {
    fontSize: theme.text.mini,
    color: 'rgba(255,255,255,0.55)',
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  quickRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  quickTile: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  quickTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  quickSub: { fontSize: theme.text.small, color: theme.colors.textSubtle, marginTop: 1 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  editHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg },
  editIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  editHeaderCopy: { flex: 1 },
  editTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  editSub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 1 },
  editPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  editPhotoThumb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  editPhotoThumbImg: { width: 56, height: 56, borderRadius: 28 },
  editPhotoActions: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  field: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  fieldLabel: { fontSize: theme.text.small, color: theme.colors.textSubtle, fontWeight: '600' },
  fieldValue: { fontSize: theme.text.body, color: theme.colors.text, fontWeight: '600', marginTop: 2 },
  gap: { marginTop: theme.spacing.sm },
  error: { color: theme.colors.danger, fontSize: theme.text.caption, marginBottom: theme.spacing.md },
  logout: { marginTop: theme.spacing.lg },
});