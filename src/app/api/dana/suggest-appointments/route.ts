import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/dana/suggest-appointments
 *
 * For appointment-based businesses (barbers, beauty, clinics).
 * Identifies business type and suggests services with DURATION
 * (critical for appointment booking) + pricing + what to ask.
 */
export async function POST(req: NextRequest) {
  try {
    const { businessName, description } = await req.json();

    if (!businessName?.trim()) {
      return NextResponse.json({ error: 'חסר שם עסק' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI לא זמין כרגע' }, { status: 500 });
    }

    const systemPrompt = `אתה מומחה לעסקי תור בישראל (ספרים, מספרות, קוסמטיקאיות, מכוני יופי, קליניקות, מניקור, עיסוי, רופאי שיניים, פיזיותרפיה ועוד). המשתמש יספק שם עסק, ותפקידך לזהות את סוג העסק ולהציע שירותים עם משך זמן, מחיר ושאלות.

חשוב מאוד:
- כל הטקסט בעברית
- כל שירות חייב משך זמן בדקות (קריטי לקביעת תורים!)
- מחירים בש"ח ריאליים לישראל 2026
- 5-8 שירותים נפוצים בתחום
- שורת פתיחה ידידותית לקביעת תור
- "מה לשאול" - שאלות רלוונטיות (למשל: גבר/אישה, אורך שיער, האם הייתה כבר)

החזר JSON בלבד, ללא טקסט נוסף:
{
  "businessType": "תיאור קצר",
  "industry": "תחום (ספרות/קוסמטיקה/קליניקה/מניקור/עיסוי/...)",
  "suggestedGreeting": "שורת פתיחה לקביעת תור",
  "stations": מספר עמדות/כיסאות טיפוסי (מספר),
  "services": [
    {
      "name": "שם השירות",
      "duration": משך בדקות (מספר),
      "price": "מחיר כמספר בלבד",
      "whatToAsk": "מה לשאול לפני קביעת התור"
    }
  ],
  "recurring": true/false (האם נפוץ תורים חוזרים בתחום),
  "recurringInterval": מרווח טיפוסי בשבועות (מספר, אם recurring),
  "suggestedFields": {
    "fullName": true,
    "phone": true,
    "service": true,
    "preferredDate": true,
    "preferredStaff": true/false (האם רלוונטי לבחור איש צוות),
    "notes": false
  }
}`;

    const userMsg = description
      ? `שם העסק: ${businessName}\nתיאור נוסף: ${description}`
      : `שם העסק: ${businessName}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Anthropic appointments]', err);
      return NextResponse.json({ error: 'AI לא הצליח לזהות את העסק' }, { status: 500 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'תשובה לא תקינה מ-AI' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.services && Array.isArray(parsed.services)) {
      parsed.services = parsed.services.map((s: Record<string, unknown>) => ({
        ...s,
        id: 'apt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      }));
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error('[Suggest appointments]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
