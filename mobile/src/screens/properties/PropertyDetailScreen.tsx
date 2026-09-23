import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { get, mediaUrl } from '../../api/client';
import { AuditLogEntry, Property, Tenancy } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, EmptyState, ErrorView, Lightbox, LoadingView, PhotoStrip, PropertyImage, Screen, SectionHeader, TimelineItem } from '../../components/ui';
import { formatDate, formatDateTime, formatMoney, humanize } from '../../utils/format';
import { theme } from '../../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const STAGES: { key: string; label: string; icon: IconName }[] = [
  { key: 'CREATED', label: 'Listed / Available', icon: 'business-outline' },
  { key: 'INVITED', label: 'Tenant invited', icon: 'mail-outline' },
  { key: 'ACTIVE', label: 'Active rental', icon: 'key-outline' },
  { key: 'MOVE_OUT', label: 'Move-out', icon: 'log-out-outline' },
  { key: 'SETTLED', label: 'Settlement complete', icon: 'checkmark-done-circle-outline' },
];

function stageIndex(tenancies: Tenancy[]): number {
  let reached = 0;
  for (const t of tenancies) {
    switch (t.status) {
      case 'INVITED':
        reached = Math.max(reached, 1);
        break;
      case 'ACTIVE':
      case 'NOTICE_GIVEN':
        reached = Math.max(reached, 2);
        break;
      case 'MOVE_OUT':
        reached = Math.max(reached, 3);
        break;
      case 'SETTLED':
        reached = Math.max(reached, 4);
        break;
    }
  }
  return reached;
}

