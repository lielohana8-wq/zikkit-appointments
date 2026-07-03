'use client';

/**
 * Central observability layer — analytics events + error logging.
 *
 * Zero-dependency by default: events go to the console in dev and are buffered
 * in memory. When you later add Posthog/Sentry keys, wire them in the two
 * marked spots — every call site stays unchanged. This keeps product analytics
 * consistent and vendor-agnostic.
 *
 * Env (optional, client-safe):
 *   NEXT_PUBLIC_POSTHOG_KEY   — enables Posthog capture
 *   NEXT_PUBLIC_SENTRY_DSN    — enables Sentry error reporting
 */

type EventProps = Record<string, string | number | boolean | null | undefined>;

const isDev = process.env.NODE_ENV !== 'production';
const buffer: Array<{ event: string; props?: EventProps; ts: number }> = [];

/** Track a product event (signup, booking_created, subscription_started, …). */
export function track(event: string, props?: EventProps): void {
  buffer.push({ event, props, ts: Date.now() });
  if (buffer.length > 200) buffer.shift();

  if (isDev) console.log(`[track] ${event}`, props || '');

  // ── Posthog hook (wire when NEXT_PUBLIC_POSTHOG_KEY is set) ──
  const ph = (window as unknown as { posthog?: { capture: (e: string, p?: EventProps) => void } }).posthog;
  if (ph) { try { ph.capture(event, props); } catch { /* noop */ } }
}

/** Report a handled error with context. */
export function logError(error: unknown, context?: EventProps): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (isDev) console.error('[logError]', err.message, context || '');

  // ── Sentry hook (wire when NEXT_PUBLIC_SENTRY_DSN is set) ──
  const sentry = (window as unknown as { Sentry?: { captureException: (e: Error, o?: unknown) => void } }).Sentry;
  if (sentry) { try { sentry.captureException(err, { extra: context }); } catch { /* noop */ } }
}

/** Identify the current user for analytics (call after login). */
export function identify(userId: string, traits?: EventProps): void {
  if (isDev) console.log('[identify]', userId, traits || '');
  const ph = (window as unknown as { posthog?: { identify: (id: string, t?: EventProps) => void } }).posthog;
  if (ph) { try { ph.identify(userId, traits); } catch { /* noop */ } }
}

/** Common product events — use these constants to avoid typos across the app. */
export const Events = {
  SIGNUP_REQUESTED: 'signup_requested',
  LOGIN: 'login',
  BOOKING_CREATED: 'booking_created',
  BOOKING_CANCELLED: 'booking_cancelled',
  BOOKING_PAGE_ENABLED: 'booking_page_enabled',
  PUBLIC_BOOKING_MADE: 'public_booking_made',
  DEPOSIT_STARTED: 'deposit_started',
  SUBSCRIPTION_STARTED: 'subscription_started',
  DANA_ENABLED: 'dana_enabled',
  WAITLIST_JOINED: 'waitlist_joined',
} as const;
