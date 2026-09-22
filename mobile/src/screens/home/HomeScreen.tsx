import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { get, post, extractError } from '../../api/client';
import { AuditLogEntry, Dispute, InspectionSummary, Property, Tenancy } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import {
  ActivityCard,
  AppHeader,
  Button,
  EmptyState,
  ErrorView,
  IconButton,
  LoadingView,
  Screen,
  ScreenTitle,
  SectionHeader,
  StatCard,
  StatusBadge,
} from '../../components/ui';
import { formatDate, formatMoney, humanize, timeAgo } from '../../utils/format';
import { RootStackParamList } from '../../navigation/types';
import { theme } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ActivityMeta = { icon: 'construct-outline' | 'receipt-outline' | 'camera-outline' | 'document-text-outline' | 'chatbubble-ellipses-outline' | 'time-outline'; color: string };

function activityMeta(e: AuditLogEntry): ActivityMeta {
  const t = (e.entity_type || '').toLowerCase();
  if (t.includes('settlement')) return { icon: 'receipt-outline', color: theme.colors.success };
  if (t.includes('deduction') || t.includes('dispute')) return { icon: 'chatbubble-ellipses-outline', color: theme.colors.warning };
  if (t.includes('maintenance')) return { icon: 'construct-outline', color: theme.colors.warning };
  if (t.includes('inspection')) return { icon: 'camera-outline', color: theme.colors.info };
  if (t.includes('agreement') || t.includes('tenancy')) return { icon: 'document-text-outline', color: theme.colors.primary };
  return { icon: 'time-outline', color: theme.colors.textSubtle };
}

interface DashData {
  tenancies: Tenancy[];
  properties: Property[];
  pendingInspections: number;
  openDisputes: number;
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const isLandlord = user?.role === 'LANDLORD';
  const [busy, setBusy] = useState<string | null>(null);

  const dash = useLoad<DashData>(async () => {
    const tenancies = await get<Tenancy[]>('/tenancies');
    const properties = isLandlord ? await get<Property[]>('/properties') : [];
    let pendingInspections = 0;
    let openDisputes = 0;
    await Promise.all(
      tenancies.map(async (t) => {
        const [insps, disputes] = await Promise.all([
          get<InspectionSummary[]>(`/inspections/tenancy/${t.id}`).catch(() => [] as InspectionSummary[]),
          get<Dispute[]>(`/disputes/tenancy/${t.id}`).catch(() => [] as Dispute[]),
        ]);
        pendingInspections += insps.filter((i) => i.status === 'DRAFT' || i.status === 'PENDING_CONFIRMATION').length;
        openDisputes += disputes.filter((d) => d.status === 'OPEN' || d.status === 'NEGOTIATING').length;
      }),
    );
    return { tenancies, properties, pendingInspections, openDisputes };
  }, [isLandlord], { refreshOnFocus: true });

  const activity = useLoad(async () => get<AuditLogEntry[]>('/audit/me'), []);
  const unread = useLoad(async () => get<{ unread_count: number }>('/notifications/unread-count'), []);

