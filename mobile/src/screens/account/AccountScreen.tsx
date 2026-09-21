import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthContext';
import { put, extractError } from '../../api/client';
import { User } from '../../api/types';
import { Button, Card, Divider, Input, ListItem, Row, Screen } from '../../components/ui';
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

  return (
    <Screen scroll>
      <Card>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.sub}>{user.email}</Text>
        <Text style={styles.sub}>{user.role === 'LANDLORD' ? 'Landlord' : 'Tenant'} account</Text>
      </Card>

      {editing ? (
        <Card>
          <Input label="Full name" value={name} onChangeText={setName} />
          <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Save profile" onPress={() => void save()} loading={saving} />
          <Button label="Cancel" variant="ghost" small onPress={() => setEditing(false)} style={styles.gap} />
        </Card>
      ) : (
        <Card>
          <Row label="Name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone ?? '—'} />
          <Row label="Member since" value={new Date().getFullYear().toString()} subtle />
          <Divider />
          <Button label="Edit profile" variant="secondary" onPress={startEdit} />
        </Card>
      )}

      <ListItem
        title="My audit trail"
        subtitle="Your recorded actions on the platform"
        onPress={() => navigation.navigate('Audit', {})}
      />

      <View style={styles.logout}>
        <Button label="Sign out" variant="danger" onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: theme.text.title, fontWeight: '800', color: theme.colors.text },
  sub: { color: theme.colors.textSubtle, fontSize: theme.text.caption, marginTop: 2 },
  gap: { marginTop: theme.spacing.sm },
  logout: { marginTop: theme.spacing.lg },
  error: { color: theme.colors.danger, fontSize: theme.text.caption, marginBottom: theme.spacing.md },
});