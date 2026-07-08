/**
 * Revenue Engine — the proactive money-making layer.
 *
 * v2 principles (after real-world feedback):
 * 1. A visit is any past booking that wasn't cancelled — owners rarely mark
 *    "completed", so the engine must not depend on it.
 * 2. Every gap must be actionable: matching is tiered (due-by-rhythm →
 *    active without an upcoming booking → anyone), never empty.
 * 3. Whole empty days are split into human-sized slots, and revenue
 *    potential uses a realistic fill-rate — honest numbers build trust.
 */

import type { Booking, Customer } from './bizdata';

const DAY = 24 * 60 * 60 * 1000;

function toMin(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); }
function toStr(m: number): string { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
const todayStr = () => new Date().toISOString().split('T')[0];

/** A booking that counts as a real visit — past and not cancelled/no-show. */
export function isVisit(b: Booking): boolean {
  if (b.status === 'cancelled' || b.status === 'no_show') return false;
  return b.status === 'completed' || (b.date || '') < todayStr();
}

/** Customer visit history (newest first), independent of manual statuses. */
function visitHistory(bookings: Booking[], phone: string): Booking[] {
  return bookings
    .filter((b) => b.customerPhone === phone && isVisit(b))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

// ────────────────────────────────────────────────────────────
// ENGINE 1 — Smart Gaps
// ────────────────────────────────────────────────────────────
export interface Gap { date: string; start: string; end: string; minutes: number; }

export function findGaps(
  bookings: Booking[],
  hours: Record<number, { open: boolean; start: string; end: string }> | null,
  opts: { days?: number; minGapMin?: number } = {},
): Gap[] {
  const days = opts.days ?? 3;
  const minGap = opts.minGapMin ?? 30;
  const raw: Gap[] = [];
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
    if (d === 0) cursor = Math.max(cursor, today.getHours() * 60 + today.getMinutes());

    for (const b of dayBookings) {
      const bs = toMin(b.time);
      if (bs - cursor >= minGap) raw.push({ date: dateStr, start: toStr(cursor), end: toStr(bs), minutes: bs - cursor });
      cursor = Math.max(cursor, bs + (b.duration || 30));
    }
    if (close - cursor >= minGap) raw.push({ date: dateStr, start: toStr(cursor), end: toStr(close), minutes: close - cursor });
  }

  // Split monster gaps (an empty day) into human-sized offers (max 3 per gap, ~2-3h each)
  const gaps: Gap[] = [];
  for (const g of raw) {
    if (g.minutes <= 240) { gaps.push(g); continue; }
    const parts = Math.min(3, Math.ceil(g.minutes / 180));
    const size = Math.floor(g.minutes / parts);
    let s = toMin(g.start);
    for (let i = 0; i < parts; i++) {
      const e = i === parts - 1 ? toMin(g.end) : s + size;
      gaps.push({ date: g.date, start: toStr(s), end: toStr(e), minutes: e - s });
      s = e;
    }
  }
  return gaps;
}

// ────────────────────────────────────────────────────────────
// Tiered matching — every gap gets someone to message. Always.
// ────────────────────────────────────────────────────────────
export interface GapMatch { customer: Customer; tier: 1 | 2 | 3; reason: string }

export function matchForGap(
  customers: Customer[], bookings: Booking[],
  opts: { limit?: number; rotate?: number } = {},
): GapMatch[] {
  const limit = opts.limit ?? 3;
  const now = Date.now();
  const upcoming = new Set(
    bookings.filter((b) => b.status !== 'cancelled' && (b.date || '') >= todayStr()).map((b) => b.customerPhone),
  );

  const tier1: GapMatch[] = []; const tier2: GapMatch[] = []; const tier3: GapMatch[] = [];
  for (const cust of customers) {
    if (!cust.phone) continue;
    if (upcoming.has(cust.phone)) continue; // already booked — don't nag
    const hist = visitHistory(bookings, cust.phone);
    if (hist.length >= 2) {
      const gapsD: number[] = [];
      for (let i = 0; i < hist.length - 1; i++) gapsD.push((new Date(hist[i].date).getTime() - new Date(hist[i + 1].date).getTime()) / DAY);
      const avgGap = gapsD.reduce((s, g) => s + g, 0) / gapsD.length;
      const daysSince = (now - new Date(hist[0].date).getTime()) / DAY;
      if (avgGap > 0 && daysSince / avgGap >= 0.7) {
        tier1.push({ customer: cust, tier: 1, reason: `בשל לתור — בד"כ כל ${Math.round(avgGap)} ימים` });
        continue;
      }
    }
    if (hist.length >= 1) {
      const daysSince = Math.floor((now - new Date(hist[0].date).getTime()) / DAY);
      tier2.push({ customer: cust, tier: 2, reason: `ביקר לפני ${daysSince} ימים` });
    } else {
      tier3.push({ customer: cust, tier: 3, reason: 'לקוח רשום' });
    }
  }
  tier2.sort((a, b) => (b.customer.visits || 0) - (a.customer.visits || 0));

  const pool = [...tier1, ...tier2, ...tier3];
  if (pool.length === 0) return [];
  // Rotate so different gaps suggest different people
  const off = ((opts.rotate ?? 0) * limit) % pool.length;
  const rotated = [...pool.slice(off), ...pool.slice(0, off)];
  return rotated.slice(0, limit);
}

// ────────────────────────────────────────────────────────────
// ENGINE 2 — Win-Back
// ────────────────────────────────────────────────────────────
export interface ChurningCustomer { customer: Customer; daysSince: number; avgGap: number; visits: number; lastService: string; }

export function findChurning(customers: Customer[], bookings: Booking[]): ChurningCustomer[] {
  const now = Date.now();
  const result: ChurningCustomer[] = [];

  for (const cust of customers) {
    const hist = visitHistory(bookings, cust.phone);
    if (hist.length < 2) continue;

    const gaps: number[] = [];
    for (let i = 0; i < hist.length - 1; i++) {
      gaps.push((new Date(hist[i].date).getTime() - new Date(hist[i + 1].date).getTime()) / DAY);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const daysSince = Math.floor((now - new Date(hist[0].date).getTime()) / DAY);

    if (avgGap > 0 && daysSince > Math.max(21, avgGap * 1.5)) {
      result.push({ customer: cust, daysSince, avgGap: Math.round(avgGap), visits: hist.length, lastService: hist[0].service || '' });
    }
  }
  return result.sort((a, b) => b.visits - a.visits);
}

// ────────────────────────────────────────────────────────────
// ENGINE 3 — Revenue Radar (honest numbers)
// ────────────────────────────────────────────────────────────
export interface RadarStats {
  lostToNoShows: number;
  noShowCount: number;
  emptySlotHours: number;
  potentialFromGaps: number;
  fillRatePct: number;
  churningCount: number;
  churningValue: number;
}

const FILL_RATE = 0.4; // realistic share of empty time you can actually fill

export function computeRadar(
  bookings: Booking[],
  customers: Customer[],
  hours: Record<number, { open: boolean; start: string; end: string }> | null,
  avgTicket: number,
): RadarStats {
  const now = Date.now();
  const monthAgo = now - 30 * DAY;

  const recentNoShows = bookings.filter((b) => b.status === 'no_show' && new Date(b.date).getTime() > monthAgo);
  const lostToNoShows = recentNoShows.reduce((s, b) => s + (Number((b as { price?: number }).price) || avgTicket), 0);

  const gaps = findGaps(bookings, hours, { days: 3, minGapMin: 30 });
  const emptyMinutes = gaps.reduce((s, g) => s + g.minutes, 0);
  const emptySlotHours = Math.round(emptyMinutes / 60 * 10) / 10;
  const potentialFromGaps = Math.round((emptyMinutes * FILL_RATE / 45) * avgTicket);

  const churning = findChurning(customers, bookings);
  const churningValue = churning.reduce((s, ch) => s + (ch.customer.totalSpent / Math.max(ch.visits, 1) || avgTicket), 0);

  return {
    lostToNoShows: Math.round(lostToNoShows),
    noShowCount: recentNoShows.length,
    emptySlotHours,
    potentialFromGaps,
    fillRatePct: Math.round(FILL_RATE * 100),
    churningCount: churning.length,
    churningValue: Math.round(churningValue),
  };
}

/** Average ticket — from any priced visit, not only "completed". */
export function avgTicket(bookings: Booking[]): number {
  const done = bookings.filter((b) => isVisit(b) && Number((b as { price?: number }).price) > 0);
  if (done.length === 0) return 100;
  return Math.round(done.reduce((s, b) => s + Number((b as { price?: number }).price), 0) / done.length);
}
