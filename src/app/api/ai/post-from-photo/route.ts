import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/ai/post-from-photo
 *
 * Takes a photo of completed work + context, returns a polished
 * social-media-ready caption in Hebrew (and hashtags) using Claude vision.
 *
 * Body: {
 *   imageBase64: string (data without the data:image/... prefix),
 *   mediaType: 'image/jpeg' | 'image/png',
 *   businessName: string,
 *   serviceType?: string,
 *   tone?: 'professional' | 'friendly' | 'energetic'
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType = 'image/jpeg', businessName, serviceType, tone = 'friendly' } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'חסרה תמונה' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI לא זמין כרגע' }, { status: 500 });
    }

    const toneDesc = ({
      professional: 'מקצועי ורשמי',
      friendly: 'חברותי וחם',
      energetic: 'אנרגטי ומלהיב',
    } as Record<string, string>)[tone] || 'חברותי וחם';

    const systemPrompt = `אתה מומחה לשיווק ברשתות חברתיות לעסקי שירות בישראל. אתה מקבל תמונה של עבודה שהושלמה, ויוצר פוסט איכותי בעברית.

הסגנון: ${toneDesc}
שם העסק: ${businessName || 'העסק'}
${serviceType ? `סוג השירות: ${serviceType}` : ''}

החזר JSON בלבד:
{
  "caption": "טקסט הפוסט המלא בעברית - 2-4 משפטים, מושך, עם קריאה לפעולה",
  "shortCaption": "גרסה קצרה לסטורי/טוויטר",
  "hashtags": ["האשטאג1", "האשטאג2", "..."],
  "imageDescription": "תיאור קצר של מה שרואים בתמונה"
}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'צור פוסט שיווקי מהתמונה הזו.' },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[AI post-from-photo]', err);
      return NextResponse.json({ error: 'AI נכשל לנתח את התמונה' }, { status: 500 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'תשובה לא תקינה' }, { status: 500 });

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error('[AI post-from-photo]', e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
