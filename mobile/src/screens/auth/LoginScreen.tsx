import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Input, Screen } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { ApiClientError } from '../../api/client';
import { RootStackParamList } from '../../navigation/types';
import { theme } from '../../theme';

export default function LoginScreen() {
  const { signIn, signingIn } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: string, p: string) => {
    setError(null);
    try {
      await signIn(e, p);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not sign in');
    }
  };

  return (
    <Screen keyboard scroll>
      <View style={styles.header}>
        <Text style={styles.logo}>Rental Settlement</Text>
        <Text style={styles.tagline}>
          Agree on property inspections, maintenance, deductions and deposits — and
          record the outcome together.
        </Text>
      </View>

      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@example.com"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Your password"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Sign in"
        onPress={() => submit(email, password)}
        loading={signingIn}
        disabled={!email || !password}
      />

      <View style={styles.demoRow}>
        <Text style={styles.demoLabel}>Demo accounts</Text>
        <Text style={styles.demoHint}>tap to fill and sign in</Text>
      </View>
      <View style={styles.demoButtons}>
        <Button
          label="Landlord"
          variant="secondary"
          onPress={() => submit('rajesh@example.in', 'Demo@1234')}
          loading={false}
        />
        <Button
          label="Tenant"
          variant="secondary"
          onPress={() => submit('arun@example.in', 'Demo@1234')}
          loading={false}
        />
      </View>

      <Pressable style={styles.footer} onPress={() => navigation.navigate('Register')}>
        <Text style={styles.footerText}>
          New here? <Text style={styles.footerLink}>Create an account</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: theme.spacing.xl, marginTop: theme.spacing.xl },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.primaryDark,
    marginBottom: theme.spacing.sm,
  },
  tagline: { color: theme.colors.textSubtle, fontSize: theme.text.body, lineHeight: 22 },
  error: {
    color: theme.colors.danger,
    fontSize: theme.text.caption,
    marginBottom: theme.spacing.md,
  },
  demoRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: theme.spacing.xl },
  demoLabel: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    fontWeight: '600',
  },
  demoHint: {
    fontSize: theme.text.small,
    color: theme.colors.textSubtle,
    marginLeft: theme.spacing.sm,
  },
  demoButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  footer: { marginTop: theme.spacing.xl, alignItems: 'center' },
  footerText: { color: theme.colors.textSubtle, fontSize: theme.text.body },
  footerLink: { color: theme.colors.primary, fontWeight: '700' },
});