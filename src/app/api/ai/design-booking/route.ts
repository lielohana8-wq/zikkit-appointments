import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/ai/design-booking  { prompt, businessType }
 * Takes a natural-language prompt from the owner and returns booking-page
 * design settings (colors, texts, style).
 */
export async function POST(req: NextRequest) {
  try {
    const { prompt, businessType } = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'AI לא זמין כרגע — ערוך ידנית' }, { status: 500 });
    if (!prompt) return NextResponse.json({ error: 'חסר תיאור' }, { status: 400 });

    const sys = `אתה מעצב דפי הזמנת תורים לעסקים ישראליים. המשתמש יתאר איך הוא רוצה שדף ההזמנות שלו יראה וירגיש. החזר JSON בלבד (ללא טקסט נוסף, ללא markdown) עם השדות הבאים:
{
  "brandColor": "<hex color שמתאים לתיאור, למשל #7C3AED>",
  "headerStyle": "<banner|minimal|centered>",
  "welcomeText": "<טקסט ברוכים הבאים חם וקצר בעברית, עד 12 מילים>",
  "thankYouMessage": "<הודעת תודה אחרי קביעת תור, עד 12 מילים>",
  "cancellationNote": "<מדיניות ביטול קצרה ואדיבה בעברית>"
}
בחר צבע שתואם את האווירה (יוקרתי=סגול/שחור, רגוע=תכלת/ירוק, אנרגטי=כתום/ורוד). התאם את הטקסטים לסוג העסק.`;

    const userMsg = `סוג העסק: ${businessType || 'עסק תורים'}\nמה שאני רוצה: ${prompt}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: sys,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    if (!resp.ok) return NextResponse.json({ error: 'שגיאה בשירות ה-AI' }, { status: 500 });
    const data = await resp.json();
    let text = (data.content?.[0]?.text || '').trim();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const design = JSON.parse(text);
    return NextResponse.json({ design });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
