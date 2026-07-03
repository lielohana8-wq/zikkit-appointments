/**
 * Revenue Engine — the proactive money-making layer.
 *
 * Unlike competitors that passively record bookings, these engines actively
 * surface revenue opportunities: empty slots to fill, customers slipping away,
 * and money lost to no-shows. Pure analytics over data already in memory —
 * zero dependencies, zero external calls. Actions are executed via WhatsApp
 * (see messaging.ts), so nothing here needs a paid provider.
 */

import type { Booking, Customer } from './bizdata';

const MIN = 60_000;
const DAY = 24 * 60 * 60 * 1000;

function toMin(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); }
function toStr(m: number): string { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

// ────────────────────────────────────────────────────────────
// ENGINE 1 — Smart Gaps: find open slots worth filling
// ────────────────────────────────────────────────────────────
export interface Gap { date: string; start: string; end: string; minutes: number; }

export function findGaps(
  bookings: Booking[],
  hours: Record<number, { open: boolean; start: string; end: string }> | null,
  opts: { days?: number; minGapMin?: number } = {},
): Gap[] {
  const days = opts.days ?? 3;
  const minGap = opts.minGapMin ?? 30;
  const gaps: Gap[] = [];
  const today = new Date();

  for (let d = 0; d < days; d++) {
    const day = new Date(today); day.setDate(day.getDate() + d);
    const dateStr = day.toISOString().split('T')[0];
    const dow = day.getDay();
    const dh = (hours && hours[dow]) || { open: dow !== 6, start: '09:00', end: '19:00' };
    if (!dh.open) continue;

    const dayBookings = bookings
      .filter((b) => b.date === dateStr && b.status !== 'cancelled')
      .sort((a, b) => toMin(a.time) - toMin(b.time));

    let cursor = toMin(dh.start);
    const close = toMin(dh.end);
    // Skip past times if today
    if (d === 0) cursor = Math.max(cursor, today.getHours() * 60 + today.getMinutes());

    for (const b of dayBookings) {
      const bs = toMin(b.time);
      if (bs - cursor >= minGap) gaps.push({ date: dateStr, start: toStr(cursor), end: toStr(bs), minutes: bs - cursor });
      cursor = Math.max(cursor, bs + (b.duration || 30));
    }
    if (close - cursor >= minGap) gaps.push({ date: dateStr, start: toStr(cursor), end: toStr(close), minutes: close - cursor });
  }
  return gaps;
}

/** Which customers best fit an open slot — by recency + rhythm (due for a visit). */
export function matchForGap(customers: Customer[], bookings: Booking[], limit = 3): Customer[] {
  const now = Date.now();
  const scored = customers.map((cust) => {
    const hist = bookings
      .filter((b) => b.customerPhone === cust.phone && b.status === 'completed')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (hist.length < 2) return { cust, score: hist.length === 1 ? 1 : 0 };
    // Average gap between visits (rhythm)
    const gaps: number[] = [];
    for (let i = 0; i < hist.length - 1; i++) {
      gaps.push((new Date(hist[i].date).getTime() - new Date(hist[i + 1].date).getTime()) / DAY);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const daysSince = (now - new Date(hist[0].date).getTime()) / DAY;
    // Higher score = more "due" (close to or past their usual rhythm)
    const score = avgGap > 0 ? daysSince / avgGap : 0;
    return { cust, score };
  });
  return scored.filter((s) => s.score >= 0.7).sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.cust);
}

// ────────────────────────────────────────────────────────────
// ENGINE 2 — Win-Back: customers slipping away
// ────────────────────────────────────────────────────────────
export interface ChurningCustomer { customer: Customer; daysSince: number; avgGap: number; visits: number; lastService: string; }

export function findChurning(customers: Customer[], bookings: Booking[]): ChurningCustomer[] {
  const now = Date.now();
  const result: ChurningCustomer[] = [];

  for (const cust of customers) {
    const hist = bookings
      .filter((b) => b.customerPhone === cust.phone && b.status === 'completed')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (hist.length < 2) continue;

    const gaps: number[] = [];
    for (let i = 0; i < hist.length - 1; i++) {
      gaps.push((new Date(hist[i].date).getTime() - new Date(hist[i + 1].date).getTime()) / DAY);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const daysSince = Math.floor((now - new Date(hist[0].date).getTime()) / DAY);

    // Overdue = past 1.5× their usual rhythm (and at least 21 days)
    if (avgGap > 0 && daysSince > Math.max(21, avgGap * 1.5)) {
      result.push({ customer: cust, daysSince, avgGap: Math.round(avgGap), visits: hist.length, lastService: hist[0].service || '' });
    }
  }
  return result.sort((a, b) => b.visits - a.visits); // most valuable first
}

// ────────────────────────────────────────────────────────────
// ENGINE 3 — Revenue Radar: money lost & money on the table
// ────────────────────────────────────────────────────────────
export interface RadarStats {
  lostToNoShows: number;
  noShowCount: number;
  emptySlotHours: number;
  potentialFromGaps: number;
  churningCount: number;
  churningValue: number;
}

export function computeRadar(
  bookings: Booking[],
  customers: Customer[],
  hours: Record<number, { open: boolean; start: string; end: string }> | null,
  avgTicket: number,
): RadarStats {
  const now = Date.now();
  const monthAgo = now - 30 * DAY;

  // Lost to no-shows (last 30 days)
  const recentNoShows = bookings.filter((b) => b.status === 'no_show' && new Date(b.date).getTime() > monthAgo);
  const lostToNoShows = recentNoShows.reduce((s, b) => s + (Number((b as { price?: number }).price) || avgTicket), 0);

  // Empty slot hours (next 3 days) → potential
  const gaps = findGaps(bookings, hours, { days: 3, minGapMin: 30 });
  const emptyMinutes = gaps.reduce((s, g) => s + g.minutes, 0);
  const emptySlotHours = Math.round(emptyMinutes / 60 * 10) / 10;
  const potentialFromGaps = Math.round((emptyMinutes / 45) * avgTicket); // assume ~45min avg service

  // Churning value
  const churning = findChurning(customers, bookings);
  const churningValue = churning.reduce((s, ch) => s + (ch.customer.totalSpent / Math.max(ch.visits, 1)), 0);

  return {
    lostToNoShows: Math.round(lostToNoShows),
    noShowCount: recentNoShows.length,
    emptySlotHours,
    potentialFromGaps,
    churningCount: churning.length,
    churningValue: Math.round(churningValue),
  };
}

/** Average ticket from completed bookings (fallback 100). */
export function avgTicket(bookings: Booking[]): number {
  const done = bookings.filter((b) => b.status === 'completed' && Number((b as { price?: number }).price) > 0);
  if (done.length === 0) return 100;
  return Math.round(done.reduce((s, b) => s + Number((b as { price?: number }).price), 0) / done.length);
}
