import { NextRequest, NextResponse } from 'next/server';
import { getBiz } from '@/lib/firestore-admin';

/**
 * POST /api/ai/marketing  { bizId }
 * Analyzes the appointment business and returns marketing/optimization advice.
 */
export async function POST(req: NextRequest) {
  try {
    const { bizId, summary } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'AI לא זמין כרגע' }, { status: 500 });

    let businessSummary = summary || '';
    if (bizId && !businessSummary) {
      const biz = await getBiz(bizId);
      if (biz) {
        const cfg = (biz.cfg as Record<string, unknown>) || {};
        const apt = (biz.appointments as Record<string, unknown>) || {};
        const bookings = (apt.bookings as unknown[]) || [];
        const dana = (biz.dana as Record<string, unknown>) || {};
        const services = (dana.services as Array<Record<string, unknown>>) || [];
        businessSummary = `שם העסק: ${cfg.biz_name || 'לא ידוע'}
תחום: עסק תורים
מספר תורים: ${bookings.length}
עמדות: ${apt.stations || 1}
שירותים: ${services.map((s) => s.name).join(', ') || 'לא הוגדרו'}`;
      }
    }

    const systemPrompt = `אתה יועץ שיווק ותפעול מומחה לעסקי תור בישראל (ספרים, קוסמטיקאיות, קליניקות). אתה מנתח נתוני עסק ונותן המלצות קונקרטיות איך למלא יותר תורים ולהגדיל הכנסה.

עקרונות:
- כל הטקסט בעברית
- המלצות קונקרטיות ומעשיות (לא כלליות)
- מותאם לעסקי תור בישראל 2026
- רעיונות למילוי חלונות ריקים, תורים חוזרים, upsell

החזר JSON בלבד:
{
  "headline": "תובנה מרכזית במשפט",
  "recommendations": [{"category":"שיווק/תפעול/תמחור/שימור","icon":"אימוג'י","title":"כותרת","action":"מה לעשות","impact":"high/medium/low"}],
  "postIdeas": ["רעיון 1","רעיון 2","רעיון 3"],
  "quickWin": "דבר מהיר להיום"
}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 2500, system: systemPrompt, messages: [{ role: 'user', content: `נתוני העסק:\n${businessSummary}\n\nתן המלצות.` }] }),
    });
    if (!res.ok) return NextResponse.json({ error: 'AI נכשל' }, { status: 500 });
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: 'תשובה לא תקינה' }, { status: 500 });
    return NextResponse.json(JSON.parse(m[0]));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
