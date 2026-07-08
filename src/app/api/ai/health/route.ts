import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * AI diagnostics — open /api/ai/health in the browser to see exactly
 * why AI features are (or aren't) working. Makes support a 10-second job.
 */
export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      keyPresent: false,
      fix: 'ANTHROPIC_API_KEY חסר בסביבת הריצה. Vercel → Settings → Environment Variables → הוסף ל-Production → ואז Redeploy (חובה! env לא חל על דיפלוי קיים).',
    });
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 5, messages: [{ role: 'user', content: 'hi' }] }),
    });
    if (res.ok) {
      return NextResponse.json({ ok: true, keyPresent: true, keyWorks: true, message: 'ה-AI חי ועובד ✅' });
    }
    const detail = await res.text();
    const fix = res.status === 401 ? 'המפתח לא תקין — צור מפתח חדש ב-console.anthropic.com והחלף ב-Vercel'
      : res.status === 400 && detail.includes('credit') ? 'אין יתרה בחשבון Anthropic — Settings → Billing → טען קרדיט'
      : res.status === 429 ? 'חריגת קצב — נסה שוב בעוד דקה'
      : 'שגיאת API — ראה detail';
    return NextResponse.json({ ok: false, keyPresent: true, keyWorks: false, status: res.status, fix, detail: detail.slice(0, 300) });
  } catch (e) {
    return NextResponse.json({ ok: false, keyPresent: true, keyWorks: false, fix: 'שגיאת רשת מול Anthropic', detail: (e as Error).message });
  }
}
