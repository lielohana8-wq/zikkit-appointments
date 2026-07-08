import { NextRequest, NextResponse } from 'next/server';

/**
 * GET   /api/pilot-requests           → list all pilot requests (owner only)
 * PATCH /api/pilot-requests {id,status} → update a request's status
 *
 * Simple owner gate: requires ?key=<PILOT_ADMIN_KEY> matching env, OR allows
 * when no key is configured (so it works out of the box; set the key to lock).
 */
const PROJECT_ID = 'zikkit-e87ff';

// Platform owner(s) — only these may read/modify pilot leads. Server-side gate.
const OWNER_EMAILS = (process.env.PILOT_OWNER_EMAILS || 'ohanaliel@gmail.com')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

function authed(req: NextRequest, bodyEmail?: string): boolean {
  // Optional shared-secret key still works (for tooling).
  const required = process.env.PILOT_ADMIN_KEY;
  if (required) {
    const key = req.nextUrl.searchParams.get('key') || req.headers.get('x-admin-key');
    if (key === required) return true;
  }
  // Primary gate: caller must identify as an owner email.
  const email = (bodyEmail || req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  return OWNER_EMAILS.includes(email);
}

function decodeFields(fields: Record<string, { stringValue?: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(fields || {}).forEach(([k, v]) => { out[k] = v.stringValue || ''; });
  return out;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { getAccessToken } = await import('@/lib/firestore-admin');
    const token = await getAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/pilot_requests?pageSize=300`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    const docs = (data.documents || []).map((d: { name: string; fields: Record<string, { stringValue?: string }> }) => {
      const id = d.name.split('/').pop();
      return { id, ...decodeFields(d.fields) };
    });
    // Newest first
    docs.sort((a: { createdAt?: string }, b: { createdAt?: string }) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return NextResponse.json({ requests: docs });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, requests: [] }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status, email } = await req.json();
    if (!authed(req, email)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!id || !status) return NextResponse.json({ error: 'missing id or status' }, { status: 400 });
    const { getAccessToken } = await import('@/lib/firestore-admin');
    const token = await getAccessToken();

    // On approval, generate a one-time invite code the owner sends to the lead.
    let inviteCode = '';
    const fields: Record<string, unknown> = { status: { stringValue: status } };
    let mask = 'updateMask.fieldPaths=status';
    if (status === 'approved') {
      inviteCode = 'ZK-' + Math.random().toString(36).slice(2, 6).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
      fields.inviteCode = { stringValue: inviteCode };
      fields.inviteUsed = { booleanValue: false };
      mask += '&updateMask.fieldPaths=inviteCode&updateMask.fieldPaths=inviteUsed';
    }

    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/pilot_requests/${id}?${mask}`;
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields }),
    });
    if (!r.ok) return NextResponse.json({ error: 'update failed' }, { status: 500 });
    return NextResponse.json({ success: true, inviteCode });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
