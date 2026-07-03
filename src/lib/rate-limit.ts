/**
 * Lightweight rate limiter for public API routes.
 *
 * Serverless-friendly: uses an in-memory sliding-window per instance. On Vercel
 * each instance keeps its own window; this blocks the common abuse cases
 * (a single client hammering an endpoint) without any external dependency
 * (no Redis needed to start). For hard multi-instance guarantees at large
 * scale, swap the store for Upstash Redis later — the interface stays the same.
 */

interface Hit { count: number; resetAt: number; }

const store = new Map<string, Hit>();

// Periodic cleanup so the map doesn't grow unbounded.
let lastSweep = Date.now();
function sweep() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  store.forEach((v, k) => { if (v.resetAt < now) store.delete(k); });
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * @param key      unique bucket (e.g. `${ip}:${route}`)
 * @param limit    max requests per window
 * @param windowMs window length in ms
 */
export function rateLimit(key: string, limit = 10, windowMs = 60_000): RateLimitResult {
  sweep();
  const now = Date.now();
  const hit = store.get(key);
  if (!hit || hit.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (hit.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((hit.resetAt - now) / 1000) };
  }
  hit.count += 1;
  return { allowed: true, remaining: limit - hit.count, retryAfterSec: 0 };
}

/** Best-effort client IP from request headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Convenience: enforce a limit for (ip, routeName). Returns null if allowed,
 * or a ready-to-return 429 Response if blocked.
 */
export function enforceRateLimit(req: Request, routeName: string, limit = 10, windowMs = 60_000): Response | null {
  const key = `${clientIp(req)}:${routeName}`;
  const r = rateLimit(key, limit, windowMs);
  if (r.allowed) return null;
  return new Response(
    JSON.stringify({ error: 'יותר מדי בקשות, נסו שוב בעוד רגע', retryAfter: r.retryAfterSec }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(r.retryAfterSec) } },
  );
}
