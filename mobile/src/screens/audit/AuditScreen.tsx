import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { get } from '../../api/client';
import { AuditLogEntry, Tenancy } from '../../api/types';
import { useLoad } from '../../hooks';
import { EmptyState, ErrorView, LoadingView, Screen, ScreenTitle, TimelineItem } from '../../components/ui';
import { formatDateTime, humanize } from '../../utils/format';
import { theme } from '../../theme';

const ACTION_ICONS: Record<string, 'shield-checkmark-outline' | 'briefcase-outline' | 'document-text-outline' | 'camera-outline' | 'construct-outline' | 'chatbubble-ellipses-outline' | 'receipt-outline' | 'time-outline'> = {
  PROPERTY_CREATED: 'briefcase-outline',
  PROPERTY_UPDATED: 'briefcase-outline',
  TENANCY_CREATED: 'briefcase-outline',
  TENANCY_INVITED: 'briefcase-outline',
  TENANCY_ACCEPTED: 'briefcase-outline',
  TENANCY_CANCELLED: 'shield-checkmark-outline',
  AGREEMENT_CREATED: 'document-text-outline',
  AGREEMENT_CONFIRMED: 'document-text-outline',
  INSPECTION_CREATED: 'camera-outline',
  INSPECTION_CONFIRMED: 'camera-outline',
  MAINTENANCE_CREATED: 'construct-outline',
  DEDUCTION_CREATED: 'chatbubble-ellipses-outline',
  SETTLEMENT_GENERATED: 'receipt-outline',
  SETTLEMENT_CONFIRMED: 'receipt-outline',
};

export default function AuditScreen({ route }: RootStackScreenProps<'Audit'>) {
  const tenancyId = route.params?.tenancyId;
  const tenancy = useLoad<Tenancy | null>(
    async () => (tenancyId ? get<Tenancy>(`/tenancies/${tenancyId}`).catch(() => null) : Promise.resolve(null)),
    [tenancyId],
  );
  const audit = useLoad(
    async () => (tenancyId ? get<AuditLogEntry[]>(`/audit/tenancy/${tenancyId}`) : get<AuditLogEntry[]>('/audit/me')),
    [tenancyId],
  );

  if (audit.loading || tenancy.loading) return <LoadingView label="Loading audit trail…" />;
  if (audit.error) return <ErrorView message={audit.error} onRetry={audit.reload} />;

  const entries = audit.data ?? [];
  const propName = tenancy.data?.property_name ?? '';
  const actionMeta = (e: AuditLogEntry) => {
    const icon = ACTION_ICONS[e.action] ?? 'shield-checkmark-outline';
    const color =
      e.action === 'SETTLEMENT_CONFIRMED' || e.action === 'AGREEMENT_CONFIRMED'
        ? theme.colors.success
        : e.entity_type.toLowerCase().includes('maintenance') || e.entity_type.toLowerCase().includes('deduction')
          ? theme.colors.warning
          : theme.colors.primary;
    return { icon, color };
  };

  return (
    <Screen scroll refreshing={audit.loading} onRefresh={audit.reload}>
      <ScreenTitle title={tenancyId ? (propName ? `${propName} · audit` : 'Tenancy audit') : 'My audit trail'} />
      <Text style={styles.subtitle}>
        {tenancyId && propName
          ? `Complete, uneditable record of the ${propName} tenancy.`
          : 'Key actions are recorded here and cannot be edited.'}
      </Text>

      {entries.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="No entries yet"
          subtitle="Important actions are recorded here and cannot be edited."
        />
      ) : (
        <View style={styles.card}>
          {entries.map((e, i) => {
            const meta = actionMeta(e);
            const entityLabel = e.entity_type.replace(/_/g, ' ');
            return (
              <TimelineItem
                key={e.id}
                icon={meta.icon}
                color={meta.color}
                title={humanize(e.action)}
                meta={`${propName ? `${propName} · ` : ''}${entityLabel} · ${formatDateTime(e.created_at)}`}
                isLast={i === entries.length - 1}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2, marginBottom: theme.spacing.md },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
});