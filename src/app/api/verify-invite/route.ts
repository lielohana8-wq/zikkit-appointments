import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/verify-invite  { code }
 * Checks whether an invite code exists and is unused. Called during signup to
 * gate registration to approved leads. On success returns the lead's details
 * so the signup form can prefill. Marking as used happens after the account
 * is actually created (POST with { code, markUsed: true }).
 */
const PROJECT_ID = 'zikkit-e87ff';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'verify-invite', 10, 60_000);
  if (limited) return limited;

  try {
    const { code, markUsed } = await req.json();
    if (!code || typeof code !== 'string') return NextResponse.json({ valid: false, error: 'missing code' }, { status: 400 });

    const { getAccessToken } = await import('@/lib/firestore-admin');
    const token = await getAccessToken();

    // Query pilot_requests for a matching, unused invite code
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
    const res = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'pilot_requests' }],
          where: { fieldFilter: { field: { fieldPath: 'inviteCode' }, op: 'EQUAL', value: { stringValue: code.trim().toUpperCase() } } },
          limit: 1,
        },
      }),
    });
    const data = await res.json();
    const doc = Array.isArray(data) ? data.find((d: { document?: unknown }) => d.document)?.document : null;
    if (!doc) return NextResponse.json({ valid: false, error: 'קוד לא נמצא' });

    const f = doc.fields || {};
    if (f.inviteUsed?.booleanValue === true) return NextResponse.json({ valid: false, error: 'הקוד כבר נוצל' });

    // Optionally mark used (after successful account creation)
    if (markUsed) {
      const docId = doc.name.split('/').pop();
      await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/pilot_requests/${docId}?updateMask.fieldPaths=inviteUsed`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields: { inviteUsed: { booleanValue: true } } }),
      });
      return NextResponse.json({ valid: true, marked: true });
    }

    return NextResponse.json({
      valid: true,
      lead: {
        name: f.name?.stringValue || '',
        bizName: f.bizName?.stringValue || '',
        email: f.email?.stringValue || '',
        phone: f.phone?.stringValue || '',
      },
    });
  } catch (e) {
    return NextResponse.json({ valid: false, error: (e as Error).message }, { status: 500 });
  }
}
