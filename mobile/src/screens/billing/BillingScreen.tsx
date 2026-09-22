import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLoad } from '../../hooks';
import { get, post, extractError } from '../../api/client';
import { Plan, Subscription, Usage } from '../../api/types';
import { Badge, Button, ErrorView, LoadingView, Row, Screen, ScreenTitle, StatusBadge } from '../../components/ui';
import { formatBytes, formatMoney, humanize, statusColor } from '../../utils/format';
import { theme } from '../../theme';

export default function BillingScreen() {
  const subscription = useLoad(async () => get<Subscription>('/billing/subscription'), [], { refreshOnFocus: true });
  const usage = useLoad(async () => get<Usage>('/billing/usage'), [], { refreshOnFocus: true });
  const plans = useLoad(async () => get<Plan[]>('/billing/plans'), [], { refreshOnFocus: true });
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

  const pctColor = (pct: number) =>
    pct >= 90 ? theme.colors.danger : pct >= 70 ? theme.colors.warning : theme.colors.primary;

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
          <View
            style={[
              styles.meterFill,
              { width: `${pct}%`, backgroundColor: pctColor(pct) },
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <Screen scroll refreshing={subscription.loading} onRefresh={() => { subscription.reload(); usage.reload(); }}>
      <ScreenTitle title="Plan" />
      <Text style={styles.subtitle}>Your current plan, limits and usage.</Text>

      <View style={styles.planCard}>
        <View style={styles.headRow}>
          <View style={styles.planIcon}>
            <Ionicons name="sparkles-outline" size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
            <Text style={styles.planName}>{sub.plan.name}</Text>
            <StatusBadge label={humanize(sub.status)} />
          </View>
          <Text style={styles.planPrice}>
            {sub.plan.price_minor > 0 ? formatMoney(sub.plan.price_minor, sub.plan.currency) : 'Free'}
            <Text style={styles.planPer}>/mo</Text>
          </Text>
        </View>
        <Text style={styles.planDesc}>{sub.plan.description}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.subHead}>Usage this month</Text>
        {meter('Properties', usages.property_count, sub.plan.max_properties)}
        {meter('Active tenancies', usages.active_tenancy_count, sub.plan.max_active_tenancies)}
        {meter(
          'Storage',
          Math.round(usages.storage_bytes / 1048576),
          sub.plan.max_storage_mb,
          ' MB',
        )}
        {usages.storage_bytes > 0 ? (
          <Row label="Stored files" value={formatBytes(usages.storage_bytes)} subtle />
        ) : null}
      </View>

      <Text style={styles.section}>All plans</Text>
      {plansList.map((p) => {
        const currentPlan = sub.plan.code === p.code;
        const price = p.price_minor > 0 ? formatMoney(p.price_minor, p.currency) : 'Free';
        return (
          <View key={p.id} style={[styles.card, currentPlan && styles.currentCard]}>
            <View style={styles.planRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.planRowTop}>
                  <Text style={styles.planNameSmall}>{p.name}</Text>
                  {currentPlan ? <Badge label="Current plan" color={theme.colors.success} /> : null}
                </View>
                <Text style={styles.planListDesc}>{p.description}</Text>
              </View>
              <Text style={styles.planPriceSmall}>{price}/mo</Text>
            </View>
            {!currentPlan && (
              <Button
                label={`Switch to ${p.name}`}
                variant="secondary"
                small
                loading={changing === p.code}
                onPress={() => void changePlan(p.code)}
                style={styles.switch}
              />
            )}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2, marginBottom: theme.spacing.md },
  planCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadow.card,
  },
  headRow: { flexDirection: 'row', alignItems: 'center' },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  planName: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.white },
  planPrice: { fontSize: 22, fontWeight: '800', color: theme.colors.white },
  planPer: { fontSize: theme.text.caption, fontWeight: '600', color: theme.colors.primaryLight },
  planDesc: { color: theme.colors.primaryLight, fontSize: theme.text.caption, marginTop: theme.spacing.sm, lineHeight: 17 },
  planListDesc: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 4, lineHeight: 17 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  currentCard: { borderColor: theme.colors.success, borderWidth: 1.5 },
  subHead: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.md },
  meter: { marginBottom: theme.spacing.md },
  meterLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  meterText: { color: theme.colors.textSubtle, fontSize: theme.text.caption },
  meterValue: { color: theme.colors.text, fontSize: theme.text.caption, fontWeight: '600' },
  meterTrack: { height: 8, borderRadius: 4, backgroundColor: theme.colors.primarySoft, overflow: 'hidden' },
  meterFill: { height: 8, borderRadius: 4 },
  section: {
    fontSize: theme.text.heading,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  planRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md },
  planRowTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  planNameSmall: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  planPriceSmall: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.primaryDark },
  switch: { marginTop: theme.spacing.md },
});