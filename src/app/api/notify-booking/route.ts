import { NextRequest, NextResponse } from 'next/server';
import { getBiz, sendSms } from '@/lib/firestore-admin';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * SMS confirmations for MANUALLY-created bookings (from the calendar).
 * Online bookings notify inside /api/public-booking; this closes the gap
 * the barbershop found: "only reminders arrive, never confirmations".
 * Secured: requires a Firebase idToken belonging to the business owner
 * or one of its team-member logins.
 */
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'notify-booking', 10, 60_000);
  if (limited) return limited;
  try {
    const { bizId, idToken, booking } = await req.json();
    if (!bizId || !idToken || !booking?.date || !booking?.time) {
      return NextResponse.json({ error: 'missing data' }, { status: 400 });
    }
    // Verify the caller really belongs to this business
    const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
    });
    if (!lookup.ok) return NextResponse.json({ error: 'auth failed' }, { status: 401 });
    const who = (await lookup.json()) as { users?: Array<{ localId?: string; email?: string }> };
    const uid = who.users?.[0]?.localId || '';
    const email = (who.users?.[0]?.email || '').toLowerCase();
    const biz = await getBiz(bizId);
    if (!biz) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const ownerEmail = String(biz.ownerEmail || '').toLowerCase();
    const members = (((biz.team as Record<string, unknown>)?.members as Array<Record<string, unknown>>) || []);
    const isTeam = members.some((m) => String(m.loginEmail || '').toLowerCase() === email && email);
    if (uid !== bizId && email !== ownerEmail && !isTeam) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const bizName = ((biz.cfg as Record<string, unknown>)?.biz_name as string) || 'העסק';
    const sent: string[] = [];
    // Customer confirmation
    if (booking.customerPhone) {
      await sendSms(booking.customerPhone, `היי ${String(booking.customerName || '').split(' ')[0]}! נקבע לך תור ב${bizName} 💜\n${booking.date} בשעה ${booking.time}${booking.service ? '\n' + booking.service : ''}${booking.staff ? ' אצל ' + booking.staff : ''}`, bizId);
      sent.push('customer');
    }
    // Assigned team member
    if (booking.staff) {
      const mem = members.find((m) => String(m.name) === booking.staff);
      if (mem?.phone) {
        await sendSms(String(mem.phone), `תור חדש אצלך! ${booking.customerName || ''} · ${booking.service || ''} · ${booking.date} בשעה ${booking.time}`, bizId);
        sent.push('staff');
      }
    }
    return NextResponse.json({ success: true, sent });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
