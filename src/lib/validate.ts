/**
 * Zero-dependency input validation & sanitization for API routes.
 *
 * Keeps payloads clean and bounded before they touch Firestore — prevents
 * corrupted data, oversized writes, and basic injection of control chars.
 */

export interface ValidationError { field: string; message: string; }

/** Trim, strip control chars, and cap length. */
export function cleanStr(v: unknown, maxLen = 500): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

/** Normalize & validate an Israeli phone. Returns '' if clearly invalid. */
export function cleanPhone(v: unknown): string {
  if (typeof v !== 'string') return '';
  const digits = v.replace(/[^\d+]/g, '');
  // 9–15 digits is a sane international range
  const bare = digits.replace(/\D/g, '');
  if (bare.length < 9 || bare.length > 15) return '';
  return digits.slice(0, 16);
}

export function cleanEmail(v: unknown): string {
  const s = cleanStr(v, 120).toLowerCase();
  if (!s) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
}

/** ISO date YYYY-MM-DD only. */
export function cleanDate(v: unknown): string {
  const s = cleanStr(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/** HH:MM 24h only. */
export function cleanTime(v: unknown): string {
  const s = cleanStr(v, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : '';
}

/** Bounded positive number. */
export function cleanNum(v: unknown, min = 0, max = 1_000_000): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Validate a booking payload from the public booking form. */
export function validateBooking(raw: Record<string, unknown>): { ok: boolean; errors: ValidationError[]; clean: Record<string, unknown> } {
  const errors: ValidationError[] = [];
  const clean = {
    customerName: cleanStr(raw.customerName, 80),
    customerPhone: cleanPhone(raw.customerPhone),
    service: cleanStr(raw.service, 120),
    duration: cleanNum(raw.duration, 5, 600),
    date: cleanDate(raw.date),
    time: cleanTime(raw.time),
    staff: raw.staff ? cleanStr(raw.staff, 80) : null,
    price: cleanNum(raw.price, 0, 100_000),
    notes: cleanStr(raw.notes, 500),
  };
  if (!clean.customerName) errors.push({ field: 'customerName', message: 'שם חסר' });
  if (!clean.date) errors.push({ field: 'date', message: 'תאריך לא תקין' });
  if (!clean.time) errors.push({ field: 'time', message: 'שעה לא תקינה' });
  return { ok: errors.length === 0, errors, clean };
}
