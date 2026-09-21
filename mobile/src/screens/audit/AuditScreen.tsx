import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get } from '../../api/client';
import { AuditLogEntry } from '../../api/types';
import { useLoad } from '../../hooks';
import { Card, EmptyState, ErrorView, LoadingView, Screen, SectionHeader } from '../../components/ui';
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
      <SectionHeader title={tenancyId ? 'Tenancy audit trail' : 'My audit trail'} />

      {entries.length === 0 ? (
        <EmptyState
          title="No entries yet"
          subtitle="Important actions are recorded here and cannot be edited."
        />
      ) : (
        entries.map((e, i) => (
          <Card key={e.id}>
            <Text style={styles.action}>{humanize(e.action)}</Text>
            <Text style={styles.extra}>
              {e.entity_type.replace(/_/g, ' ')} · {formatDateTime(e.created_at)}
            </Text>
            {i === 0 && e.metadata ? (
              <Text style={styles.meta}>{JSON.stringify(e.metadata)}</Text>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  extra: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  meta: { color: theme.colors.textSubtle, fontSize: theme.text.small, marginTop: 4 },
});