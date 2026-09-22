import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Screen } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { ApiClientError } from '../../api/client';
import { RootStackParamList } from '../../navigation/types';
import { theme } from '../../theme';

export default function LoginScreen() {
  const { signIn, signingIn } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (id: string, p: string) => {
    setError(null);
    try {
      await signIn(id, p);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not sign in');
    }
  };

  return (
    <Screen keyboard scroll contentStyle={styles.wrap}>
      <View style={styles.brand}>
        <View style={styles.logoMark}>
          <Ionicons name="shield-checkmark" size={30} color={theme.colors.white} />
        </View>
        <Text style={styles.brandName}>RentSafe</Text>
        <Text style={styles.brandTagline}>Document · Protect · Settle</Text>
      </View>

      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Sign in to your account</Text>

      <Input
        label="Email or phone"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@example.com"
        icon="mail-outline"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        placeholder="Your password"
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

      <Pressable style={styles.forgotRow} onPress={() => {}}>
        <Text style={styles.forgotText}>Forgot password?</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Login"
        onPress={() => submit(identifier, password)}
        loading={signingIn}
        disabled={!identifier || !password}
        icon="log-in-outline"
      />

      <Pressable style={styles.footer} onPress={() => navigation.navigate('Register')}>
        <Text style={styles.footerText}>
          Don't have an account? <Text style={styles.footerLink}>Register</Text>
        </Text>
      </Pressable>

      <View style={styles.demo}>
        <Text style={styles.demoLabel}>Demo accounts · tap to fill</Text>
        <View style={styles.demoButtons}>
          <Pressable
            style={styles.demoChip}
            onPress={() => {
              setIdentifier('rajesh@example.in');
              setPassword('Demo@1234');
            }}
          >
            <Ionicons name="business-outline" size={15} color={theme.colors.primary} />
            <Text style={styles.demoChipText}>Landlord</Text>
          </Pressable>
          <Pressable
            style={styles.demoChip}
            onPress={() => {
              setIdentifier('arun@example.in');
              setPassword('Demo@1234');
            }}
          >
            <Ionicons name="person-outline" size={15} color={theme.colors.primary} />
            <Text style={styles.demoChipText}>Tenant</Text>
          </Pressable>
        </View>
      </View>

      <View pointerEvents="none" style={styles.art}>
        <View style={styles.skyline}>
          <View style={[styles.building, styles.b1]} />
          <View style={[styles.building, styles.b2]} />
          <View style={[styles.building, styles.b3]} />
          <View style={[styles.building, styles.b4]} />
          <View style={[styles.building, styles.b5]} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'space-between', flexGrow: 1 },
  brand: { alignItems: 'center', marginTop: 16, marginBottom: 28 },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.primaryDark,
    marginTop: theme.spacing.md,
  },
  brandTagline: {
    fontSize: theme.text.caption,
    color: theme.colors.textSubtle,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text },
  subtitle: {
    color: theme.colors.textSubtle,
    fontSize: theme.text.body,
    marginTop: 4,
    marginBottom: theme.spacing.xl,
  },
  forgotRow: { alignItems: 'flex-end', marginBottom: theme.spacing.lg, marginTop: -6 },
  forgotText: { color: theme.colors.primary, fontSize: theme.text.caption, fontWeight: '700' },
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
  demo: { marginTop: theme.spacing.xl, alignItems: 'center' },
  demoLabel: { fontSize: theme.text.small, color: theme.colors.textSubtle, fontWeight: '600' },
  demoButtons: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm },
  demoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primaryLight,
  },
  demoChipText: { color: theme.colors.primaryDark, fontSize: theme.text.caption, fontWeight: '700' },
  art: { alignItems: 'center', marginTop: theme.spacing.xl, opacity: 0.5 },
  skyline: { flexDirection: 'row', alignItems: 'flex-end', height: 54 },
  building: { backgroundColor: theme.colors.primary, marginHorizontal: 3, borderRadius: 4, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  b1: { width: 22, height: 34 },
  b2: { width: 30, height: 48 },
  b3: { width: 26, height: 40 },
  b4: { width: 34, height: 54 },
  b5: { width: 22, height: 30 },
});