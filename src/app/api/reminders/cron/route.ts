import { NextResponse } from 'next/server';
import { listAllBiz, setBizField, sendSms, sendPush } from '@/lib/firestore-admin';

/**
 * GET /api/reminders/cron
 *
 * Runs daily (Vercel cron). Sends an SMS reminder to every customer
 * who has a confirmed appointment TOMORROW and hasn't been reminded yet.
 *
 * Add to vercel.json:
 *   { "crons": [{ "path": "/api/reminders/cron", "schedule": "0 9 * * *" }] }
 */
export async function GET() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const businesses = await listAllBiz();
    const yd = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`;
    let sent = 0;

    for (const { id, data } of businesses) {
      const apt = (data.appointments as Record<string, unknown>) || {};
      const bookings = (apt.bookings as Array<Record<string, unknown>>) || [];
      const bizName = (data.cfg as Record<string, unknown>)?.biz_name || 'העסק';
      let changed = false;

      for (const b of bookings) {
        // Auto review request: the morning after a visit, a free push asks
        // for feedback — the reviews carousel fills itself.
        if (b.date === yesterdayStr && b.status !== 'cancelled' && b.status !== 'blocked' && !b.reviewAsked && b.customerPhone) {
          await sendPush(id, String(b.customerPhone), `איך היה ב${bizName}? ⭐`, 'נשמח לשמוע! כתבו לנו ביקורת קצרה בפרופיל שבאפליקציה 💜').catch(() => {});
          b.reviewAsked = true;
          changed = true;
        }
        if (
          b.date === tomorrowStr &&
          b.status === 'confirmed' &&
          !b.reminded &&
          b.customerPhone
        ) {
          const ok = await sendSms(
            b.customerPhone as string,
            `תזכורת מ${bizName}: יש לך תור מחר ב-${b.time} ל${b.service}. נתראה! (להשיב "ביטול" לביטול)`
          );
          await sendPush(id, String(b.customerPhone), `תזכורת — ${bizName} 🔔`, `יש לך תור מחר ב-${b.time} · ${b.service}. נתראה!`).catch(() => {});
          if (ok) {
            b.reminded = true;
            changed = true;
            sent++;
          }
        }
      }

      if (changed) {
        await setBizField(id, ['appointments', 'bookings'], bookings);
      }
    }

    return NextResponse.json({ success: true, remindersSent: sent, date: tomorrowStr });
  } catch (e) {
    console.error('[reminders cron]', e);
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
