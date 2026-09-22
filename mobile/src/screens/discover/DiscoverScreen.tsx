import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { get, mediaUrl } from '../../api/client';
import { Listing } from '../../api/types';
import { useLoad } from '../../hooks';
import { Button, EmptyState, ErrorView, Input, LoadingView, PropertyImage, Screen, ScreenTitle, StatusBadge } from '../../components/ui';
import { formatMoney, humanize } from '../../utils/format';
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
  }, [applied], { refreshOnFocus: true });

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
      <ScreenTitle title="Discover" />
      <Text style={styles.subtitle}>Browse active listings, then request a visit.</Text>

      <View style={styles.filterCard}>
        <View style={styles.filterRow}>
          <View style={styles.filterCol}>
            <Input label="City" value={city} onChangeText={setCity} placeholder="e.g. Bengaluru" icon="location-outline" />
          </View>
          <View style={styles.filterCol}>
            <Input label="Max rent (₹/mo)" value={maxRent} onChangeText={setMaxRent} keyboardType="decimal-pad" placeholder="30000" icon="cash-outline" />
          </View>
        </View>
        <View style={styles.filterRow}>
          <View style={styles.filterCol}>
            <Input label="Bedrooms" value={bedrooms} onChangeText={setBedrooms} keyboardType="number-pad" placeholder="Any" icon="bed-outline" />
          </View>
          <View style={styles.filterCol}>
            <Button label="Apply filters" small onPress={() => setApplied((k) => k + 1)} />
          </View>
        </View>
        {hasFilters ? (
          <Button label="Reset filters" variant="ghost" small onPress={reset} />
        ) : null}
      </View>

      <View style={styles.topActions}>
        <Button
          label="My requests"
          variant="secondary"
          small
          icon="paper-plane-outline"
          onPress={() => navigation.navigate('Applications')}
        />
      </View>

      {list.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No rentals match"
          subtitle="Try widening your filters, or check back later when landlords list properties."
        />
      ) : (
        list.map((l) => (
          <View key={l.id} style={styles.card}>
            <PropertyImage uri={mediaUrl(l.photo)} name={l.property_name.charAt(0) || 'P'} style={styles.image} />
            <View style={styles.body}>
              <View style={styles.headRow}>
                <Text style={styles.name}>{l.property_name}</Text>
                {l.furnishing_status ? (
                  <StatusBadge label={humanize(l.furnishing_status)} />
                ) : null}
              </View>
              <Text style={styles.sub}>
                {[l.locality, l.city, l.state].filter(Boolean).join(', ') || 'Location not set'}
              </Text>
              <View style={styles.roomRow}>
                <View style={styles.roomPill}>
                  <Ionicons name="bed-outline" size={13} color={theme.colors.textSubtle} />
                  <Text style={styles.roomText}>
                    {l.bedrooms ? `${l.bedrooms} BHK` : l.property_type.replace(/_/g, ' ')}
                  </Text>
                </View>
                {l.bathrooms ? (
                  <View style={styles.roomPill}>
                    <Ionicons name="water-outline" size={13} color={theme.colors.textSubtle} />
                    <Text style={styles.roomText}>{l.bathrooms} bath</Text>
                  </View>
                ) : null}
                <View style={styles.roomPill}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={theme.colors.textSubtle} />
                  <Text style={styles.roomText}>{formatMoney(l.security_deposit_minor, l.currency)} deposit</Text>
                </View>
              </View>
              {l.description ? (
                <Text style={styles.desc} numberOfLines={2}>
                  {l.description}
                </Text>
              ) : null}
              <View style={styles.footer}>
                <View>
                  <Text style={styles.rent}>{formatMoney(l.monthly_rent_minor, l.currency)}</Text>
                  <Text style={styles.rentPer}>per month</Text>
                </View>
                <Button
                  label="Request visit"
                  small
                  onPress={() =>
                    navigation.navigate('ApplicationForm', {
                      propertyId: l.id,
                      propertyName: l.property_name,
                      monthlyRentMinor: l.monthly_rent_minor,
                      currency: l.currency,
                    })
                  }
                />
              </View>
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2, marginBottom: theme.spacing.md },
  filterCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  filterRow: { flexDirection: 'row', gap: theme.spacing.md },
  filterCol: { flex: 1 },
  topActions: { marginBottom: theme.spacing.md },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  image: { height: 120 },
  body: { padding: theme.spacing.lg },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  name: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.text, flex: 1 },
  sub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  roomRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm, flexWrap: 'wrap' },
  roomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.background,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  roomText: { fontSize: theme.text.small, color: theme.colors.textSubtle },
  desc: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: theme.spacing.sm, lineHeight: 17 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: theme.spacing.md },
  rent: { fontSize: theme.text.heading, fontWeight: '800', color: theme.colors.primaryDark },
  rentPer: { fontSize: theme.text.small, color: theme.colors.textSubtle },
});