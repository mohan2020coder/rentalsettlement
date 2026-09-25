import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { get, mediaUrl } from '../../api/client';
import { Application, Property, Tenancy } from '../../api/types';
import { useLoad } from '../../hooks';
import { Badge, Button, EmptyState, ErrorView, LoadingView, PropertyImage, Screen, SearchBar, ScreenTitle } from '../../components/ui';
import { RootStackParamList } from '../../navigation/types';
import { formatDate } from '../../utils/format';
import { theme } from '../../theme';

export default function PropertiesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');

  const props = useLoad(async () => get<Property[]>('/properties'), [], { refreshOnFocus: true });
  const tenancies = useLoad(async () => get<Tenancy[]>('/tenancies'), [], { refreshOnFocus: true });
  const applications = useLoad(async () => get<Application[]>('/applications'), [], { refreshOnFocus: true });

  const pendingRequests = (applications.data ?? []).filter((a) => a.status === 'PENDING').length;

  const tenancyMap = useMemo(() => {
    const map: Record<string, { active: number; invited: number; tenancies: Tenancy[] }> = {};
    for (const t of tenancies.data ?? []) {
      const key = t.property_id;
      const entry = map[key] ?? { active: 0, invited: 0, tenancies: [] };
      if (t.status === 'ACTIVE' || t.status === 'NOTICE_GIVEN' || t.status === 'MOVE_OUT') entry.active += 1;
      if (t.status === 'INVITED') entry.invited += 1;
      entry.tenancies.push(t);
      map[key] = entry;
    }
    return map;
  }, [tenancies.data]);

  const stageFor = (tens: Tenancy[], listed: boolean) => {
    let anyActive = false;
    let anyMove = false;
    let anyInvited = false;
    let anySettled = false;
    for (const t of tens) {
      if (t.status === 'ACTIVE' || t.status === 'NOTICE_GIVEN') anyActive = true;
      if (t.status === 'MOVE_OUT') anyMove = true;
      if (t.status === 'INVITED') anyInvited = true;
      if (t.status === 'SETTLED') anySettled = true;
    }
    if (anyActive) return { label: 'Occupied', color: theme.colors.success };
    if (anyMove) return { label: 'Move-out', color: theme.colors.warning };
    if (anyInvited) return { label: 'Invite pending', color: theme.colors.warning };
    if (anySettled) return { label: 'Completed', color: theme.colors.primary };
    return listed
      ? { label: 'Available', color: theme.colors.primary }
      : { label: 'Not listed', color: theme.colors.textSubtle };
  };

  if (props.loading) return <LoadingView label="Loading properties…" />;
  if (props.error) return <ErrorView message={props.error} onRetry={props.reload} />;

  let list = props.data ?? [];
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.property_name.toLowerCase().includes(q) ||
        (p.locality ?? '').toLowerCase().includes(q) ||
        (p.city ?? '').toLowerCase().includes(q) ||
        (p.property_type ?? '').toLowerCase().includes(q),
    );
  }

  return (
    <Screen scroll refreshing={props.loading} onRefresh={() => { props.reload(); tenancies.reload(); }}>
      <ScreenTitle title="My Properties" />
      <Text style={styles.subtitle}>Manage your rental portfolio and tenancies.</Text>

      <View style={styles.actions}>
        <View style={styles.searchWrap}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search properties..." />
        </View>
        <Button
          label="Create Property"
          onPress={() => navigation.navigate('PropertyForm', {})}
          icon="add"
          style={styles.createButton}
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.requestsCard, pressed && { opacity: 0.92 }]}
        onPress={() => navigation.navigate('Applications')}
      >
        <View style={styles.requestsIcon}>
          <Ionicons name="paper-plane-outline" size={18} color={theme.colors.primary} />
        </View>
        <View style={styles.requestsCopy}>
          <Text style={styles.requestsTitle}>Visit requests</Text>
          <Text style={styles.requestsSub}>
            {pendingRequests > 0
              ? `${pendingRequests} tenant ${pendingRequests === 1 ? 'request' : 'requests'} waiting for review`
              : 'Tenant interest in your listed properties'}
          </Text>
        </View>
        {pendingRequests > 0 ? (
          <View style={styles.requestsCount}>
            <Text style={styles.requestsCountText}>{pendingRequests}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textSubtle} />
        )}
      </Pressable>

      {list.length === 0 ? (
        <View style={styles.emptyCard}>
          <EmptyState
            icon="business-outline"
            title={q ? 'No matching properties' : 'Your properties will appear here.'}
            subtitle="Add a rental property to start inviting tenants."
          />
          {!q && (
            <Button
              label="Create Property"
              onPress={() => navigation.navigate('PropertyForm', {})}
            />
          )}
        </View>
      ) : (
        list.map((p) => {
          const t = tenancyMap[p.id];
          const activeCount = t?.active ?? 0;
          const invitedCount = t?.invited ?? 0;
          const stage = stageFor(t?.tenancies ?? [], !!p.listed);
          return (
            <Pressable
              key={p.id}
              style={({ pressed }) => [styles.propertyCard, pressed && { opacity: 0.92 }]}
              onPress={() => navigation.navigate('PropertyDetail', { propertyId: p.id })}
            >
              <PropertyImage uri={mediaUrl(p.photo)} name={p.property_name} height={120} />
              <View style={styles.propertyBody}>
                <View style={styles.propertyHead}>
                  <View style={styles.titleWrap}>
                    <Text style={styles.propertyName} numberOfLines={1}>
                      {p.property_name}
                    </Text>
                    <Text style={styles.propertyLocation}>
                      {[p.locality, p.city].filter(Boolean).join(', ') || 'Location not set'}
                    </Text>
                  </View>
                  <View style={styles.badgeWrap}>
                    <Badge label={stage.label} color={stage.color} />
                  </View>
                </View>
                <View style={styles.chipRow}>
                  <View style={styles.chip}>
                    <Ionicons name="business-outline" size={12} color={theme.colors.primary} />
                    <Text style={styles.chipText}>{(p.property_type || 'Property').replace(/_/g, ' ')}</Text>
                  </View>
                  {p.bedrooms ? (
                    <View style={styles.chip}>
                      <Ionicons name="bed-outline" size={12} color={theme.colors.primary} />
                      <Text style={styles.chipText}>{p.bedrooms} BHK</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.propertyFooter}>
                  <View style={styles.propertyMeta}>
                    <Ionicons name="key-outline" size={14} color={activeCount > 0 ? theme.colors.success : theme.colors.textSubtle} />
                    <Text style={[styles.propertyMetaText, activeCount > 0 && { color: theme.colors.success, fontWeight: '700' }]}>
                      {activeCount} Active {activeCount === 1 ? 'Tenancy' : 'Tenancies'}
                    </Text>
                  </View>
                  {invitedCount > 0 && (
                    <View style={styles.propertyMeta}>
                      <Ionicons name="mail-outline" size={14} color={theme.colors.warning} />
                      <Text style={[styles.propertyMetaText, { color: theme.colors.warning, fontWeight: '700' }]}>
                        {invitedCount} {invitedCount === 1 ? 'Invite' : 'Invites'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.propertyMeta}>
                    <Ionicons name="calendar-outline" size={14} color={theme.colors.textSubtle} />
                    <Text style={styles.propertyMetaText}>{formatDate(p.created_at)}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.caption,
    marginTop: 4,
    marginBottom: theme.spacing.lg,
  },
  actions: { marginBottom: theme.spacing.md },
  searchWrap: { marginBottom: theme.spacing.md },
  createButton: {},
  requestsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  requestsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestsCopy: { flex: 1 },
  requestsTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  requestsSub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  requestsCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  requestsCountText: { color: '#fff', fontSize: theme.text.small, fontWeight: '800' },
  emptyCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg },
  propertyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  propertyBody: { padding: theme.spacing.lg },
  propertyHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md },
  titleWrap: { flex: 1 },
  propertyName: { fontSize: theme.text.cardTitle, fontWeight: '700', color: theme.colors.text },
  badgeWrap: { flexShrink: 0 },
  chipRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  chipText: { fontSize: theme.text.small, color: theme.colors.primary, fontWeight: '600' },
  propertyLocation: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  propertyFooter: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border },
  propertyMeta: { flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.md, gap: 5 },
  propertyMetaText: { fontSize: theme.text.small, color: theme.colors.textSubtle },
});