import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { get, post, extractError } from '../../api/client';
import { Property, Tenancy } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, EmptyState, ErrorView, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { formatDate, formatMoney, statusColor } from '../../utils/format';
import { RootStackParamList } from '../../navigation/types';
import { theme } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const isLandlord = user?.role === 'LANDLORD';
  const [busy, setBusy] = useState<string | null>(null);

  const tenancies = useLoad(async () => get<Tenancy[]>('/tenancies'), []);
  const properties = useLoad(async () => get<Property[]>('/properties'), [isLandlord]);

  const propNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of properties.data ?? []) map[p.id] = p.property_name;
    return map;
  }, [properties.data]);

  const respond = async (t: Tenancy, kind: 'accept' | 'decline') => {
    setBusy(t.id);
    try {
      if (kind === 'accept') {
        await post<Tenancy>(`/tenancies/${t.id}/accept`);
      } else {
        await post<Tenancy>(`/tenancies/${t.id}/status`, { status: 'CANCELLED' });
      }
      tenancies.reload();
      Alert.alert(
        kind === 'accept' ? 'Invitation accepted' : 'Invitation declined',
        kind === 'accept' ? 'You are now a tenant of this property.' : 'You declined the invitation.',
      );
    } catch (err) {
      Alert.alert('Could not respond', extractError(err).message);
    } finally {
      setBusy(null);
    }
  };

  if (tenancies.loading) return <LoadingView label="Loading your tenancies…" />;

  if (tenancies.error) {
    return <ErrorView message={tenancies.error} onRetry={tenancies.reload} />;
  }

  const list = tenancies.data ?? [];
  const hasProperties = (properties.data?.length ?? 0) > 0;
  const hasSettled = !isLandlord && list.some((t) => t.status === 'SETTLED');

  return (
    <Screen scroll refreshing={tenancies.loading} onRefresh={tenancies.reload}>
      {user ? (
        <Text style={styles.greeting}>
          Hello, {user.name.split(' ')[0]} · {isLandlord ? 'Landlord' : 'Tenant'}
        </Text>
      ) : null}

      {hasSettled && (
        <Card>
          <Text style={styles.bannerTitle}>Your rental is complete</Text>
          <Text style={styles.subtle}>
            The property is back on the market. Browse Discover to find your next home.
          </Text>
          <Button
            label="Browse rentals"
            small
            onPress={() => navigation.navigate('Main', { screen: 'Discover' })}
            style={styles.actionGap}
          />
        </Card>
      )}

      {list.length === 0 ? (
        <Card>
          <EmptyState
            title="No tenancies yet"
            subtitle={
              isLandlord
                ? 'Create a property first, then invite a tenant to start a tenancy.'
                : "You'll see tenancy invitations here once a landlord invites you."
            }
          />
          {isLandlord && (
            <Button
              label={hasProperties ? 'Create a tenancy' : 'Add your first property'}
              onPress={() =>
                hasProperties
                  ? navigation.navigate('NewTenancy')
                  : navigation.navigate('PropertyForm', {})
              }
            />
          )}
        </Card>
      ) : (
        <>
          <SectionHeader
            title="Your tenancies"
            action={
              isLandlord ? (
                <Button
                  label="+ New"
                  small
                  onPress={() =>
                    hasProperties
                      ? navigation.navigate('NewTenancy')
                      : navigation.navigate('PropertyForm', {})
                  }
                />
              ) : undefined
            }
          />
          {list.map((t) => (
            <Card
              key={t.id}
              onPress={() =>
                navigation.navigate('TenancyDetail', {
                  tenancyId: t.id,
                  propertyName: propNames[t.property_id] ?? undefined,
                })
              }
            >
              <View style={styles.tenancyRow}>
                <View style={styles.tenancyInfo}>
                  <Text style={styles.propertyName}>
                    {propNames[t.property_id] ?? 'Rental property'}
                  </Text>
                  {t.invited_email && t.status === 'INVITED' ? (
                    <Text style={styles.subtle}>Invited: {t.invited_email}</Text>
                  ) : (
                    <Text style={styles.subtle}>
                      {formatDate(t.start_date)} → {formatDate(t.end_date)}
                    </Text>
                  )}
                  <Text style={styles.rent}>{formatMoney(t.monthly_rent_minor, t.currency)}/mo</Text>
                </View>
                <Badge label={t.status.replace(/_/g, ' ')} color={statusColor(t.status)} />
              </View>
              {!isLandlord && t.status === 'INVITED' ? (
                <View style={styles.inviteActions}>
                  <View style={styles.inviteCol}>
                    <Button
                      label="Accept"
                      small
                      loading={busy === t.id}
                      onPress={() => void respond(t, 'accept')}
                    />
                  </View>
                  <View style={styles.inviteCol}>
                    <Button
                      label="Decline"
                      variant="ghost"
                      small
                      loading={busy === t.id}
                      onPress={() => void respond(t, 'decline')}
                    />
                  </View>
                </View>
              ) : null}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: {
    fontSize: theme.text.heading,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  bannerTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  actionGap: { marginTop: theme.spacing.sm },
  tenancyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tenancyInfo: { flex: 1, paddingRight: theme.spacing.md, gap: 2 },
  propertyName: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  subtle: { fontSize: theme.text.caption, color: theme.colors.textSubtle },
  rent: { fontSize: theme.text.body, fontWeight: '600', color: theme.colors.primaryDark, marginTop: 4 },
  inviteActions: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md },
  inviteCol: { flex: 1 },
});