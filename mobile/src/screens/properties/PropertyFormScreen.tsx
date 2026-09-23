import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, patch, upload, mediaUrl, extractError, ApiClientError } from '../../api/client';
import { Property, UploadRef } from '../../api/types';
import { useLoad } from '../../hooks';
import { Button, Card, ErrorView, Input, Lightbox, LoadingView, Screen, StatusBadge } from '../../components/ui';
import { theme } from '../../theme';

const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'VILLA', 'PG', 'OTHER'] as const;
const FURNISHING = ['FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED'] as const;
const MAX_PHOTOS = 8;

export default function PropertyFormScreen({ route, navigation }: RootStackScreenProps<'PropertyForm'>) {
  const editing = !!route.params?.propertyId;
  const initial = route.params?.initial;
  const existing = useLoad(
    async () => (route.params?.propertyId ? get<Property>(`/properties/${route.params.propertyId}`) : Promise.resolve(null)),
    [route.params?.propertyId],
  );

  const [name, setName] = useState('');
  const [type, setType] = useState<string>('APARTMENT');
  const [address, setAddress] = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postal, setPostal] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [furnishing, setFurnishing] = useState<string>('SEMI_FURNISHED');
  const [description, setDescription] = useState('');
  const [listed, setListed] = useState(false);
  const [rent, setRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (initial) {
      applyProperty(initial);
    }
  }, [initial]);

  React.useEffect(() => {
    if (existing.data) {
      applyProperty(existing.data);
    }
  }, [existing.data]);

  const applyProperty = (p: Property) => {
    setName(p.property_name);
    setType(p.property_type);
    setAddress(p.address_line1 ?? '');
    setLocality(p.locality ?? '');
    setCity(p.city ?? '');
    setState(p.state ?? '');
    setPostal(p.postal_code ?? '');
    setBedrooms(p.bedrooms ? String(p.bedrooms) : '');
    setBathrooms(p.bathrooms ? String(p.bathrooms) : '');
    setFurnishing(p.furnishing_status ?? 'SEMI_FURNISHED');
    setDescription(p.description ?? '');
    setListed(p.listed);
    setRent(minorToRupees(p.monthly_rent_minor));
    setDeposit(minorToRupees(p.security_deposit_minor));
    const gallery = p.photos?.length ? p.photos : p.photo ? [p.photo] : [];
    setPhotos(gallery);
  };

  if (editing && !initial && existing.loading) return <LoadingView label="Loading property…" />;
  if (editing && !initial && existing.error) return <ErrorView message={existing.error} onRetry={existing.reload} />;

  const toMinor = (rupees: string): number => {
    const n = parseFloat(rupees);
    return Number.isNaN(n) ? 0 : Math.round(n * 100);
  };

  const minorToRupees = (minor?: number): string => {
    const n = (minor ?? 0) / 100;
    return n % 1 === 0 ? String(n) : n.toFixed(2);
  };

  const pickAndUpload = async () => {
    setError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to add property pictures.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset) return;
      setPhotoUploading(true);
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
        const ref = await upload<UploadRef>('/storage/upload', form);
        setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, ref.file_path]));
      } finally {
        setPhotoUploading(false);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not upload photo');
    }
  };

  const removePhoto = (key: string) => {
    setPhotos((prev) => prev.filter((k) => k !== key));
  };

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError('Enter a property name');
      return;
    }
    if (listed && toMinor(rent) <= 0) {
      setError('Set a monthly rent before listing this property on the marketplace');
      return;
    }
    const payload = {
      property_name: name.trim(),
      property_type: type,
      address_line1: address || undefined,
      locality: locality || undefined,
      city: city || undefined,
      state: state || undefined,
      postal_code: postal || undefined,
      bedrooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
      bathrooms: bathrooms ? parseInt(bathrooms, 10) : undefined,
      furnishing_status: furnishing,
      description: description || undefined,
      photos,
      photo: photos[0] ?? null,
      listed,
      monthly_rent_minor: toMinor(rent),
      security_deposit_minor: toMinor(deposit),
      currency: 'INR',
    };
    setSubmitting(true);
    try {
      if (route.params?.propertyId) {
        await patch<Property>(`/properties/${route.params.propertyId}`, payload);
      } else {
        await post<Property>('/properties', payload);
      }
      Alert.alert('Saved', 'Property details saved.');
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not save property');
    } finally {
      setSubmitting(false);
    }
  };

  const segmented = (options: readonly string[], value: string, onChange: (v: string) => void) => (
    <View style={styles.tags}>
      {options.map((o) => (
        <Button
          key={o}
          label={o.replace(/_/g, ' ')}
          variant={value === o ? 'primary' : 'ghost'}
          small
          onPress={() => onChange(o)}
        />
      ))}
    </View>
  );

  const editingContext = existing.data;
  const photoUris = photos.map((key) => mediaUrl(key)).filter((u): u is string => !!u);

  const listSwitch = (
    <Card style={listed ? styles.listCardActive : styles.listCard}>
      <View style={styles.listRow}>
        <View style={styles.listInfo}>
          <Text style={styles.listTitle}>List on marketplace</Text>
          <Text style={styles.listSub}>Tenants can browse and request this property.</Text>
        </View>
        <Switch
          value={listed}
          onValueChange={setListed}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          thumbColor={theme.colors.white}
        />
      </View>
      {listed ? (
        <View style={styles.listFields}>
          <View style={styles.row}>
            <View style={styles.col}>
              <Input
                label="Monthly rent (₹)"
                value={rent}
                onChangeText={setRent}
                keyboardType="decimal-pad"
                placeholder="30000"
              />
            </View>
            <View style={styles.col}>
              <Input
                label="Deposit (₹)"
                value={deposit}
                onChangeText={setDeposit}
                keyboardType="decimal-pad"
                placeholder="100000"
              />
            </View>
          </View>
          <Text style={styles.listHint}>
            The property stays reserved once a request is approved.
          </Text>
        </View>
      ) : null}
    </Card>
  );

  return (
    <Screen keyboard scroll>
      <Text style={styles.pageTitle}>{editing ? 'Edit property' : 'New property'}</Text>
      {editingContext ? (
        <View style={styles.contextBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.contextName} numberOfLines={1}>
              {editingContext.property_name}
            </Text>
            <Text style={styles.contextLocation}>
              {[editingContext.locality, editingContext.city, editingContext.state].filter(Boolean).join(', ') ||
                'Location not set'}
            </Text>
          </View>
          <StatusBadge label={editingContext.status.replace(/_/g, ' ')} />
        </View>
      ) : null}

      <Text style={styles.label}>Property type</Text>
      {segmented(PROPERTY_TYPES, type, setType)}

      <Input label="Property name" value={name} onChangeText={setName} placeholder="E.g. Lakeview Apartment, 2BHK" />

      <View style={styles.photoSection}>
        <View style={styles.photoHeader}>
          <Text style={styles.label}>Photos</Text>
          <Text style={styles.photoCount}>
            {photos.length}/{MAX_PHOTOS}
          </Text>
        </View>
        <Text style={styles.photoHint}>The first photo is used as the cover. Add up to {MAX_PHOTOS}.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStrip}>
          {photos.map((key, idx) => (
            <Pressable key={key} style={({ pressed }) => [styles.photoTile, pressed && { opacity: 0.85 }]} onPress={() => setPreviewIndex(idx)}>
              <Image source={{ uri: mediaUrl(key) ?? undefined }} style={styles.photoThumb} resizeMode="cover" />
              {idx === 0 ? (
                <View style={styles.coverBadge}>
                  <Text style={styles.coverBadgeText}>Cover</Text>
                </View>
              ) : null}
              <Pressable style={styles.photoRemove} onPress={() => removePhoto(key)} hitSlop={6}>
                <Ionicons name="close" size={14} color={theme.colors.white} />
              </Pressable>
            </Pressable>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <Pressable
              style={({ pressed }) => [styles.photoAdd, pressed && { opacity: 0.7 }]}
              onPress={() => void pickAndUpload()}
              disabled={photoUploading}
            >
              {photoUploading ? (
                <Ionicons name="sync-outline" size={24} color={theme.colors.primary} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={24} color={theme.colors.primary} />
                  <Text style={styles.photoAddText}>Add photo</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      {listSwitch}

      <Text style={styles.label}>Furnishing</Text>
      {segmented(FURNISHING, furnishing, setFurnishing)}

      <Input label="Address line 1" value={address} onChangeText={setAddress} placeholder="Building, street" />
      <Input label="Locality" value={locality} onChangeText={setLocality} placeholder="Area / neighbourhood" />
      <View style={styles.row}>
        <View style={styles.col}>
          <Input label="City" value={city} onChangeText={setCity} />
        </View>
        <View style={styles.col}>
          <Input label="State" value={state} onChangeText={setState} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Input label="Postal code" value={postal} onChangeText={setPostal} keyboardType="number-pad" />
        </View>
        <View style={styles.col} />
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <Input label="Bedrooms" value={bedrooms} onChangeText={setBedrooms} keyboardType="number-pad" />
        </View>
        <View style={styles.col}>
          <Input label="Bathrooms" value={bathrooms} onChangeText={setBathrooms} keyboardType="number-pad" />
        </View>
      </View>

      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        style={styles.multiline}
        placeholder="Any notes about the property"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={editing ? 'Save changes' : 'Create property'} onPress={() => void submit()} loading={submitting} />

      <Lightbox
        visible={previewIndex != null}
        uris={photoUris}
        initialIndex={previewIndex ?? 0}
        onClose={() => setPreviewIndex(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: theme.text.screenTitle, fontWeight: '800', color: theme.colors.text, marginBottom: theme.spacing.md },
  label: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  row: { flexDirection: 'row', gap: theme.spacing.md },
  col: { flex: 1 },
  multiline: { height: 80, textAlignVertical: 'top' },
  error: { color: theme.colors.danger, fontSize: theme.text.caption, marginBottom: theme.spacing.md },
  listCard: { borderColor: theme.colors.border },
  listCardActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listInfo: { flex: 1, paddingRight: theme.spacing.md },
  listTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  listSub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  listFields: { marginTop: theme.spacing.md },
  listHint: { fontSize: theme.text.small, color: theme.colors.textSubtle, marginTop: -4, marginBottom: theme.spacing.md },
  photoSection: { marginBottom: theme.spacing.md },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  photoCount: { fontSize: theme.text.caption, color: theme.colors.textSubtle, fontWeight: '700' },
  photoHint: {
    fontSize: theme.text.mini,
    color: theme.colors.textSubtle,
    marginBottom: theme.spacing.sm,
  },
  photoStrip: { gap: theme.spacing.md, paddingBottom: 2 },
  photoTile: {
    width: 140,
    height: 96,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: theme.colors.primaryLight,
  },
  photoThumb: { width: 140, height: 96 },
  coverBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(11,87,208,0.9)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  coverBadgeText: { fontSize: theme.text.mini, color: theme.colors.white, fontWeight: '700', textTransform: 'uppercase' },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(23,28,54,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 140,
    height: 96,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.primaryLight,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: { fontSize: theme.text.caption, color: theme.colors.primary, fontWeight: '600', marginTop: 4 },
  contextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  contextName: { fontSize: theme.text.cardTitle, fontWeight: '700', color: theme.colors.text },
  contextLocation: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
});