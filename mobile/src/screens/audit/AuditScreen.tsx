import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { get } from '../../api/client';
import { AuditLogEntry } from '../../api/types';
import { useLoad } from '../../hooks';
import { EmptyState, ErrorView, LoadingView, Screen, ScreenTitle, TimelineItem } from '../../components/ui';
import { formatDateTime, humanize } from '../../utils/format';
import { theme } from '../../theme';

export default function AuditScreen({ route }: RootStackScreenProps<'Audit'>) {
  const tenancyId = route.params?.tenancyId;
  const audit = useLoad(
    async () => (tenancyId ? get<AuditLogEntry[]>(`/audit/tenancy/${tenancyId}`) : get<AuditLogEntry[]>('/audit/me')),
    [tenancyId],
  );

  if (audit.loading) return <LoadingView label="Loading audit trail…" />;
  if (audit.error) return <ErrorView message={audit.error} onRetry={audit.reload} />;

  const entries = audit.data ?? [];

  return (
    <Screen scroll refreshing={audit.loading} onRefresh={audit.reload}>
      <ScreenTitle title={tenancyId ? 'Tenancy audit' : 'My audit trail'} />
      <Text style={styles.subtitle}>
        Key actions are recorded here and cannot be edited.
      </Text>

      {entries.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="No entries yet"
          subtitle="Important actions are recorded here and cannot be edited."
        />
      ) : (
        <View style={styles.card}>
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