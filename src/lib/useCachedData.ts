'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Minimal SWR-style data cache — reduces repeat Firestore reads.
 *
 * Caches fetch results in-memory (module scope) keyed by a string. On mount,
 * returns cached data instantly (stale) then revalidates in the background.
 * Zero dependencies; safe to drop into any client page that currently does
 * `useEffect(() => { fetchX().then(setX) }, [])`.
 *
 * Usage:
 *   const { data, loading, refresh } = useCachedData('bookings:'+bizId, () => getBookings(bizId));
 */

interface CacheEntry<T> { data: T; ts: number; }
const cache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL = 30_000; // 30s — a page revisit within this window skips refetch

export function useCachedData<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  opts: { ttl?: number } = {},
): { data: T | null; loading: boolean; error: Error | null; refresh: () => Promise<void> } {
  const ttl = opts.ttl ?? DEFAULT_TTL;
  const cached = key ? (cache.get(key) as CacheEntry<T> | undefined) : undefined;
  const [data, setData] = useState<T | null>(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(async (force: boolean) => {
    if (!key) return;
    const existing = cache.get(key) as CacheEntry<T> | undefined;
    const fresh = existing && Date.now() - existing.ts < ttl;
    if (existing) { setData(existing.data); setLoading(false); }
    if (fresh && !force) return; // still fresh — skip network
    try {
      const result = await fetcherRef.current();
      cache.set(key, { data: result, ts: Date.now() });
      setData(result);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [key, ttl]);

  useEffect(() => { load(false); }, [load]);

  const refresh = useCallback(() => load(true), [load]);
  return { data, loading, error, refresh };
}

/** Invalidate a cache key (call after a mutation so the next read is fresh). */
export function invalidateCache(keyPrefix: string): void {
  cache.forEach((_, k) => { if (k.startsWith(keyPrefix)) cache.delete(k); });
}
