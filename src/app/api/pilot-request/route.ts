import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/pilot-request
 * Captures a pilot-access request (lead). Saves to Firestore `pilot_requests`
 * and emails the owner. Public — no auth. This GATES signups: nobody creates
 * an account directly; the owner reviews requests and approves manually.
 */
const PROJECT_ID = 'zikkit-e87ff';
const OWNER_EMAIL = process.env.PILOT_NOTIFY_EMAIL || 'ohanaliel@gmail.com';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body.name || '').trim();
    const bizName = (body.bizName || '').trim();
    const phone = (body.phone || '').trim();
    const email = (body.email || '').trim();
    const bizType = (body.bizType || '').trim();
    const note = (body.note || '').trim();

    if (!name || !phone) {
      return NextResponse.json({ error: 'חסרים שם וטלפון' }, { status: 400 });
    }

    const lead = {
      name, bizName, phone, email, bizType, note,
      status: 'new',
      createdAt: new Date().toISOString(),
    };

    // 1. Save to Firestore (best-effort; never block the user on this).
    let saved = false;
    try {
      const { getAccessToken } = await import('@/lib/firestore-admin');
      const token = await getAccessToken();
      const docId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const fields: Record<string, { stringValue: string }> = {};
      Object.entries(lead).forEach(([k, v]) => { fields[k] = { stringValue: String(v) }; });
      const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/pilot_requests?documentId=${docId}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fields }),
      });
      saved = r.ok;
    } catch (e) {
      console.error('[pilot-request] firestore save failed:', (e as Error).message);
    }

    // 2. Email the owner (best-effort; needs RESEND_API_KEY).
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: 'Zikkit Pilot <onboarding@resend.dev>',
            to: [OWNER_EMAIL],
            subject: `🎯 בקשת פיילוט חדשה: ${bizName || name}`,
            html: `
              <div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;">
                <h2>בקשה חדשה להצטרף לפיילוט</h2>
                <p><b>שם:</b> ${name}</p>
                <p><b>עסק:</b> ${bizName || '—'}</p>
                <p><b>סוג עסק:</b> ${bizType || '—'}</p>
                <p><b>טלפון:</b> ${phone}</p>
                <p><b>אימייל:</b> ${email || '—'}</p>
                ${note ? `<p><b>הערה:</b> ${note}</p>` : ''}
                <hr><p style="color:#888;font-size:13px;">נשלח אוטומטית מ-Zikkit Appointments</p>
              </div>`,
          }),
        });
      }
    } catch (e) {
      console.error('[pilot-request] email failed:', (e as Error).message);
    }

    // Always succeed for the user as long as we captured the lead in memory.
    return NextResponse.json({ success: true, saved });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
