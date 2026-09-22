import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { patch, extractError } from '../../api/client';
import { User } from '../../api/types';
import { Avatar, Button, Divider, Input, Row, Screen, Tag } from '../../components/ui';
import { RootStackParamList } from '../../navigation/types';
import { theme } from '../../theme';

export default function AccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const initials = (user.name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  const startEdit = () => {
    setName(user.name);
    setPhone(user.phone ?? '');
    setEditing(true);
  };

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      const updated = await patch<User>('/users/me', {
        name: name.trim().length ? name.trim() : user.name,
        phone: phone.trim() || undefined,
      });
      updateUser(updated);
      setEditing(false);
    } catch (err) {
      setError(extractError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime with your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <Screen scroll>
      <Text style={styles.pageTitle}>Account</Text>

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.heroRing}>
          <Avatar name={initials} size={64} />
        </View>
        <Text style={styles.heroName}>{user.name}</Text>
        <Text style={styles.heroSub}>{user.email}</Text>
        <View style={styles.heroRoleRow}>
          <Tag label={user.role === 'LANDLORD' ? 'Landlord' : 'Tenant'} color="rgba(255,255,255,0.22)" />
          <Tag label={user.phone ?? 'No phone'} color="rgba(255,255,255,0.12)" />
        </View>
      </View>

      <View style={styles.quickRow}>
        <Pressable style={styles.quickTile} onPress={() => navigation.navigate('Audit', {})}>
          <View style={styles.quickIcon}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
          </View>
          <Text style={styles.quickTitle}>Audit trail</Text>
          <Text style={styles.quickSub}>Your recorded actions</Text>
        </Pressable>
        <Pressable style={styles.quickTile} onPress={() => navigation.navigate('Main', { screen: 'Billing' })}>
          <View style={styles.quickIcon}>
            <Ionicons name="sparkles-outline" size={20} color={theme.colors.primary} />
          </View>
          <Text style={styles.quickTitle}>Plan & usage</Text>
          <Text style={styles.quickSub}>Limits and storage</Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.card}>
          <Input label="Full name" value={name} onChangeText={setName} icon="person-outline" />
          <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon="call-outline" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Save profile" icon="checkmark-outline" onPress={() => void save()} loading={saving} />
          <Button label="Cancel" variant="ghost" small onPress={() => setEditing(false)} style={styles.gap} />
        </View>
      ) : (
        <View style={styles.card}>
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone ?? 'Not set'} />
          <Divider />
          <Button label="Edit profile" variant="secondary" icon="create-outline" onPress={startEdit} />
        </View>
      )}

      <View style={styles.logout}>
        <Button label="Sign out" variant="danger" icon="log-out-outline" onPress={confirmSignOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: theme.text.screenTitle, fontWeight: '800', color: theme.colors.text },
  hero: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroRing: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    padding: 3,
    marginBottom: theme.spacing.md,
  },
  heroName: { fontSize: theme.text.heading, fontWeight: '800', color: theme.colors.white },
  heroSub: { fontSize: theme.text.caption, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  heroRoleRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  quickRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  quickTile: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  quickTitle: { fontSize: theme.text.body, fontWeight: '700', color: theme.colors.text },
  quickSub: { fontSize: theme.text.small, color: theme.colors.textSubtle, marginTop: 1 },
  identitySection: { marginTop: theme.spacing.sm, marginBottom: theme.spacing.sm },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  gap: { marginTop: theme.spacing.sm },
  error: { color: theme.colors.danger, fontSize: theme.text.caption, marginBottom: theme.spacing.md },
  logout: { marginTop: theme.spacing.lg },
});