import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackScreenProps } from '../../navigation/types';
import { get, post, extractError } from '../../api/client';
import { MaintenanceComment, MaintenanceRequest } from '../../api/types';
import { useLoad } from '../../hooks';
import { useAuth } from '../../auth/AuthContext';
import { Button, ErrorView, Input, LoadingView, Screen, StatusBadge, Tag } from '../../components/ui';
import { formatDateTime, humanize, timeAgo } from '../../utils/format';
import { theme } from '../../theme';

const ALL_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

const PRIORITY_COLORS: Record<string, string> = {
  LOW: theme.colors.success,
  MEDIUM: theme.colors.warning,
  HIGH: theme.colors.danger,
  URGENT: theme.colors.danger,
};

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
    { refreshOnFocus: true },
  );
  const comments = useLoad(
    async () => get<MaintenanceComment[]>(`/maintenance/${maintenanceId}/comments`),
    [maintenanceId],
    { refreshOnFocus: true },
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
      <View style={styles.card}>
        <View style={styles.headRow}>
          <View style={styles.headIcon}>
            <Ionicons name="construct-outline" size={22} color={theme.colors.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{m.title}</Text>
            <Text style={styles.sub}>Reported {formatDateTime(m.reported_at)}</Text>
          </View>
          <StatusBadge label={humanize(m.status)} />
        </View>

        <View style={styles.tagsRow}>
          <Tag label={m.category.replace(/_/g, ' ')} color={theme.colors.primary} />
          <Tag
            label={`${humanize(m.priority)} priority`}
            color={PRIORITY_COLORS[m.priority] ?? theme.colors.textSubtle}
          />
        </View>

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
                    variant={s === 'RESOLVED' ? 'primary' : 'ghost'}
                    loading={busy === s}
                    onPress={() => void setStatus(s)}
                  />
                );
              })}
            </View>
          </>
        )}
      </View>

      <Text style={styles.section}>Discussion</Text>
      <View style={styles.card}>
        {(comments.data ?? []).length === 0 ? (
          <Text style={styles.sub}>No comments yet.</Text>
        ) : (
          comments.data!.map((c) => (
            <View key={c.id} style={styles.comment}>
              <View style={styles.commentAvatar}>
                <Ionicons name="person-outline" size={16} color={theme.colors.primary} />
              </View>
              <View style={styles.commentBody}>
                <Text style={styles.commentText}>{c.body}</Text>
                <Text style={styles.commentMeta}>{timeAgo(c.created_at)}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Input
          label="Add a comment"
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={3}
          placeholder="Update for both parties on this issue…"
          style={styles.multiline}
        />
        <Button
          label="Post comment"
          variant="secondary"
          icon="send-outline"
          onPress={() => void addComment()}
          loading={posting}
          disabled={!body.trim()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  headIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: theme.colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: theme.text.heading, fontWeight: '700', color: theme.colors.text, flex: 1 },
  sub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  tagsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  desc: { color: theme.colors.text, fontSize: theme.text.body, marginTop: theme.spacing.md },
  section: {
    fontSize: theme.text.heading,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  comment: { flexDirection: 'row', marginBottom: theme.spacing.md },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  commentBody: { flex: 1 },
  commentText: { color: theme.colors.text, fontSize: theme.text.body },
  commentMeta: { color: theme.colors.textSubtle, fontSize: theme.text.small, marginTop: 2 },
  multiline: { height: 80, textAlignVertical: 'top' },
});