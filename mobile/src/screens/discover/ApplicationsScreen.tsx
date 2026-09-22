import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { get, post, extractError } from '../../api/client';
import { Application } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button, EmptyState, ErrorView, LoadingView, Screen, ScreenTitle, StatusBadge } from '../../components/ui';
import { formatDate, formatMoney, humanize } from '../../utils/format';
import { theme } from '../../theme';

type Busy = { id: string; action: string } | null;

export default function ApplicationsScreen() {
  const { user } = useAuth();
  const isLandlord = user?.role === 'LANDLORD';
  const applications = useLoad(async () => get<Application[]>('/applications'), [], { refreshOnFocus: true });
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
      <ScreenTitle title={isLandlord ? 'Visit requests' : 'My requests'} />
      <Text style={styles.subtitle}>
        {isLandlord
          ? 'Tenant interest in your listed properties'
          : 'Your visit requests and their status'}
      </Text>

      {list.length === 0 ? (
        <EmptyState
          icon="paper-plane-outline"
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
            <View key={a.id} style={styles.card}>
              <View style={styles.topRow}>
                <View style={styles.partyIcon}>
                  <Ionicons
                    name={isLandlord ? 'person-outline' : 'business-outline'}
                    size={18}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{a.property_name}</Text>
                  <Text style={styles.sub}>
                    {[a.locality, a.city].filter(Boolean).join(', ') || 'Location not set'}
                  </Text>
                  <Text style={styles.rent}>{formatMoney(a.monthly_rent_minor, a.currency)}/mo</Text>
                </View>
                <StatusBadge label={humanize(a.status)} />
              </View>

              <View style={styles.contactBox}>
                <Text style={styles.contact}>
                  {isLandlord ? 'From' : 'To'}{' '}
                  <Text style={styles.contactStrong}>
                    {isLandlord ? a.tenant_name : a.landlord_name}
                  </Text>
                </Text>
                {isLandlord && a.tenant_email ? (
                  <Text style={styles.sub}>{a.tenant_email}</Text>
                ) : null}
              </View>

              {a.preferred_date ? (
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={15} color={theme.colors.textSubtle} />
                  <Text style={styles.sub}>Preferred {formatDate(a.preferred_date)}</Text>
                </View>
              ) : null}
              {a.note ? <Text style={styles.note}>“{a.note}”</Text> : null}
              <Text style={styles.meta}>Sent {formatDate(a.created_at)}</Text>

              {canApprove && (
                <View style={styles.actions}>
                  <View style={styles.actionCol}>
                    <Button
                      label="Approve"
                      small
                      icon="checkmark-outline"
                      loading={loadingFor(a.id, 'approve')}
                      onPress={() => void act(a.id, 'approve')}
                    />
                  </View>
                  <View style={styles.actionCol}>
                    <Button
                      label="Reject"
                      variant="ghost"
                      small
                      icon="close-outline"
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
                    icon="close-circle-outline"
                    loading={loadingFor(a.id, 'cancel')}
                    onPress={() => void act(a.id, 'cancel')}
                  />
                </View>
              )}
            </View>
          );
        })
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
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start' },
  partyIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  info: { flex: 1, paddingRight: theme.spacing.sm },
  name: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  sub: { fontSize: theme.text.caption, color: theme.colors.textSubtle, marginTop: 2 },
  rent: {
    fontSize: theme.text.body,
    fontWeight: '600',
    color: theme.colors.primaryDark,
    marginTop: 4,
  },
  contactBox: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  contact: { fontSize: theme.text.caption, color: theme.colors.textSubtle },
  contactStrong: { color: theme.colors.text, fontWeight: '700' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: theme.spacing.sm },
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