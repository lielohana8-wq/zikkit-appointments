import { NextRequest, NextResponse } from 'next/server';
import { getBiz, setBizField, sendSms, sendPush } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * 🎙️ Dana v1 — AI phone receptionist over Twilio Voice.
 * Twilio does Hebrew STT (<Gather input="speech">) and TTS (<Say> Polly he-IL);
 * Claude is the brain; bookings land straight in the business calendar.
 * Setup: Twilio number Voice webhook (POST) → /api/dana/voice
 * Env: DANA_BIZ_MAP="+972XXXXXXXXX:bizId" (or DANA_DEFAULT_BIZ).
 */

const xml = (body: string) =>
  new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });

const say = (t: string) => `<Say voice="Polly.Hila" language="he-IL">${t.replace(/&/g, 'ו')}</Say>`;
const gather = (state: string, prompt: string) =>
  `<Gather input="speech" language="he-IL" speechTimeout="auto" action="/api/dana/voice?st=${encodeURIComponent(state)}" method="POST">${say(prompt)}</Gather>${say('לא שמעתי, נסו שוב מאוחר יותר. יום נעים!')}`;

function bizIdForNumber(to: string): string {
  const map = (process.env.DANA_BIZ_MAP || '').split(',').map((p) => p.trim()).filter(Boolean);
  for (const pair of map) {
    const [num, id] = pair.split(':');
    if (num && id && to.replace(/\D/g, '').endsWith(num.replace(/\D/g, '').slice(-9))) return id;
  }
  return process.env.DANA_DEFAULT_BIZ || '';
}

const t2m = (t: string) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const speech = String(form.get('SpeechResult') || '').trim();
    const from = String(form.get('From') || '');
    const to = String(form.get('To') || '');
    const bizId = bizIdForNumber(to);
    if (!bizId) return xml(say('המערכת אינה מוגדרת עדיין. להתראות!') + '<Hangup/>');

    const biz = await getBiz(bizId);
    if (!biz) return xml(say('העסק לא נמצא. להתראות!') + '<Hangup/>');
    const bizName = ((biz.cfg as Record<string, unknown>)?.biz_name as string) || 'העסק';

    let history: Array<{ role: string; content: string }> = [];
    try { history = JSON.parse(Buffer.from(req.nextUrl.searchParams.get('st') || '', 'base64').toString() || '[]'); } catch { /* fresh */ }

    if (!speech) {
      return xml(gather('', `שלום, הגעתם ל${bizName}. מדברת דנה, העוזרת החכמה. איך אפשר לעזור? אפשר לבקש למשל תור לתספורת מחר בחמש.`));
    }

    const services = ((((biz.services as Record<string, unknown>) || {}).items as Array<Record<string, unknown>>) || [])
      .map((s) => `${s.name} (₪${s.price}, ${s.duration || 30} דק')`).join(' · ') || "תספורת (30 דק')";
    const team = ((((biz.team as Record<string, unknown>) || {}).members as Array<Record<string, unknown>>) || []).map((m) => m.name).join(', ');
    const today = new Date();
    const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    history.push({ role: 'user', content: speech });
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 300,
        system: `את דנה, פקידת קבלה טלפונית של "${bizName}". תפקידך לקבוע תורים בשיחה קצרה וחמה בעברית. היום ${dstr(today)} (${['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][today.getDay()]}). שירותים: ${services}. צוות: ${team || 'ללא'}. החזירי אך ורק JSON תקין: {"reply":"מה להגיד (משפט-שניים, בלי אימוג'י)","action":"ask|book|bye","booking":{"service":"...","date":"YYYY-MM-DD","time":"HH:MM","staff":"או ריק","name":"שם הלקוח אם נאמר"}}. כללי ברזל: action=book רק כשיש שירות+תאריך+שעה ברורים ואישרת מול הלקוח. אם חסר פרט - שאלי (action=ask). לסיום שיחה - action=bye.`,
        messages: history.slice(-6),
      }),
    });
    const aiJson = await aiRes.json();
    const raw = (aiJson?.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim();
    let out: { reply?: string; action?: string; booking?: { service?: string; date?: string; time?: string; staff?: string; name?: string } } = {};
    try { out = JSON.parse(raw); } catch { out = { reply: 'סליחה, אפשר לחזור על זה?', action: 'ask' }; }
    let reply = out.reply || 'אפשר לחזור על זה?';

    if (out.action === 'book' && out.booking?.date && out.booking?.time && out.booking?.service) {
      const b = out.booking;
      const apt = (biz.appointments as Record<string, unknown>) || {};
      const all = ((apt.bookings as Array<Record<string, unknown>>) || []);
      const startM = t2m(b.time!);
      const clash = all.some((x) => x.date === b.date && x.status !== 'cancelled' && (!b.staff || !x.staff || x.staff === b.staff) &&
        Math.max(startM, t2m(String(x.time || '0:0'))) < Math.min(startM + 30, t2m(String(x.time || '0:0')) + (Number(x.duration) || 30)));
      if (clash) {
        reply = `אוי, ${b.time} כבר תפוס בתאריך הזה. איזו שעה אחרת נוחה לכם?`;
        history.push({ role: 'assistant', content: JSON.stringify({ reply, action: 'ask' }) });
      } else {
        const booking = { id: 'bk_dana_' + Date.now(), service: b.service, staff: b.staff || '', date: b.date, time: b.time, duration: 30, customerName: b.name || 'לקוח טלפוני', customerPhone: from.replace('+972', '0'), price: 0, status: 'confirmed', createdAt: new Date().toISOString(), source: 'dana' };
        await setBizField(bizId, ['appointments', 'bookings'], [...all, booking]);
        const ownerPhone = ((biz.booking as Record<string, unknown>)?.notifyPhone as string) || ((biz.cfg as Record<string, unknown>)?.owner_phone as string) || '';
        if (ownerPhone) {
          await sendSms(ownerPhone, `🎙️ דנה קבעה תור: ${booking.customerName} · ${b.service} · ${b.date} ${b.time}`, bizId).catch(() => {});
          await sendPush(bizId, ownerPhone, '🎙️ דנה קבעה תור!', `${b.service} · ${b.date} ב-${b.time}`).catch(() => {});
        }
        await sendSms(booking.customerPhone, `התור נקבע! ${bizName}: ${b.service} · ${b.date} בשעה ${b.time}. נתראה!`, bizId).catch(() => {});
        reply = `${out.reply || 'מעולה, קבעתי לכם!'} שלחתי אישור בהודעה. להתראות!`;
        return xml(say(reply) + '<Hangup/>');
      }
    } else {
      history.push({ role: 'assistant', content: JSON.stringify(out) });
    }

    if (out.action === 'bye') return xml(say(reply) + '<Hangup/>');
    const state = Buffer.from(JSON.stringify(history.slice(-6))).toString('base64');
    return xml(gather(state, reply));
  } catch {
    return xml(say('מצטערת, יש תקלה רגעית. נסו שוב עוד רגע.') + '<Hangup/>');
  }
}
