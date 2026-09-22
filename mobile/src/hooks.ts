import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';

interface LoadResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

interface LoadOptions {
  refreshOnFocus?: boolean;
}

export function useLoad<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  opts: LoadOptions = {},
): LoadResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const loadedOnce = useRef(false);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((d) => {
        if (alive) {
          setData(d);
          loadedOnce.current = true;
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Something went wrong');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, ...deps]);

  // Fetches silently every time the screen regains focus so lists stay fresh
  // after the user adds/edits records elsewhere (no manual pull-to-refresh).
  const isFocused = opts.refreshOnFocus ? useIsFocused() : true;
  useEffect(() => {
    if (!opts.refreshOnFocus) return;
    if (!isFocused || !loadedOnce.current) return;
    let alive = true;
    loaderRef
      .current()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Something went wrong');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  return { data, loading, error, reload };
}

export function useOnlyMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}