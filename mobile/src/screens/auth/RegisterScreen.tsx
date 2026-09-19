import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '../../api/client';
import { Button, Field, Screen } from '../../components';
import { useAuth } from '../../store/AuthContext';
import { theme } from '../../theme';
import { Role } from '../../types';

export function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('TENANT');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError('Fill in your name and email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password, role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.heading}>Create your account</Text>

      <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@example.com"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="At least 8 characters"
      />

      <Text style={styles.roleLabel}>I am a</Text>
      <View style={styles.roleRow}>
        {(['LANDLORD', 'TENANT'] as Role[]).map((r) => (
          <Pressable
            key={r}
            onPress={() => setRole(r)}
            style={[styles.roleChip, role === r && styles.roleChipActive]}
          >
            <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
              {r === 'LANDLORD' ? 'Landlord' : 'Tenant'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Create account" onPress={onSubmit} loading={busy} />
      <Button title="Back to sign in" variant="ghost" onPress={() => navigation.navigate('Login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: theme.text.heading,
    fontWeight: '700',
    color: theme.colors.text,
    marginVertical: theme.spacing.lg,
  },
  roleLabel: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    fontWeight: '500',
    marginBottom: theme.spacing.xs,
  },
  roleRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  roleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  roleChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  roleChipText: {
    fontSize: theme.text.body,
    color: theme.colors.text,
  },
  roleChipTextActive: {
    color: theme.colors.white,
    fontWeight: '700',
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.text.caption,
    marginBottom: theme.spacing.md,
  },
});