interface Entry { value: unknown; expiresAt: number }
const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();

/** Bounded public-market cache; never use for account data or AI requests. */
export async function marketJson<T>(url: string, ttl = 30_000, force = false): Promise<T> {
  const hit = cache.get(url);
  if (!force && hit && hit.expiresAt > Date.now()) return hit.value as T;
  const inFlight = pending.get(url);
  if (inFlight) return inFlight as Promise<T>;
  const request = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Piyasa verileri şu anda alınamıyor. Lütfen tekrar deneyin.');
    const value = await response.json();
    if (value.success === false) throw new Error('Piyasa verileri şu anda alınamıyor. Lütfen tekrar deneyin.');
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(url, { value, expiresAt: Date.now() + ttl });
    return value as T;
  })();
  pending.set(url, request);
  try { return await request; } finally { pending.delete(url); }
}
