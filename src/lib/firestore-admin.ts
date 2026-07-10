/**
 * Server-side Firestore helper for ZikkitAppointments API routes.
 * Uses the service account (FIREBASE_SERVICE_ACCOUNT_KEY) to read/write
 * the `appointment_businesses` collection via the Firestore REST API.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'zikkit-e87ff';
export const BIZ_COLLECTION = 'appointment_businesses';

type FV = {
  stringValue?: string; integerValue?: string; doubleValue?: number;
  booleanValue?: boolean; nullValue?: null;
  arrayValue?: { values?: FV[] }; mapValue?: { fields?: Record<string, FV> };
};

let cachedToken: { token: string; exp: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60000) return cachedToken.token;
  const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!saKey) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY missing');
  let sa;
  try {
    sa = JSON.parse(saKey);
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON: ' + (e as Error).message);
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error('Service account JSON missing client_email or private_key');
  }
  // The private_key may contain literal "\n" sequences (common when pasted
  // into env vars). Convert them to real newlines so the signer works.
  const privateKey = (sa.private_key as string).replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })}`;
  const crypto = await import('crypto');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const jwt = `${unsigned}.${signer.sign(privateKey, 'base64url')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Failed to get access token: ' + (data.error_description || data.error || JSON.stringify(data)));
  }
  cachedToken = { token: data.access_token, exp: Date.now() + 3500000 };
  return data.access_token;
}

export function encode(value: unknown): FV {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: value.toString() } : { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (typeof value === 'object') {
    const fields: Record<string, FV> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) fields[k] = encode(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export function decode(fields: Record<string, FV>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v);
  return out;
}
function decodeValue(v: FV): unknown {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(decodeValue);
  if (v.mapValue) return decode(v.mapValue.fields || {});
  return null;
}

export async function getBiz(bizId: string): Promise<Record<string, unknown> | null> {
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${BIZ_COLLECTION}/${bizId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return decode(data.fields || {});
}

/**
 * Atomic read-modify-write with optimistic concurrency (compare-and-swap).
 * Re-reads the doc, applies the mutator, and writes ONLY if the document
 * hasn't changed since the read (currentDocument.updateTime precondition).
 * On a concurrent write it retries with fresh data — no lost updates, ever.
 */
export async function mutateBizField(
  bizId: string,
  fieldPath: string[],
  mutate: (current: unknown, doc: Record<string, unknown>) => unknown,
): Promise<void> {
  const token = await getAccessToken();
  const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${BIZ_COLLECTION}/${bizId}`;
  const buildNested = (path: string[], val: unknown): Record<string, FV> =>
    path.length === 1 ? { [path[0]]: encode(val) } : { [path[0]]: { mapValue: { fields: buildNested(path.slice(1), val) } } };
  let lastErr = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const getRes = await fetch(docUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!getRes.ok) throw new Error('Firestore read failed: ' + getRes.status);
    const raw = await getRes.json() as { updateTime: string; fields?: Record<string, FV> };
    const docData = decode(raw.fields || {});
    const current = fieldPath.reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], docData);
    const next = mutate(current, docData);
    const res = await fetch(`${docUrl}?updateMask.fieldPaths=${fieldPath.join('.')}&currentDocument.updateTime=${encodeURIComponent(raw.updateTime)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: buildNested(fieldPath, next) }),
    });
    if (res.ok) return;
    lastErr = await res.text();
    if (!lastErr.includes('FAILED_PRECONDITION') && res.status !== 409) throw new Error('Firestore write failed: ' + lastErr);
    // someone wrote in between — loop retries with fresh data
  }
  throw new Error('Firestore CAS exhausted: ' + lastErr.slice(0, 120));
}

export async function setBizField(bizId: string, fieldPath: string[], value: unknown): Promise<void> {
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${BIZ_COLLECTION}/${bizId}?updateMask.fieldPaths=${fieldPath.join('.')}`;
  const buildNested = (path: string[], val: unknown): Record<string, FV> =>
    path.length === 1 ? { [path[0]]: encode(val) } : { [path[0]]: { mapValue: { fields: buildNested(path.slice(1), val) } } };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: buildNested(fieldPath, value) }),
  });
  if (!res.ok) throw new Error('Firestore write failed: ' + (await res.text()));
}

export async function listAllBiz(): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const token = await getAccessToken();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${BIZ_COLLECTION}?pageSize=300`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.documents || []).map((d: { name: string; fields: Record<string, FV> }) => ({
    id: d.name.split('/').pop()!,
    data: decode(d.fields || {}),
  }));
}

