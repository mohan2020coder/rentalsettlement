import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../api/client';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (data: T | null) => void;
}

/**
 * Runs an async loader on mount and exposes loading/error/data plus reload.
 * A request id guard prevents stale responses from overwriting newer ones.
 */
export function useApi<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const run = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    loader()
      .then((result) => {
        if (requestId.current === id) {
          setData(result);
        }
      })
      .catch((err: unknown) => {
        if (requestId.current === id) {
          setError(err instanceof ApiError ? err.message : 'Something went wrong.');
          setData(null);
        }
      })
      .finally(() => {
        if (requestId.current === id) {
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, reload: run, setData };
}