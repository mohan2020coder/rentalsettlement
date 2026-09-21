import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, extractError, rawAuth, registerTokenProviders } from '../api/client';
import { AuthResponse, RegisterPayload, User } from '../api/types';

const ACCESS_KEY = 'rs.access_token';
const REFRESH_KEY = 'rs.refresh_token';
const USER_KEY = 'rs.user';

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);

  const applyTokens = useCallback((access: string, refresh: string) => {
    accessRef.current = access;
    refreshRef.current = refresh;
    setAccessToken(access);
    SecureStore.setItemAsync(ACCESS_KEY, access).catch(() => undefined);
    SecureStore.setItemAsync(REFRESH_KEY, refresh).catch(() => undefined);
  }, []);

  const clearSession = useCallback(async () => {
    accessRef.current = null;
    refreshRef.current = null;
    userRef.current = null;
    setUser(null);
    setAccessToken(null);
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => undefined),
      SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => undefined),
      AsyncStorage.removeItem(USER_KEY).catch(() => undefined),
    ]);
  }, []);

  // Register token readers/writers with the axios client.
  useEffect(() => {
    registerTokenProviders({
      getAccessToken: () => accessRef.current,
      getRefreshToken: () => refreshRef.current,
      setTokens: (access, refresh) => applyTokens(access, refresh),
      onSessionExpired: () => {
        void clearSession();
      },
    });
  }, [applyTokens, clearSession]);

  const applyUser = useCallback((u: User) => {
    userRef.current = u;
    setUser(u);
    AsyncStorage.setItem(USER_KEY, JSON.stringify(u)).catch(() => undefined);
  }, []);

  // Bootstrap: restore persisted session and validate.
  useEffect(() => {
    (async () => {
      try {
        const [access, refresh, storedUser] = await Promise.all([
          SecureStore.getItemAsync(ACCESS_KEY),
          SecureStore.getItemAsync(REFRESH_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (access && refresh) {
          applyTokens(access, refresh);
          if (storedUser) {
            applyUser(JSON.parse(storedUser) as User);
          }
          try {
            const resp = await api.get<{ success: boolean; data: User }>('/users/me');
            if (resp.data?.success) {
              applyUser(resp.data.data);
            }
          } catch {
            await clearSession();
          }
        }
      } catch {
        await clearSession();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setSigningIn(true);
      setError(null);
      try {
        const resp = await rawAuth<AuthResponse>('/auth/login', { email, password });
        applyTokens(resp.access_token, resp.refresh_token);
        applyUser(resp.user);
      } catch (err) {
        setError(extractError(err).message);
        throw err;
      } finally {
        setSigningIn(false);
      }
    },
    [applyTokens, applyUser],
  );

  const signUp = useCallback(
    async (payload: RegisterPayload) => {
      setSigningIn(true);
      setError(null);
      try {
        const resp = await rawAuth<AuthResponse>('/auth/register', payload);
        applyTokens(resp.access_token, resp.refresh_token);
        applyUser(resp.user);
      } catch (err) {
        setError(extractError(err).message);
        throw err;
      } finally {
        setSigningIn(false);
      }
    },
    [applyTokens, applyUser],
  );

  const signOut = useCallback(async () => {
    const refresh = refreshRef.current;
    if (refresh) {
      try {
        const access = accessRef.current;
        await api.post(
          '/auth/logout',
          { refresh_token: refresh },
          access ? { headers: { Authorization: `Bearer ${access}` } } : undefined,
        );
      } catch {
        // ignore logout errors
      }
    }
    await clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const resp = await api.get<{ success: boolean; data: User }>('/users/me');
    if (resp.data?.success) {
      applyUser(resp.data.data);
    }
  }, [applyUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      loading,
      signingIn,
      error,
      signIn,
      signUp,
      signOut,
      refreshUser,
      updateUser: applyUser,
    }),
    [user, accessToken, loading, signingIn, error, signIn, signUp, signOut, refreshUser, applyUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}