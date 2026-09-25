import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { get } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface UnreadValue {
  count: number;
  refresh: () => void;
}

const UnreadContext = createContext<UnreadValue>({ count: 0, refresh: () => {} });

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const r = await get<{ unread_count: number }>('/notifications/unread-count');
      setCount(r.unread_count ?? 0);
    } catch {
      // ignore: badge just stays at its last known value
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    void refresh();
  }, [user, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return <UnreadContext.Provider value={{ count, refresh }}>{children}</UnreadContext.Provider>;
}

export function useUnread() {
  return useContext(UnreadContext);
}