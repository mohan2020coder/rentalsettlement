import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api } from '../api/client';
import { authApi } from '../api/endpoints';
import { tokenStoreDelete, tokenStoreGet, tokenStoreSet } from '../store/tokenStore';
import { Role, User } from '../types';

const ACCESS_KEY = 'access';
const REFRESH_KEY = 'refresh';
const USER_KEY = 'user';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: Role) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const storedAccess = await tokenStoreGet(ACCESS_KEY);
      const storedRefresh = await tokenStoreGet(REFRESH_KEY);
      const storedUser = await tokenStoreGet(USER_KEY);
      if (storedAccess && storedRefresh && storedUser) {
        api.accessToken = storedAccess;
        api.refreshToken = storedRefresh;
        try {
          const parsed = JSON.parse(storedUser) as User;
          if (mounted) {
            setUser(parsed);
          }
        } catch {
          // Corrupt stored profile; fall through to signed-out state.
        }
      }
      if (mounted) {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persistSession = useCallback(
    async (auth: { access_token: string; refresh_token: string; user: User }) => {
      api.accessToken = auth.access_token;
      api.refreshToken = auth.refresh_token;
      await tokenStoreSet(ACCESS_KEY, auth.access_token);
      await tokenStoreSet(REFRESH_KEY, auth.refresh_token);
      await tokenStoreSet(USER_KEY, JSON.stringify(auth.user));
      setUser(auth.user);
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const auth = await authApi.login({ email, password });
      await persistSession(auth);
    },
    [persistSession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, role: Role) => {
      const auth = await authApi.register({ name, email, password, role });
      await persistSession(auth);
    },
    [persistSession],
  );

  const logout = useCallback(async () => {
    const refresh = api.refreshToken ?? (await tokenStoreGet(REFRESH_KEY));
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        // Best-effort revocation; sign out locally regardless.
      }
    }
    api.accessToken = null;
    api.refreshToken = null;
    await tokenStoreDelete(ACCESS_KEY);
    await tokenStoreDelete(REFRESH_KEY);
    await tokenStoreDelete(USER_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    api.onTokenRefreshed = (access, refresh) => {
      api.accessToken = access;
      api.refreshToken = refresh;
      void tokenStoreSet(ACCESS_KEY, access);
      void tokenStoreSet(REFRESH_KEY, refresh);
    };
    api.onSessionExpired = () => {
      void logout();
    };
  }, [logout]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout, setUser }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}