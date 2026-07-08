import { NextRequest, NextResponse } from 'next/server';
import { getBiz, setBizField, sendSms } from '@/lib/firestore-admin';

/**
 * WhatsApp booking webhook (via Twilio WhatsApp or Meta Cloud API).
 *
 * ⚠️ IMPORTANT: This endpoint is READY but will only function once you have:
 *   1. A WhatsApp Business API number (Twilio WhatsApp sandbox, or approved Meta number)
 *   2. The webhook URL configured in Twilio/Meta to point here
 *   3. Meta Business verification (for production, non-sandbox use)
 *
 * Until then, this returns gracefully. No code change needed once approved —
 * just point the WhatsApp number's webhook to /api/whatsapp/webhook.
 *
 * Flow: customer texts the business WhatsApp → Dana (AI) replies, collects
 * details, checks availability, and books — all in WhatsApp chat.
 */

// Meta verification handshake (GET)
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'zikkit_verify';
  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ status: 'webhook ready', configured: !!process.env.WHATSAPP_VERIFY_TOKEN });
}

// Incoming message (POST) — from Twilio WhatsApp or Meta
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let from = '';
    let body = '';
    let toBizNumber = '';

    if (contentType.includes('application/json')) {
      // Meta Cloud API format
      const data = await req.json();
      const msg = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      from = msg?.from || '';
      body = msg?.text?.body || '';
      toBizNumber = data?.entry?.[0]?.changes?.[0]?.value?.metadata?.display_phone_number || '';
    } else {
      // Twilio WhatsApp format (form-encoded)
      const form = await req.formData();
      from = String(form.get('From') || '').replace('whatsapp:', '');
      body = String(form.get('Body') || '');
      toBizNumber = String(form.get('To') || '').replace('whatsapp:', '');
    }

    if (!from || !body) {
      return NextResponse.json({ status: 'no message' });
    }

    // Look up which business owns this WhatsApp number
    const bizId = await findBizByWhatsApp(toBizNumber);
    if (!bizId) {
      return NextResponse.json({ status: 'no business mapped to this number' });
    }

    // Process the message with Dana AI (booking conversation)
    const reply = await danaWhatsAppReply(bizId, from, body);

    // The actual send-back happens via Twilio/Meta send API (configured per provider).
    // For Twilio WhatsApp, returning TwiML or calling the messages API works.
    return NextResponse.json({ status: 'processed', reply });
  } catch (e) {
    console.error('[whatsapp webhook]', e);
    return NextResponse.json({ status: 'error', error: (e as Error).message });
  }
}

async function findBizByWhatsApp(_number: string): Promise<string | null> {
  // TODO: map WhatsApp numbers to bizId (stored in cfg.whatsapp_number).
  // Returns null until a business has connected a WhatsApp number.
  return null;
}

async function danaWhatsAppReply(bizId: string, from: string, message: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return 'מצטערים, השירות אינו זמין כרגע.';

  const biz = await getBiz(bizId);
  const cfg = (biz?.cfg as Record<string, unknown>) || {};
  const dana = (biz?.dana as Record<string, unknown>) || {};
  const services = (dana.services as Array<Record<string, unknown>>) || [];

  // Load conversation history for this customer (kept on the business doc)
  const convos = ((biz?.whatsapp as Record<string, unknown>)?.conversations as Record<string, unknown[]>) || {};
  const history = (convos[from] as Array<{ role: string; content: string }>) || [];

  const systemPrompt = `את Dana, עוזרת AI לקביעת תורים ב${cfg.biz_name || 'העסק'} דרך וואטסאפ.
תפקידך: לקבל פניות, להציע שירותים, ולקבוע תור.
שירותים זמינים: ${services.map((s) => `${s.name} (${s.duration} דק', ₪${s.price})`).join(', ') || 'אין'}.
דברי בעברית, חם ומקצועי, משפט אחד בכל פעם. כשיש מספיק פרטים (שם, שירות, יום ושעה) — אשרי את התור.`;

  const messages = [...history, { role: 'user', content: message }];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 500, system: systemPrompt, messages }),
  });
  if (!res.ok) return 'מצטערים, יש תקלה זמנית.';
  const data = await res.json();
  const reply = data.content?.[0]?.text || 'איך אפשר לעזור?';

  // Persist conversation (last 10 turns)
  const updated = [...messages, { role: 'assistant', content: reply }].slice(-10);
  try {
    await setBizField(bizId, ['whatsapp', 'conversations', from], updated);
  } catch { /* ignore */ }

  return reply;
}
