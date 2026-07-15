import { NextResponse } from 'next/server';
import { listAllBiz, setBizField, sendSms, sendPush } from '@/lib/firestore-admin';
import { getBiz } from '@/lib/firestore-admin';

export const maxDuration = 60;

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
        // Two reminders, each EXACTLY once: ~24h before and ~12h before.
        // Flags are set on ATTEMPT (not on SMS success) — a broken SMS provider
        // must never turn reminders into spam.
        if (b.status === 'confirmed' && b.customerPhone && b.date && b.time) {
          const apptMs = new Date(`${b.date}T${b.time}:00`).getTime();
          const hrs = (apptMs - Date.now()) / 3600000;
          if (hrs > 0 && hrs <= 24) {
            const had24 = !!(b.rem24 || b.reminded);
            const send12 = hrs <= 12 && !b.rem12;
            const send24 = !send12 && !had24;
            if (send12 || send24) {
              const dayWord = hrs <= 22 ? 'היום' : 'מחר';
              await sendSms(b.customerPhone as string, `תזכורת מ${bizName}: יש לך תור ${dayWord} ב-${b.time} ל${b.service}. נתראה! (להשיב "ביטול" לביטול)`).catch(() => {});
              await sendPush(id, String(b.customerPhone), `תזכורת — ${bizName} 🔔`, `יש לך תור ${dayWord} ב-${b.time} · ${b.service}. נתראה!`).catch(() => {});
              if (send12) { b.rem12 = true; b.rem24 = true; } else { b.rem24 = true; }
              b.reminded = true;
              changed = true;
              sent++;
            }
          }
        }
      }

      if (changed) {

      // ── Robustness: archive old bookings (defuses the 1MB doc bomb) ──
      try {
        if (bookings.length > 300) {
          const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const cutoffCancelled = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const toArchive = bookings.filter((b) => String(b.date || '') < ((b.status === 'cancelled') ? cutoffCancelled : cutoff));
          if (toArchive.length > 0) {
            const keep = bookings.filter((b) => !toArchive.includes(b));
            const ym = new Date().toISOString().slice(0, 7).replace('-', '');
            const archId = `arch_${id}_${ym}`;
            const archDoc = await getBiz(archId);
            const existing = ((archDoc?.bookings as unknown[]) || []);
            await setBizField(archId, ['bookings'], [...existing, ...toArchive]);
            await setBizField(id, ['appointments', 'bookings'], keep);
            console.log(`[cron] archived ${toArchive.length} bookings for ${id}`);
          }
        }
      } catch (archErr) { console.error('[cron] archive failed', id, archErr); }

      // ── Robustness: rolling daily backup snapshot ──
      try {
        await setBizField(`bak_${id}`, ['snapshot'], data);
        await setBizField(`bak_${id}`, ['at'], new Date().toISOString());
      } catch (bakErr) { console.error('[cron] backup failed', id, bakErr); }
        await setBizField(id, ['appointments', 'bookings'], bookings);
      }
    }

    return NextResponse.json({ success: true, remindersSent: sent, date: tomorrowStr });
  } catch (e) {
    console.error('[reminders cron]', e);
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
