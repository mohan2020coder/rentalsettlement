import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError } from '../../api/client';
import { MaintenanceComment, MaintenanceRequest } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Badge, Button, Card, Divider, ErrorView, Input, LoadingView, Screen } from '../../components/ui';
import { formatDateTime, humanize, timeAgo } from '../../utils/format';
import { theme } from '../../theme';

const ALL_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

export default function MaintenanceDetailScreen({
  route,
}: RootStackScreenProps<'MaintenanceDetail'>) {
  const { maintenanceId } = route.params;
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const request = useLoad(
    async () => get<MaintenanceRequest>(`/maintenance/${maintenanceId}`),
    [maintenanceId],
  );
  const comments = useLoad(
    async () => get<MaintenanceComment[]>(`/maintenance/${maintenanceId}/comments`),
    [maintenanceId],
  );

  if (request.loading) return <LoadingView label="Loading request…" />;
  if (request.error || !request.data) {
    return <ErrorView message={request.error ?? 'Missing'} onRetry={request.reload} />;
  }

  const m = request.data;
  const isLandlord = user?.role === 'LANDLORD';
  const closed = m.status === 'RESOLVED' || m.status === 'REJECTED';

  const setStatus = async (status: string) => {
    setBusy(status);
    try {
      await post<MaintenanceRequest>(`/maintenance/${maintenanceId}/status`, { status });
      request.reload();
      Alert.alert('Updated', `Request is now ${humanize(status)}.`);
    } catch (err) {
      Alert.alert('Could not update', extractError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const addComment = async () => {
    if (!body.trim()) return;
    setPosting(true);
    try {
      await post<MaintenanceComment>(`/maintenance/${maintenanceId}/comments`, {
        body: body.trim(),
      });
      setBody('');
      comments.reload();
    } catch (err) {
      Alert.alert('Could not comment', extractError(err).message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <Screen scroll keyboard>
      <Card>
        <View style={styles.headRow}>
          <Text style={styles.title}>{m.title}</Text>
          <Badge label={humanize(m.status)} />
        </View>
        <Text style={styles.sub}>
          {m.category.replace(/_/g, ' ')} · {humanize(m.priority)} priority · reported{' '}
          {formatDateTime(m.reported_at)}
        </Text>
        {m.description ? <Text style={styles.desc}>{m.description}</Text> : null}
        {m.resolved_at ? (
          <Text style={styles.sub}>Resolved {formatDateTime(m.resolved_at)}</Text>
        ) : null}

        {!closed && (
          <>
            <Text style={styles.section}>Update status</Text>
            <View style={styles.statusRow}>
              {ALL_STATUSES.filter((s) => s !== m.status).map((s) => {
                const landlordOnly = s === 'RESOLVED' || s === 'REJECTED';
                if (landlordOnly && !isLandlord) return null;
                return (
                  <Button
                    key={s}
                    label={humanize(s)}
                    small
                    variant={s === 'RESOLVED' ? 'primary' : 'secondary'}
                    loading={busy === s}
                    onPress={() => void setStatus(s)}
                  />
                );
              })}
            </View>
          </>
        )}
      </Card>

      <Text style={styles.section}>Discussion</Text>
      <Card>
        {(comments.data ?? []).length === 0 ? (
          <Text style={styles.sub}>No comments yet.</Text>
        ) : (
          comments.data!.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <Text style={styles.commentBody}>{c.body}</Text>
              <Text style={styles.commentMeta}>{timeAgo(c.created_at)}</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Input
          label="Add a comment"
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={3}
          placeholder="Update for both parties on this issue…"
          style={styles.multiline}
        />
        <Button label="Post comment" small variant="secondary" onPress={() => void addComment()} loading={posting} disabled={!body.trim()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.text, flex: 1, paddingRight: theme.spacing.md },
  sub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: theme.spacing.xs },
  desc: { color: theme.colors.text, fontSize: theme.text.body, marginTop: theme.spacing.sm },
  section: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.text, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  commentBody: { color: theme.colors.text, fontSize: theme.text.body },
  commentMeta: { color: theme.colors.textSubtle, fontSize: theme.text.small, marginTop: 2 },
  multiline: { height: 80, textAlignVertical: 'top' },
});