// Web push to a customer who saved the app — free, instant, no carrier filtering.
// Gracefully does nothing when VAPID env vars are missing.
export async function sendPush(bizId: string, phoneRaw: string, title: string, message: string): Promise<void> {
  const logPush = async (ok: boolean, note: string) => {
    try {
      const fresh = await getBiz(bizId);
      const items = (((fresh?.smsLog as Record<string, unknown>)?.items as unknown[]) || []);
      await setBizField(bizId, ['smsLog', 'items'], [{ at: new Date().toISOString(), to: '🔔 push ' + String(phoneRaw || ''), ok, err: ok ? '' : note, preview: message.slice(0, 60), delivery: ok ? '✓ פוש נשלח' : '' }, ...items].slice(0, 30));
    } catch { /* never break */ }
  };
  try {
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) { await logPush(false, 'מפתחות VAPID חסרים ב-Vercel (או שלא בוצע Redeploy אחרי הוספתם)'); return; }
    const key = String(phoneRaw || '').replace(/\D/g, '').slice(-9);
    if (key.length < 9) return;
    const biz = await getBiz(bizId);
    const subs = (biz?.pushSubs as Record<string, unknown>) || {};
    const sub = subs['p' + key] || subs[key];
    if (!sub) { await logPush(false, 'המכשיר של המספר הזה לא נרשם להתראות — יש לפתוח את המערכת במכשיר ולאשר התראות'); return; }
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails('mailto:support@zikkit.app', pub, priv);
    await webpush.sendNotification(sub as never, JSON.stringify({ title, body: message }));
    await logPush(true, '');
  } catch (e) {
    await logPush(false, 'שליחת פוש נכשלה: ' + String((e as Error)?.message || e).slice(0, 80));
  }
}

export async function sendSms(to: string, body: string, logBizId?: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_IL || process.env.TWILIO_PHONE_NUMBER;
  let toNum = to.replace(/[^\d]/g, '');
  if (toNum.startsWith('0')) toNum = '972' + toNum.slice(1);
  if (!toNum.startsWith('+')) toNum = '+' + toNum;

  let ok = false; let err = ''; let msgSid = '';
  if (!sid || !token || !from) {
    err = 'TWILIO env חסר';
  } else {
    try {
      const cbBase = process.env.NEXT_PUBLIC_BASE_URL || 'https://zikkit-appointments.vercel.app';
      const params: Record<string, string> = { From: from, To: toNum, Body: body };
      if (logBizId) params.StatusCallback = `${cbBase}/api/sms/status?bizId=${logBizId}`;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
      });
      ok = res.ok;
      if (ok) {
        try { const j = await res.json() as { sid?: string }; msgSid = j.sid || ''; } catch { /* ignore */ }
      } else {
        try { const j = await res.json() as { code?: number; message?: string }; err = `${j.code || res.status}: ${j.message || ''}`.slice(0, 140); }
        catch { err = 'HTTP ' + res.status; }
      }
    } catch (e) { err = 'network: ' + (e as Error).message; }
  }
  if (!ok) console.error('[sms failed]', toNum, err);

  // Per-business SMS log (last 30) — so "sometimes it sends, sometimes not"
  // becomes a visible list instead of a mystery.
  if (logBizId) {
    try {
      const biz = await getBiz(logBizId);
      if (biz) {
        const log = (((biz.smsLog as Record<string, unknown>)?.items as unknown[]) || []);
        const entry = { at: new Date().toISOString(), to: toNum, ok, err, preview: body.slice(0, 60), sid: msgSid, delivery: ok ? 'נשלח, ממתין לאישור מסירה…' : '' };
        await setBizField(logBizId, ['smsLog', 'items'], [entry, ...log].slice(0, 30));
      }
    } catch { /* logging must never break the flow */ }
  }
  return ok;
}
