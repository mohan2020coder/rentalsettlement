import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLoad } from '../../hooks';
import { get, post, extractError } from '../../api/client';
import { Plan, Subscription, Usage } from '../../api/types';
import { Badge, Button, Card, ErrorView, LoadingView, Row, Screen, SectionHeader } from '../../components/ui';
import { formatBytes, formatMoney, humanize, statusColor } from '../../utils/format';
import { theme } from '../../theme';

export default function BillingScreen() {
  const subscription = useLoad(async () => get<Subscription>('/billing/subscription'), []);
  const usage = useLoad(async () => get<Usage>('/billing/usage'), []);
  const plans = useLoad(async () => get<Plan[]>('/billing/plans'), []);
  const [changing, setChanging] = useState<string | null>(null);

  if (subscription.loading || usage.loading || plans.loading) {
    return <LoadingView label="Loading billing…" />;
  }
  if (subscription.error) return <ErrorView message={subscription.error} onRetry={subscription.reload} />;

  const sub = subscription.data!;
  const usages = usage.data!;
  const plansList = plans.data ?? [];

  const changePlan = async (code: string) => {
    setChanging(code);
    try {
      await post<Subscription>('/billing/change-plan', { plan_code: code });
      Alert.alert('Plan updated', `You are now on the ${code} plan.`);
      subscription.reload();
      usage.reload();
    } catch (err) {
      Alert.alert('Could not change plan', extractError(err).message);
    } finally {
      setChanging(null);
    }
  };

  const meter = (label: string, current: number, max: number, suffix = '') => {
    const pct = max <= 0 ? 0 : Math.min(100, Math.round((current / max) * 100));
    return (
      <View style={styles.meter}>
        <View style={styles.meterLabel}>
          <Text style={styles.meterText}>{label}</Text>
          <Text style={styles.meterValue}>
            {current}
            {suffix}
            {max >= 0 ? ` / ${max}${suffix}` : ''}
          </Text>
        </View>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${pct}%` }]} />
        </View>
      </View>
    );
  };

  return (
    <Screen scroll refreshing={subscription.loading} onRefresh={() => { subscription.reload(); usage.reload(); }}>
      <SectionHeader title="Billing" />

      <Card>
        <View style={styles.headRow}>
          <Text style={styles.planName}>{sub.plan.name}</Text>
          <Badge label={humanize(sub.status)} color={statusColor(sub.status)} />
        </View>
        <Text style={styles.planPrice}>
          {sub.plan.price_minor > 0 ? formatMoney(sub.plan.price_minor, sub.plan.currency) : 'Free'} / month
        </Text>
        <Text style={styles.planDesc}>{sub.plan.description}</Text>
      </Card>

      <Card>
        <Text style={styles.subHead}>Usage</Text>
        {meter(
          'Properties',
          usages.property_count,
          sub.plan.max_properties,
        )}
        {meter('Active tenancies', usages.active_tenancy_count, sub.plan.max_active_tenancies)}
        {meter('Storage (MB)', Math.round(usages.storage_bytes / 1048576), sub.plan.max_storage_mb, '')}
        <Row label="Storage bytes" value={formatBytes(usages.storage_bytes)} subtle />
      </Card>

      <SectionHeader title="Available plans" />
      {plansList.map((p) => {
        const currentPlan = sub.plan.code === p.code;
        return (
          <Card key={p.id}>
            <Row label={p.name} value={p.price_minor > 0 ? `${formatMoney(p.price_minor, p.currency)}/mo` : 'Free'} />
            <Text style={styles.planDesc}>{p.description}</Text>
            {currentPlan ? (
              <Badge label="Current plan" />
            ) : (
              <Button
                label={`Switch to ${p.name}`}
                variant="secondary"
                small
                loading={changing === p.code}
                onPress={() => void changePlan(p.code)}
              />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.text },
  planPrice: { fontSize: theme.text.title, fontWeight: '800', color: theme.colors.primaryDark, marginTop: theme.spacing.sm },
  planDesc: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: theme.spacing.xs },
  subHead: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.sm },
  meter: { marginBottom: theme.spacing.md },
  meterLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  meterText: { color: theme.colors.textSubtle, fontSize: theme.text.caption },
  meterValue: { color: theme.colors.text, fontSize: theme.text.caption, fontWeight: '600' },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: theme.colors.primarySoft, overflow: 'hidden' },
  meterFill: { height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },
});