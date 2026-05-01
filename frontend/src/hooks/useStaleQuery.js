import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_PREFIX = 'ibbi_swr:';
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

const readCache = (key, maxAgeMs) => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const { v, t } = JSON.parse(raw);
    if (typeof t !== 'number') return null;
    if (Date.now() - t > maxAgeMs) return null;
    return v;
  } catch {
    return null;
  }
};

const writeCache = (key, value) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ v: value, t: Date.now() }));
  } catch {
    // storage cheio ou indisponível — ignora
  }
};

export default function useStaleQuery(key, fetcher, options = {}) {
  const { enabled = true, maxAgeMs = DEFAULT_MAX_AGE_MS } = options;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const cached = key && enabled ? readCache(key, maxAgeMs) : null;
  const [data, setData] = useState(cached);
  const [loading, setLoading] = useState(enabled && cached === null);
  const [error, setError] = useState(null);
  const reqIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!key || !enabled) return;
    const id = ++reqIdRef.current;
    try {
      const value = await fetcherRef.current();
      if (id !== reqIdRef.current) return;
      setData(value);
      setError(null);
      writeCache(key, value);
    } catch (err) {
      if (id !== reqIdRef.current) return;
      setError(err);
    } finally {
      if (id === reqIdRef.current) setLoading(false);
    }
  }, [key, enabled]);

  useEffect(() => {
    if (!key || !enabled) return;
    const fresh = readCache(key, maxAgeMs);
    if (fresh) {
      setData(fresh);
      setLoading(false);
    } else {
      setLoading(true);
    }
    refresh();
  }, [key, enabled, refresh, maxAgeMs]);

  return { data, loading, error, refresh, hasData: data !== null };
}
