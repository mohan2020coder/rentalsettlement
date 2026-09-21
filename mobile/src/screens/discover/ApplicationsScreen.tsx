import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { get, post, extractError } from '../../api/client';
import { Application } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, EmptyState, ErrorView, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { formatDate, formatMoney, humanize, statusColor } from '../../utils/format';
import { theme } from '../../theme';

type Busy = { id: string; action: string } | null;

export default function ApplicationsScreen() {
  const { user } = useAuth();
  const isLandlord = user?.role === 'LANDLORD';
  const applications = useLoad(async () => get<Application[]>('/applications'), []);
  const [busy, setBusy] = useState<Busy>(null);

  if (applications.loading) return <LoadingView label="Loading requests…" />;
  if (applications.error) {
    return <ErrorView message={applications.error} onRetry={applications.reload} />;
  }

  const list = applications.data ?? [];

  const act = async (id: string, action: 'approve' | 'reject' | 'cancel') => {
    setBusy({ id, action });
    try {
      await post<Application>(`/applications/${id}/${action}`);
      const title =
        action === 'approve'
          ? 'Request approved'
          : action === 'reject'
            ? 'Request rejected'
            : 'Request cancelled';
      const message =
        action === 'approve'
          ? 'The tenant was invited with the property terms, a rental agreement was placed for review, and the listing is now reserved.'
          : 'The request has been updated.';
      Alert.alert(title, message);
      applications.reload();
    } catch (err) {
      Alert.alert('Could not update request', extractError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const loadingFor = (id: string, action: string) => busy?.id === id && busy.action === action;

  return (
    <Screen scroll refreshing={applications.loading} onRefresh={applications.reload}>
      <SectionHeader title={isLandlord ? 'Visit requests' : 'My requests'} />

      {list.length === 0 ? (
        <EmptyState
          title="No requests yet"
          subtitle={
            isLandlord
              ? 'When a tenant sends a request for one of your properties it will appear here.'
              : 'Requests you send on the Discover tab appear here.'
          }
        />
      ) : (
        list.map((a) => {
          const pending = a.status === 'PENDING';
          const canApprove = isLandlord && pending;
          const canCancel = !isLandlord && pending;
          return (
            <Card key={a.id}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.name}>{a.property_name}</Text>
                  <Text style={styles.sub}>
                    {[a.locality, a.city].filter(Boolean).join(', ') || 'Location not set'}
                  </Text>
                  <Text style={styles.rent}>{formatMoney(a.monthly_rent_minor, a.currency)}/mo</Text>
                </View>
                <Badge label={humanize(a.status)} color={statusColor(a.status)} />
              </View>
              <Text style={styles.sub}>
                {isLandlord
                  ? `From ${a.tenant_name} (${a.tenant_email})`
                  : `To ${a.landlord_name}`}
              </Text>
              {a.preferred_date ? (
                <Text style={styles.sub}>Preferred date: {formatDate(a.preferred_date)}</Text>
              ) : null}
              {a.note ? <Text style={styles.note}>“{a.note}”</Text> : null}
              <Text style={styles.meta}>Sent {formatDate(a.created_at)}</Text>

              {canApprove && (
                <View style={styles.actions}>
                  <View style={styles.actionCol}>
                    <Button
                      label="Approve"
                      small
                      loading={loadingFor(a.id, 'approve')}
                      onPress={() => void act(a.id, 'approve')}
                    />
                  </View>
                  <View style={styles.actionCol}>
                    <Button
                      label="Reject"
                      variant="ghost"
                      small
                      loading={loadingFor(a.id, 'reject')}
                      onPress={() => void act(a.id, 'reject')}
                    />
                  </View>
                </View>
              )}
              {canCancel && (
                <View style={styles.actionGap}>
                  <Button
                    label="Cancel request"
                    variant="secondary"
                    small
                    loading={loadingFor(a.id, 'cancel')}
                    onPress={() => void act(a.id, 'cancel')}
                  />
                </View>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  info: { flex: 1, paddingRight: theme.spacing.md, gap: 2 },
  name: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  sub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  rent: {
    fontSize: theme.text.body,
    fontWeight: '600',
    color: theme.colors.primaryDark,
    marginTop: 4,
  },
  note: {
    fontSize: theme.text.caption,
    color: theme.colors.text,
    fontStyle: 'italic',
    marginTop: theme.spacing.sm,
  },
  meta: {
    fontSize: theme.text.small,
    color: theme.colors.textSubtle,
    marginTop: theme.spacing.sm,
  },
  actions: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md },
  actionCol: { flex: 1 },
  actionGap: { marginTop: theme.spacing.md },
});