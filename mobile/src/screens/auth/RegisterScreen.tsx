import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Input, Screen } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { ApiClientError } from '../../api/client';
import { RootStackParamList } from '../../navigation/types';
import { theme } from '../../theme';

type Role = 'LANDLORD' | 'TENANT';

export default function RegisterScreen() {
  const { signUp, signingIn } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('TENANT');
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (name.trim().length < 2) return 'Please enter your name';
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please enter a valid email';
    if (password.length < 8) return 'Password must be at least 8 characters';
    return null;
  };

  const submit = async () => {
    const problem = validate();
    setError(problem);
    if (problem) return;
    try {
      await signUp({ name: name.trim(), email: email.trim(), phone: phone || undefined, password, role });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not register');
    }
  };

  const roleBtn = (r: Role, label: string) => (
    <Button
      label={label}
      variant={role === r ? 'primary' : 'secondary'}
      small
      onPress={() => setRole(r)}
    />
  );

  return (
    <Screen keyboard scroll>
      <Text style={styles.title}>Create an account</Text>
      <Text style={styles.subtitle}>Pick the role that matches how you use the platform.</Text>

      <View style={styles.roleRow}>
        {roleBtn('LANDLORD', 'Landlord')}
        {roleBtn('TENANT', 'Tenant')}
      </View>

      <Input label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <Input
        label="Phone (optional)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+91 "
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="At least 8 characters"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Register" onPress={() => void submit()} loading={signingIn} />

      <Pressable style={styles.footer} onPress={() => navigation.goBack()}>
        <Text style={styles.footerText}>
          Already have an account? <Text style={styles.footerLink}>Sign in</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: theme.text.title, fontWeight: '800', color: theme.colors.text },
  subtitle: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.body,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xl,
  },
  roleRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  error: { color: theme.colors.danger, fontSize: theme.text.caption, marginBottom: theme.spacing.md },
  footer: { marginTop: theme.spacing.xl, alignItems: 'center' },
  footerText: { color: theme.colors.textSubtle, fontSize: theme.text.body },
  footerLink: { color: theme.colors.primary, fontWeight: '700' },
});