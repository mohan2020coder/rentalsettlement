import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, patch, extractError, ApiClientError } from '../../api/client';
import { Property } from '../../api/types';
import { useLoad } from '../../hooks';
import { Button, Card, ErrorView, Input, LoadingView, Screen } from '../../components/ui';
import { theme } from '../../theme';

const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'VILLA', 'PG', 'OTHER'] as const;
const FURNISHING = ['FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED'] as const;

export default function PropertyFormScreen({ route, navigation }: RootStackScreenProps<'PropertyForm'>) {
  const editing = !!route.params?.propertyId;
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (existing.data) {
      const p = existing.data;
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
    }
  }, [existing.data]);

  if (editing && existing.loading) return <LoadingView label="Loading property…" />;
  if (editing && existing.error) return <ErrorView message={existing.error} onRetry={existing.reload} />;

  const toMinor = (rupees: string): number => {
    const n = parseFloat(rupees);
    return Number.isNaN(n) ? 0 : Math.round(n * 100);
  };

  const minorToRupees = (minor?: number): string => {
    const n = (minor ?? 0) / 100;
    return n % 1 === 0 ? String(n) : n.toFixed(2);
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
          variant={value === o ? 'primary' : 'secondary'}
          small
          onPress={() => onChange(o)}
        />
      ))}
    </View>
  );

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

      <Text style={styles.label}>Property type</Text>
      {segmented(PROPERTY_TYPES, type, setType)}

      <Input label="Property name" value={name} onChangeText={setName} placeholder="E.g. Lakeview Apartment, 2BHK" />

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: theme.text.title, fontWeight: '800', color: theme.colors.text, marginBottom: theme.spacing.md },
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
});