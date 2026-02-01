type CacheEntry<T> = {
  value: T;
  storedAt: number; // ms epoch
  ttlMs: number;
};

const store = new Map<string, CacheEntry<any>>();

export function getCache<T>(
  key: string
): { hit: true; value: T; ageSeconds: number } | { hit: false } {
  const entry = store.get(key);
  if (!entry) return { hit: false };

  const ageMs = Date.now() - entry.storedAt;
  if (ageMs > entry.ttlMs) {
    store.delete(key);
    return { hit: false };
  }

  return {
    hit: true,
    value: entry.value as T,
    ageSeconds: Math.floor(ageMs / 1000),
  };
}

export function setCache<T>(key: string, value: T, ttlMs: number) {
  store.set(key, { value, storedAt: Date.now(), ttlMs });
}
