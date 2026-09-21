import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

interface LoadResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useLoad<T>(loader: () => Promise<T>, deps: DependencyList): LoadResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((d) => {
        if (alive) setData(d);
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