export default function PropertyDetailScreen({
  route,
  navigation,
}: RootStackScreenProps<'PropertyDetail'>) {
  const { propertyId } = route.params;
  const { user } = useAuth();
  const isLandlord = user?.role === 'LANDLORD';
  const [preview, setPreview] = useState<number | null>(null);

  const property = useLoad<Property | null>(
    async () => get<Property>(`/properties/${propertyId}`).catch(() => null),
    [propertyId],
    { refreshOnFocus: true },
  );
  const tenancies = useLoad<Tenancy[]>(async () => get<Tenancy[]>('/tenancies'), [], { refreshOnFocus: true });
  const activity = useLoad<AuditLogEntry[]>(async () => get<AuditLogEntry[]>('/audit/me'), []);

  const propTenancies = useMemo(
    () => (tenancies.data ?? []).filter((t) => !property.data || t.property_id === property.data.id),
    [tenancies.data, property.data],
  );
  const tenancyIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of propTenancies) set.add(t.id);
    return set;
  }, [propTenancies]);

  if (property.loading || tenancies.loading) return <LoadingView label="Loading property…" />;
  if (property.error || !property.data) {
    return <ErrorView message={property.error ?? 'Missing data'} onRetry={() => { property.reload(); tenancies.reload(); }} />;
  }

  const p = property.data;
  const galleryKeys = p.photos?.length ? p.photos : p.photo ? [p.photo] : [];
  const galleryUris = galleryKeys.map((k) => mediaUrl(k)).filter((u): u is string => !!u);

  const reached = stageIndex(propTenancies);
  const stage = STAGES[Math.max(0, Math.min(reached, STAGES.length - 1))]!;
  const stageColor =
    stage.key === 'SETTLED' || stage.key === 'ACTIVE'
      ? theme.colors.success
      : stage.key === 'MOVE_OUT'
        ? theme.colors.danger
        : theme.colors.primary;

  const entries = (activity.data ?? [])
    .filter((e) => {
      const et = (e.entity_type || '').toLowerCase();
      if (et === 'property') return e.entity_id === p.id;
      return !!e.tenancy_id && tenancyIds.has(e.tenancy_id);
    })
    .slice(0, 20);

  const latest = propTenancies[0];
  const occupying = !!latest && ['INVITED', 'ACTIVE', 'NOTICE_GIVEN', 'MOVE_OUT'].includes(latest.status);

  return (
    <Screen scroll refreshing={property.loading} onRefresh={() => { property.reload(); tenancies.reload(); activity.reload(); }}>
      <Pressable
        style={({ pressed }) => [styles.cover, pressed && { opacity: 0.9 }]}
        onPress={() => (galleryUris.length ? setPreview(0) : null)}
      >
        <PropertyImage uri={galleryUris[0]} name={p.property_name} height={190} style={styles.coverImage} />
        {galleryUris.length > 1 ? (
          <View style={styles.coverCount}>
            <Ionicons name="images-outline" size={13} color="#fff" />
            <Text style={styles.coverCountText}>{galleryUris.length}</Text>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text style={styles.eyebrow}>Property</Text>
          <Text style={styles.title}>{p.property_name}</Text>
          <Text style={styles.sub}>
            {[p.locality, p.city, p.state].filter(Boolean).join(', ') || 'Location not set'}
          </Text>
        </View>
        <View style={styles.headActions}>
          {isLandlord ? (
            <>
              <Badge label={humanize(stage.label.split('/')[0] ?? stage.label)} color={stageColor} />
              <Button
                label="Edit"
                small
                variant="secondary"
                icon="create-outline"
                onPress={() => navigation.navigate('PropertyForm', { propertyId: p.id, initial: p })}
              />
            </>
          ) : (
            <Badge label={formatMoney(p.monthly_rent_minor, p.currency)} color={theme.colors.primary} />
          )}
        </View>
      </View>

      {galleryUris.length > 1 ? (
        <Pressable style={styles.stripWrap} onPress={() => setPreview(0)}>
          <PhotoStrip uris={galleryUris} />
        </Pressable>
      ) : null}

      {isLandlord ? (
        <>
          <SectionHeader title="Current stage" />
          <View style={styles.stageCard}>
            <View style={[styles.stageIcon, { backgroundColor: `${stageColor}1A` }]}>
              <Ionicons name={stage.icon} size={20} color={stageColor} />
            </View>
            <View style={styles.stageCopy}>
              <Text style={[styles.stageTitle, { color: stageColor }]}>{stage.label}</Text>
              <Text style={styles.stageSub}>
                {reached === 0
                  ? p.listed
                    ? 'Listed for tenants to discover. Invite a tenant to start renting.'
                    : 'Not listed on the marketplace yet. Enable “List on marketplace” to let tenants apply.'
                  : reached >= 4
                    ? 'The tenancy deposit has been settled and recorded.'
                    : reached >= 3
                      ? 'Move-out is in progress — inspections and the settlement are being recorded.'
                      : reached >= 2
                        ? 'This property is occupied by an active tenancy.'
                        : 'A tenant invitation is pending acceptance.'}
              </Text>
            </View>
          </View>

          <SectionHeader title="Rental journey" />
          <View style={styles.timelineCard}>
            {STAGES.map((s, i) => {
              const done = i <= reached;
              const isCurrent = i === reached;
              return (
                <View key={s.key} style={styles.timelineStep}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, done && { backgroundColor: s.key === 'MOVE_OUT' && i === reached ? theme.colors.warning : stageColor }, isCurrent && styles.timelineDotCurrent]}>
                      <Ionicons name={s.icon} size={12} color={done ? '#fff' : theme.colors.textSubtle} />
                    </View>
                    {i < STAGES.length - 1 ? (
                      <View style={[styles.timelineConnector, i < reached && { backgroundColor: stageColor }]} />
                    ) : null}
                  </View>
                  <View style={[styles.timelineStepBody, isCurrent && styles.timelineStepBodyCurrent]}>
                    <Text style={[styles.timelineStepLabel, done ? { color: theme.colors.text } : { color: theme.colors.textSubtle }]}>
                      {s.label}
                    </Text>
                    {isCurrent ? (
                      <Text style={[styles.timelineStepTag, { color: stageColor }]}>Current</Text>
                    ) : done ? (
                      <Text style={styles.timelineStepTagDone}>Done</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : occupying ? (
        <View style={styles.rentBanner}>
          <View style={styles.rentBannerIcon}>
            <Ionicons name="key-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.rentBannerCopy}>
            <Text style={styles.rentBannerTitle}>You rent this property</Text>
            <Text style={styles.rentBannerText}>Manage rent terms, inspections and records from your tenancy.</Text>
          </View>
          <Button
            label="Open tenancy"
            small
            onPress={() => navigation.navigate('TenancyDetail', { tenancyId: latest!.id, propertyName: p.property_name })}
          />
        </View>
      ) : p.listed ? (
        <Card style={styles.ctaCard}>
          <View style={styles.ctaCopy}>
            <Text style={styles.ctaRent}>{formatMoney(p.monthly_rent_minor, p.currency)}</Text>
            <Text style={styles.ctaPer}>
              per month · {formatMoney(p.security_deposit_minor, p.currency)} deposit
            </Text>
          </View>
          <Button
            label="Request visit"
            small
            onPress={() =>
              navigation.navigate('ApplicationForm', {
                propertyId: p.id,
                propertyName: p.property_name,
                monthlyRentMinor: p.monthly_rent_minor,
                currency: p.currency,
              })
            }
          />
        </Card>
      ) : (
        <EmptyState
          icon="eye-off-outline"
          title="Not currently listed"
          subtitle="This property is not available on the marketplace right now."
        />
      )}

      <SectionHeader title="Details" />
      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <DetailCell icon="business-outline" label="Type" value={humanize(p.property_type)} />
          <DetailCell icon="bed-outline" label="Bedrooms" value={p.bedrooms ? `${p.bedrooms} BHK` : '—'} />
        </View>
        <View style={styles.detailRow}>
          <DetailCell icon="water-outline" label="Bathrooms" value={p.bathrooms ? `${p.bathrooms}` : '—'} />
          <DetailCell icon="shirt-outline" label="Furnishing" value={p.furnishing_status ? humanize(p.furnishing_status) : '—'} />
        </View>
        {p.address_line1 ? <DetailText label="Address" value={[p.address_line1, p.address_line2, p.locality, p.city, p.state, p.postal_code].filter(Boolean).join(', ')} /> : null}
        <View style={styles.detailRow}>
          <DetailCell icon="cash-outline" label="Monthly rent" value={formatMoney(p.monthly_rent_minor, p.currency)} />
          <DetailCell icon="shield-checkmark-outline" label="Deposit" value={formatMoney(p.security_deposit_minor, p.currency)} />
        </View>
        <View style={styles.detailRow}>
          <DetailCell icon="eye-outline" label="Marketplace" value={p.listed ? 'Listed' : 'Not listed'} />
          <DetailCell icon="calendar-outline" label="Added" value={formatDate(p.created_at)} />
        </View>
        {latest && isLandlord ? (
          <View style={[styles.latestRow, { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
            <Ionicons name="key-outline" size={15} color={theme.colors.primary} />
            <Text style={styles.latestText}>
              {latest.property_name || p.property_name} · {humanize(latest.status)}
            </Text>
            <Text style={styles.latestDate}>
              {formatDate(latest.start_date)} → {formatDate(latest.end_date)}
            </Text>
          </View>
        ) : null}
      </View>

      {!isLandlord && p.description ? (
        <>
          <SectionHeader title="About this property" />
          <Text style={styles.descText}>{p.description}</Text>
        </>
      ) : null}

      {isLandlord &&
        (entries.length > 0 ? (
          <>
            <SectionHeader title="Recent activity" />
            <Text style={styles.sectionHint}>
              Changes and tenancy events recorded for this property (from the audit trail).
            </Text>
            <View style={styles.timelineCard}>
              {entries.map((e, i) => (
                <TimelineItem
                  key={e.id}
                  icon="shield-checkmark-outline"
                  color={theme.colors.primary}
                  title={humanize(e.action)}
                  meta={`${e.entity_type.replace(/_/g, ' ')} · ${formatDateTime(e.created_at)}`}
                  isLast={i === entries.length - 1}
                />
              ))}
            </View>
          </>
        ) : (
          <EmptyState
            icon="time-outline"
            title="No activity yet"
            subtitle="Changes and tenancy events for this property will appear here."
          />
        ))}

      <Lightbox
        visible={preview != null}
        uris={galleryUris}
        initialIndex={preview ?? 0}
        onClose={() => setPreview(null)}
      />
    </Screen>
  );
}

function DetailCell({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailCell}>
      <View style={styles.detailCellIcon}>
        <Ionicons name={icon} size={15} color={theme.colors.primary} />
      </View>
      <Text style={styles.detailCellLabel}>{label}</Text>
      <Text style={styles.detailCellValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function DetailText({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailTextRow}>
      <Text style={styles.detailTextLabel}>{label}</Text>
      <Text style={styles.detailTextValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: 190, backgroundColor: theme.colors.primaryLight },
  coverImage: { borderRadius: 0 },
  coverCount: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(12,27,51,0.7)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coverCountText: { color: '#fff', fontSize: theme.text.small, fontWeight: '700' },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  headActions: { alignItems: 'flex-end', gap: theme.spacing.sm, flexShrink: 0 },
  sectionHint: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    marginTop: -theme.spacing.sm,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  headCopy: { flex: 1, paddingRight: theme.spacing.md },
  eyebrow: {
    fontSize: theme.text.small,
    color: theme.colors.textSubtle,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { fontSize: theme.text.screenTitle, fontWeight: '800', color: theme.colors.text, marginTop: 2 },
  sub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  stripWrap: { marginBottom: theme.spacing.sm },
  stageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  stageIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.md },
  stageCopy: { flex: 1 },
  stageTitle: { fontSize: theme.text.body, fontWeight: '800' },
  stageSub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2, lineHeight: 18 },
  rentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.successBg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#C6ECDC',
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  rentBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentBannerCopy: { flex: 1 },
  rentBannerTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.success },
  rentBannerText: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  ctaCopy: { flex: 1 },
  ctaRent: { fontSize: theme.text.screenTitle, fontWeight: '800', color: theme.colors.primaryDark },
  ctaPer: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  descText: {
    fontSize: theme.text.caption,
    color: theme.colors.text,
    lineHeight: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  timelineCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  timelineStep: { flexDirection: 'row' },
  timelineRail: { alignItems: 'center', marginRight: theme.spacing.md },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceVariant,
  },
  timelineDotCurrent: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  timelineConnector: { width: 2, flex: 1, backgroundColor: theme.colors.border, minHeight: 18, marginVertical: 4 },
  timelineStepBody: { flex: 1, paddingBottom: theme.spacing.lg, flexDirection: 'row', alignItems: 'center' },
  timelineStepBodyCurrent: { alignItems: 'baseline' },
  timelineStepLabel: { fontSize: theme.text.body, fontWeight: '600' },
  timelineStepTag: { fontSize: theme.text.small, fontWeight: '800', marginLeft: theme.spacing.sm, textTransform: 'uppercase' },
  timelineStepTagDone: {
    fontSize: theme.text.small,
    fontWeight: '700',
    marginLeft: theme.spacing.sm,
    color: theme.colors.success,
    textTransform: 'uppercase',
  },
  detailsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  detailRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  detailCell: { flex: 1 },
  detailCellIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  detailCellLabel: { fontSize: theme.text.small, color: theme.colors.textSubtle, fontWeight: '600' },
  detailCellValue: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text, marginTop: 2 },
  detailTextRow: { marginBottom: theme.spacing.md },
  detailTextLabel: { fontSize: theme.text.small, color: theme.colors.textSubtle, fontWeight: '600' },
  detailTextValue: { fontSize: theme.text.caption, color: theme.colors.text, marginTop: 2, lineHeight: 18 },
  latestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    flexWrap: 'wrap',
  },
  latestText: { fontSize: theme.text.caption, fontWeight: '700', color: theme.colors.text, flexShrink: 1 },
  latestDate: { fontSize: theme.text.caption, color: theme.colors.textSubtle },
  });