import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, RoleCard, Screen } from '../../components/ui';
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
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <Screen keyboard scroll>
      <View style={styles.head}>
        <View style={styles.logoMark}>
          <Ionicons name="shield-checkmark" size={22} color={theme.colors.white} />
        </View>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join RentSafe to manage your rental journey</Text>
      </View>

      <Text style={styles.label}>I am a…</Text>
      <RoleCard
        title="Landlord"
        subtitle="Manage your properties and tenancies"
        icon="business-outline"
        selected={role === 'LANDLORD'}
        onPress={() => setRole('LANDLORD')}
      />
      <RoleCard
        title="Tenant"
        subtitle="Find your rental and manage your stay"
        icon="home-outline"
        selected={role === 'TENANT'}
        onPress={() => setRole('TENANT')}
      />

      <Input
        label="Full Name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        icon="person-outline"
      />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        icon="mail-outline"
      />
      <Input
        label="Phone (optional)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+91 "
        icon="call-outline"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        placeholder="At least 8 characters"
        icon="lock-closed-outline"
        accessory={
          <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.colors.textSubtle}
            />
          </Pressable>
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Register" onPress={() => void submit()} loading={signingIn} icon="person-add-outline" />

      <Pressable style={styles.footer} onPress={() => navigation.goBack()}>
        <Text style={styles.footerText}>
          Already have an account? <Text style={styles.footerLink}>Login</Text>
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginTop: 8, marginBottom: theme.spacing.xl },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
  subtitle: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.body,
    marginTop: 4,
    textAlign: 'center',
  },
  label: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.text.caption,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.dangerBg,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontWeight: '500',
  },
  footer: { marginTop: theme.spacing.xl, alignItems: 'center' },
  footerText: { color: theme.colors.textSubtle, fontSize: theme.text.body },
  footerLink: { color: theme.colors.primary, fontWeight: '700' },
});