  const propNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of dash.data?.properties ?? []) map[p.id] = p.property_name;
    return map;
  }, [dash.data?.properties]);

  if (dash.loading) return <LoadingView label="Loading your dashboard…" />;
  if (dash.error) return <ErrorView message={dash.error} onRetry={dash.reload} />;

  const { tenancies, properties } = dash.data!;
  const hasProperties = properties.length > 0;
  const hasSettled = !isLandlord && tenancies.some((t) => t.status === 'SETTLED');
  const activeCount = tenancies.filter((t) => t.status === 'ACTIVE').length;
  const notes = unread.data?.unread_count ?? 0;
  const firstName = user?.name.split(' ')[0] ?? '';
  const activeTenancy = tenancies.find((t) => t.status === 'ACTIVE') ?? tenancies[0];
  const activityList = activity.data?.slice(0, 5) ?? [];

  const respond = async (t: Tenancy, kind: 'accept' | 'decline') => {
    setBusy(t.id);
    try {
      if (kind === 'accept') await post<Tenancy>(`/tenancies/${t.id}/accept`);
      else await post<Tenancy>(`/tenancies/${t.id}/status`, { status: 'CANCELLED' });
      dash.reload();
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

  return (
    <Screen scroll refreshing={dash.loading} onRefresh={() => { dash.reload(); activity.reload(); unread.reload(); }}>
      <AppHeader
        name={user?.name ?? ''}
        role={isLandlord ? 'Landlord' : 'Tenant'}
        right={
          <IconButton
            name="notifications-outline"
            badge={notes > 0}
            onPress={() => navigation.navigate('Main', { screen: 'Notifications' })}
          />
        }
      />

      {isLandlord ? (
        <View style={styles.hero}>
          <View style={styles.heroDecor}>
            <View style={styles.heroCircle} />
          </View>
          <View style={styles.heroBody}>
            <View style={styles.heroHead}>
              <Text style={styles.heroLabel}>Your Properties</Text>
              <Ionicons name="business-outline" size={22} color={theme.colors.white} />
            </View>
            <Text style={styles.heroCount}>
              {properties.length} {properties.length === 1 ? 'Property' : 'Properties'}
            </Text>
            <Text style={styles.heroSub}>
              {activeCount > 0
                ? `${activeCount} Active ${activeCount === 1 ? 'Tenancy' : 'Tenancies'}`
                : 'No active tenancies'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.hero}>
          <View style={styles.heroDecor}>
            <View style={styles.heroCircle} />
          </View>
          <View style={styles.heroBody}>
            <View style={styles.heroHead}>
              <Text style={styles.heroLabel}>My Rental</Text>
              <Ionicons name="home-outline" size={22} color={theme.colors.white} />
            </View>
            {activeTenancy ? (
              <>
                <Text style={styles.heroTitle}>{propNames[activeTenancy.property_id] ?? 'Your rental'}</Text>
                <Text style={styles.heroSub}>
                  {formatDate(activeTenancy.start_date)} → {formatDate(activeTenancy.end_date)}
                </Text>
                <Text style={styles.heroRent}>
                  {formatMoney(activeTenancy.monthly_rent_minor, activeTenancy.currency)}/mo
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.heroTitle}>No rental yet</Text>
                <Text style={styles.heroSub}>Browse rentals on the Discover tab to find your home.</Text>
              </>
            )}
          </View>
        </View>
      )}

      {isLandlord ? (
        <View style={styles.stats}>
          <View style={styles.statsCol}>
            <StatCard label="Properties" value={properties.length} icon="business-outline" color={theme.colors.primary} />
            <StatCard label="Pending Inspection" value={dash.data!.pendingInspections} icon="camera-outline" color={theme.colors.warning} />
          </View>
          <View style={styles.statsCol}>
            <StatCard label="Active Tenancy" value={activeCount} icon="key-outline" color={theme.colors.success} />
            <StatCard label="Open Disputes" value={dash.data!.openDisputes} icon="chatbubble-ellipses-outline" color={dash.data!.openDisputes > 0 ? theme.colors.danger : theme.colors.textSubtle} />
          </View>
        </View>
      ) : (
        activeTenancy && (
          <View style={styles.tenantSummary}>
            <View style={styles.tenantSummaryTop}>
              <View>
                <Text style={styles.tenantSummaryName}>
                  {propNames[activeTenancy.property_id] ?? 'Your rental'}
                </Text>
                <Text style={styles.tenantSummarySub}>
                  {formatDate(activeTenancy.start_date)} → {formatDate(activeTenancy.end_date)}
                </Text>
              </View>
              <StatusBadge label={humanize(activeTenancy.status.split('_').join(' '))} />
            </View>
            <View style={styles.tenantSummaryMeta}>
              <View style={styles.tenantSummaryItem}>
                <Ionicons name="cash-outline" size={16} color={theme.colors.primary} />
                <Text style={styles.tenantSummaryItemLabel}>Rent</Text>
                <Text style={styles.tenantSummaryItemValue}>
                  {formatMoney(activeTenancy.monthly_rent_minor, activeTenancy.currency)}
                </Text>
              </View>
              <View style={styles.tenantSummaryItem}>
                <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.success} />
                <Text style={styles.tenantSummaryItemLabel}>Deposit</Text>
                <Text style={styles.tenantSummaryItemValue}>
                  {formatMoney(activeTenancy.security_deposit_minor, activeTenancy.currency)}
                </Text>
              </View>
            </View>
          </View>
        )
      )}

      {!isLandlord && activeTenancy && (
        <View style={styles.quickActions}>
          <Pressable style={styles.quickAction} onPress={() => navigation.navigate('Agreement', { tenancyId: activeTenancy.id })}>
            <Ionicons name="document-text-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.quickActionLabel}>Lease Details</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => navigation.navigate('TenancyDetail', { tenancyId: activeTenancy.id, propertyName: propNames[activeTenancy.property_id] })}>
            <Ionicons name="cash-outline" size={20} color={theme.colors.success} />
            <Text style={styles.quickActionLabel}>Monthly Rent</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => navigation.navigate('Settlement', { tenancyId: activeTenancy.id })}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.info} />
            <Text style={styles.quickActionLabel}>Deposit</Text>
          </Pressable>
          <Pressable style={styles.quickAction} onPress={() => navigation.navigate('Inspections', { tenancyId: activeTenancy.id })}>
            <Ionicons name="log-out-outline" size={20} color={theme.colors.warning} />
            <Text style={styles.quickActionLabel}>Move-Out</Text>
          </Pressable>
        </View>
      )}

      {hasSettled && (
        <View style={styles.settledCard}>
          <Ionicons name="checkmark-done-circle-outline" size={22} color={theme.colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.settledTitle}>Your rental is complete</Text>
            <Text style={styles.settledText}>Browse Discover to find your next home.</Text>
          </View>
          <Button
            label="Browse"
            small
            onPress={() => navigation.navigate('Main', { screen: 'Discover' })}
          />
        </View>
      )}

      {tenancies.filter((t) => t.status === 'INVITED').length > 0 && (
        <>
          <SectionHeader title="Pending invitations" />
          {tenancies
            .filter((t) => t.status === 'INVITED')
            .map((t) => (
              <View key={t.id} style={styles.inviteCard}>
                <View style={styles.inviteInfo}>
                  <Text style={styles.inviteTitle}>{propNames[t.property_id] ?? 'Rental property'}</Text>
                  <Text style={styles.inviteSub}>Invited: {t.invited_email}</Text>
                  <Text style={styles.inviteRent}>{formatMoney(t.monthly_rent_minor, t.currency)}/mo</Text>
                </View>
                <View style={styles.inviteActions}>
                  <View style={{ flex: 1 }}>
                    <Button label="Accept" small loading={busy === t.id} onPress={() => void respond(t, 'accept')} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="Decline" variant="ghost" small loading={busy === t.id} onPress={() => void respond(t, 'decline')} />
                  </View>
                </View>
              </View>
            ))}
        </>
      )}

      {isLandlord && tenancies.length === 0 && (
        <View style={styles.emptyCard}>
          <EmptyState
            icon={isLandlord ? 'business-outline' : 'key-outline'}
            title={isLandlord ? 'No tenancies yet' : 'No tenancies yet'}
            subtitle={
              isLandlord
                ? 'Add a property first, then invite a tenant to start a tenancy.'
                : 'Browse the Discover tab and send a visit request.'
            }
          />
          {isLandlord && (
            <Button
              label={hasProperties ? 'Create a tenancy' : 'Add your first property'}
              onPress={() => (hasProperties ? navigation.navigate('NewTenancy') : navigation.navigate('PropertyForm', {}))}
            />
          )}
        </View>
      )}

      {tenancies.length > 0 ? (
        <>
          <SectionHeader title="Your tenancies" />
          {tenancies.map((t) => (
            <Pressable
              key={t.id}
              style={styles.tenancyCard}
              onPress={() =>
                navigation.navigate('TenancyDetail', {
                  tenancyId: t.id,
                  propertyName: propNames[t.property_id] ?? undefined,
                })
              }
            >
              <View style={styles.tenancyIcon}>
                <Ionicons name="key-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.tenancyInfo}>
                <Text style={styles.tenancyName}>{propNames[t.property_id] ?? 'Rental property'}</Text>
                <Text style={styles.tenancySub}>
                  {t.invited_email && t.status === 'INVITED'
                    ? `Invited: ${t.invited_email}`
                    : `${formatDate(t.start_date)} → ${formatDate(t.end_date)}`}
                </Text>
                <Text style={styles.tenancyRent}>
                  {t.status === 'ACTIVE' ? `${formatMoney(t.monthly_rent_minor, t.currency)}/mo` : humanize(t.status)}
                </Text>
              </View>
              <StatusBadge label={humanize(t.status)} />
            </Pressable>
          ))}
        </>
      ) : null}

      {activityList.length > 0 ? (
        <>
          <View style={styles.activityHead}>
            <ScreenTitle title="Recent Activity" style={styles.activityTitle} />
            <Pressable onPress={() => navigation.navigate('Audit', {})}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          {activityList.map((e) => {
            const m = activityMeta(e);
            return (
              <ActivityCard
                key={e.id}
                icon={m.icon}
                color={m.color}
                title={humanize(e.action)}
                description={e.entity_type.replace(/_/g, ' ')}
                time={timeAgo(e.created_at)}
              />
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
    minHeight: 148,
  },
  heroDecor: { position: 'absolute', right: -40, top: -50 },
  heroCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: theme.colors.primaryLight,
    opacity: 0.16,
  },
  heroBody: { padding: theme.spacing.lg },
  heroHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: theme.colors.primaryLight, fontSize: theme.text.caption, fontWeight: '700', letterSpacing: 0.5 },
  heroCount: { color: theme.colors.white, fontSize: 26, fontWeight: '800', marginTop: 10 },
  heroTitle: { color: theme.colors.white, fontSize: 20, fontWeight: '800', marginTop: 10 },
  heroSub: { color: theme.colors.primaryLight, fontSize: theme.text.caption, marginTop: 4 },
  heroRent: { color: theme.colors.white, fontSize: theme.text.body, fontWeight: '700', marginTop: 8 },
  stats: { flexDirection: 'row', gap: theme.spacing.md },
  statsCol: { flex: 1 },
  tenantSummary: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  tenantSummaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tenantSummaryName: { fontSize: theme.text.heading, fontWeight: '800', color: theme.colors.text },
  tenantSummarySub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  tenantSummaryMeta: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.lg },
  tenantSummaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  tenantSummaryItemLabel: {
    fontSize: theme.text.small,
    color: theme.colors.textSubtle,
    marginLeft: 6,
    marginRight: 6,
    fontWeight: '600',
  },
  tenantSummaryItemValue: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  quickActions: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    gap: 6,
  },
  quickActionLabel: { fontSize: theme.text.small, fontWeight: '600', color: theme.colors.text },
  activityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  activityTitle: { fontSize: theme.text.heading },
  seeAll: { color: theme.colors.primary, fontSize: theme.text.caption, fontWeight: '700' },
  settledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.successBg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#C6ECDC',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  settledTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.success },
  settledText: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  inviteCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  inviteInfo: { marginBottom: theme.spacing.md },
  inviteTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  inviteSub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  inviteRent: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.primaryDark, marginTop: 6 },
  inviteActions: { flexDirection: 'row', gap: theme.spacing.md },
  emptyCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg, marginBottom: theme.spacing.sm },
  tenancyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  tenancyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  tenancyInfo: { flex: 1, paddingRight: theme.spacing.md },
  tenancyName: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  tenancySub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  tenancyRent: { fontSize: theme.text.caption, fontWeight: '700', color: theme.colors.primaryDark, marginTop: 4 },
});