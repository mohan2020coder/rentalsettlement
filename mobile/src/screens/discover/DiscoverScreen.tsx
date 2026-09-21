import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { get } from '../../api/client';
import { Listing } from '../../api/types';
import { useLoad } from '../../hooks';
import { Badge, Button, Card, EmptyState, ErrorView, Input, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { formatMoney } from '../../utils/format';
import { RootStackParamList } from '../../navigation/types';
import { theme } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DiscoverScreen() {
  const navigation = useNavigation<Nav>();
  const [city, setCity] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [applied, setApplied] = useState(0);

  const toMinor = (rupees: string): number => {
    const n = parseFloat(rupees);
    return Number.isNaN(n) ? 0 : Math.round(n * 100);
  };

  const listings = useLoad(async () => {
    const params: string[] = [];
    if (city.trim()) params.push(`city=${encodeURIComponent(city.trim())}`);
    const rentMinor = toMinor(maxRent);
    if (rentMinor > 0) params.push(`max_rent_minor=${rentMinor}`);
    const beds = parseInt(bedrooms, 10);
    if (!Number.isNaN(beds) && beds > 0) params.push(`bedrooms=${beds}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return get<Listing[]>(`/properties/listed${qs}`);
  }, [applied]);

  const reset = () => {
    setCity('');
    setMaxRent('');
    setBedrooms('');
    setApplied((k) => k + 1);
  };

  if (listings.loading && !listings.data) return <LoadingView label="Finding rentals…" />;
  if (listings.error) return <ErrorView message={listings.error} onRetry={listings.reload} />;

  const list = listings.data ?? [];
  const hasFilters = !!(city.trim() || maxRent.trim() || bedrooms.trim());

  return (
    <Screen scroll refreshing={listings.loading} onRefresh={listings.reload}>
      <SectionHeader
        title="Discover rentals"
        action={
          <Button
            label="My requests"
            variant="secondary"
            small
            onPress={() => navigation.navigate('Applications')}
          />
        }
      />

      <Card>
        <View style={styles.filterRow}>
          <View style={styles.filterCol}>
            <Input label="City" value={city} onChangeText={setCity} placeholder="e.g. Bengaluru" />
          </View>
          <View style={styles.filterCol}>
            <Input label="Max rent (₹/mo)" value={maxRent} onChangeText={setMaxRent} keyboardType="decimal-pad" placeholder="30000" />
          </View>
        </View>
        <View style={styles.filterRow}>
          <View style={styles.filterCol}>
            <Input label="Bedrooms" value={bedrooms} onChangeText={setBedrooms} keyboardType="number-pad" placeholder="Any" />
          </View>
          <View style={styles.filterCol}>
            <Button label="Apply filters" small onPress={() => setApplied((k) => k + 1)} />
          </View>
        </View>
        {hasFilters ? (
          <Button label="Reset filters" variant="ghost" small onPress={reset} />
        ) : null}
      </Card>

      {list.length === 0 ? (
        <EmptyState
          title="No rentals match"
          subtitle="Try widening your filters, or check back later when landlords list properties."
        />
      ) : (
        list.map((l) => (
          <Card key={l.id}>
            <View style={styles.headRow}>
              <Text style={styles.name}>{l.property_name}</Text>
              {l.furnishing_status ? (
                <Badge label={l.furnishing_status.replace(/_/g, ' ')} color={theme.colors.primary} />
              ) : null}
            </View>
            <Text style={styles.sub}>
              {[l.locality, l.city, l.state].filter(Boolean).join(', ') || 'Location not set'}
            </Text>
            <Text style={styles.sub}>
              {l.property_type.replace(/_/g, ' ')}
              {l.bedrooms ? ` · ${l.bedrooms} BHK` : ''}
              {l.bathrooms ? ` · ${l.bathrooms} bath` : ''}
            </Text>
            <Text style={styles.rent}>{formatMoney(l.monthly_rent_minor, l.currency)}/mo</Text>
            <Text style={styles.sub}>
              Deposit {formatMoney(l.security_deposit_minor, l.currency)}
            </Text>
            {l.description ? (
              <Text style={styles.desc} numberOfLines={2}>
                {l.description}
              </Text>
            ) : null}
            <Button
              label="Request visit"
              onPress={() =>
                navigation.navigate('ApplicationForm', {
                  propertyId: l.id,
                  propertyName: l.property_name,
                  monthlyRentMinor: l.monthly_rent_minor,
                  currency: l.currency,
                })
              }
            />
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: theme.spacing.md },
  filterCol: { flex: 1 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text, flex: 1, paddingRight: theme.spacing.md },
  sub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  rent: { fontSize: theme.text.heading, fontWeight: '800', color: theme.colors.primaryDark, marginTop: theme.spacing.sm },
  desc: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: theme.spacing.sm },
});