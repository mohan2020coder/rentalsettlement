import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '../../api/client';
import { Button, Field, Screen } from '../../components';
import { useAuth } from '../../store/AuthContext';
import { theme } from '../../theme';

export function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title}>Rental Settlement</Text>
        <Text style={styles.tagline}>Agree, document and settle your rental deposit.</Text>
      </View>

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
        placeholder="••••••••"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Sign in" onPress={onSubmit} loading={busy} />
      <Button title="Create an account" variant="ghost" onPress={() => navigation.navigate('Register')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginVertical: theme.spacing.xl,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
  },
  tagline: {
    fontSize: theme.text.body,
    color: theme.colors.textSubtle,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.text.caption,
    marginBottom: theme.spacing.md,
  },
});