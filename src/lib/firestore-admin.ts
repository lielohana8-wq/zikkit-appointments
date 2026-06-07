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
  const sa = JSON.parse(saKey);
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
  const jwt = `${unsigned}.${signer.sign(sa.private_key, 'base64url')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const data = await res.json();
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

export async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_IL || process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return false;
  let toNum = to.replace(/[^\d]/g, '');
  if (toNum.startsWith('0')) toNum = '972' + toNum.slice(1);
  if (!toNum.startsWith('+')) toNum = '+' + toNum;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: toNum, Body: body }),
  });
  return res.ok;
}
