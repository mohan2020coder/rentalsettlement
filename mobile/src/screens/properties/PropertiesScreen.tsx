import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { get } from '../../api/client';
import { Property } from '../../api/types';
import { useLoad } from '../../hooks';
import { Badge, Button, Card, EmptyState, ErrorView, LoadingView, Screen, SectionHeader } from '../../components/ui';
import { RootStackParamList } from '../../navigation/types';
import { formatDate, formatMoney, statusColor } from '../../utils/format';
import { theme } from '../../theme';

export default function PropertiesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const props = useLoad(async () => get<Property[]>('/properties'), []);

  if (props.loading) return <LoadingView label="Loading properties…" />;
  if (props.error) return <ErrorView message={props.error} onRetry={props.reload} />;

  const list = props.data ?? [];

  return (
    <Screen scroll refreshing={props.loading} onRefresh={props.reload}>
      <SectionHeader
        title="Properties"
        action={
          <View style={styles.headerActions}>
            <Button
              label="Visit requests"
              variant="secondary"
              small
              onPress={() => navigation.navigate('Applications')}
            />
            <Button label="+ Add" small onPress={() => navigation.navigate('PropertyForm', {})} />
          </View>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          title="No properties yet"
          subtitle="Add your first rental property to start inviting tenants."
        />
      ) : (
        list.map((p) => (
          <Card
            key={p.id}
            onPress={() => navigation.navigate('PropertyForm', { propertyId: p.id })}
          >
            <View style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.name}>{p.property_name}</Text>
                <Text style={styles.sub}>
                  {[p.locality, p.city, p.state].filter(Boolean).join(', ') || 'Address not set'}
                </Text>
                <Text style={styles.sub}>
                  {p.property_type.replace(/_/g, ' ')}
                  {p.bedrooms ? ` · ${p.bedrooms} BHK` : ''} · since {formatDate(p.created_at)}
                </Text>
                <Text style={styles.listState}>
                  {p.monthly_rent_minor > 0 ? `${formatMoney(p.monthly_rent_minor, p.currency)}/mo · ` : ''}
                  {p.listed ? 'Listed on marketplace' : 'Not listed'}
                </Text>
              </View>
              <Badge label={p.status} color={statusColor(p.status)} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: theme.spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  info: { flex: 1, paddingRight: theme.spacing.md, gap: 2 },
  name: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  sub: { fontSize: theme.text.caption, color: theme.colors.textSubtle },
  listState: {
    fontSize: theme.text.small,
    fontWeight: '600',
    color: theme.colors.primaryDark,
    marginTop: 2,
  },
});