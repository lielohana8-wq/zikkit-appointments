import { NextRequest, NextResponse } from 'next/server';
import { getBiz, setBizField } from '@/lib/firestore-admin';

/**
 * POST /api/ai/build-landing { bizId, businessName, industry, services }
 * Generates landing content and saves it to the appointment business doc.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bizId, businessName, industry, services = [], contactPhone } = body;
    if (!businessName) return NextResponse.json({ error: 'חסר שם עסק' }, { status: 400 });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'AI לא זמין כרגע' }, { status: 500 });

    const servicesText = services.map((s: Record<string, unknown>) => `${s.name}${s.price ? ` (₪${s.price})` : ''}`).join(', ');
    const systemPrompt = `אתה קופירייטר מומחה לדפי נחיתה לעסקי תור בישראל (מספרות, קוסמטיקה, קליניקות). צור תוכן מלא ומשכנע.

החזר JSON בלבד:
{
  "tagline":"סלוגן קצר","heroTitle":"כותרת ראשית","heroSubtitle":"תת-כותרת",
  "ctaText":"טקסט כפתור (למשל: קבע תור)","about":"פסקת עלינו",
  "whyUs":[{"icon":"אימוג'י","title":"כותרת","desc":"תיאור"}],
  "servicesIntro":"משפט מקדים","testimonialPlaceholder":"המלצה לדוגמה",
  "ctaSection":"קריאה לפעולה","colorTheme":"#9333EA","seoDescription":"תיאור SEO"
}`;
    const userMsg = `שם: ${businessName}\nתחום: ${industry || 'עסק תורים'}\nשירותים: ${servicesText || 'טיפולים'}\n${contactPhone ? `טלפון: ${contactPhone}` : ''}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 2500, system: systemPrompt, messages: [{ role: 'user', content: userMsg }] }),
    });
    if (!res.ok) return NextResponse.json({ error: 'AI נכשל' }, { status: 500 });
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: 'תשובה לא תקינה' }, { status: 500 });
    const content = JSON.parse(m[0]);

    const slug = (businessName as string).toLowerCase().replace(/[^\w\u0590-\u05FF]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'biz-' + Date.now();

    if (bizId && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        await setBizField(bizId, ['landing'], { ...content, slug, businessName, industry: industry || '', services, contactPhone: contactPhone || '', generatedAt: new Date().toISOString() });
      } catch (e) { console.warn('save failed', e); }
    }
    return NextResponse.json({ ...content, slug });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
