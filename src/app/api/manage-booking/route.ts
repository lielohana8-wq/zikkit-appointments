import { NextRequest, NextResponse } from 'next/server';
import { getBiz, setBizField, sendSms } from '@/lib/firestore-admin';

/**
 * Self-service booking management for customers (no login).
 * Identity = bizId + manageToken (unguessable per-booking token).
 *
 * GET  /api/manage-booking?bizId=..&token=..     → booking details + biz name
 * POST /api/manage-booking {bizId, token, action:'cancel'}
 * POST /api/manage-booking {bizId, token, action:'reschedule', date, time}
 */

interface Bk { id: string; manageToken?: string; status: string; date: string; time: string; duration?: number; service?: string; customerName?: string; customerPhone?: string; staff?: string | null; }

async function findBooking(bizId: string, token: string) {
  const biz = await getBiz(bizId);
  if (!biz) return { biz: null, bookings: [] as Bk[], booking: null as Bk | null };
  const apt = (biz.appointments as Record<string, unknown>) || {};
  const bookings = ((apt.bookings as Bk[]) || []);
  const booking = bookings.find((b) => b.manageToken === token) || null;
  return { biz, bookings, booking };
}

export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId') || '';
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!bizId || !token) return NextResponse.json({ error: 'missing' }, { status: 400 });
  const { biz, booking } = await findBooking(bizId, token);
  if (!biz || !booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const bizName = ((biz.cfg as Record<string, unknown>)?.biz_name as string) || 'העסק';
  return NextResponse.json({
    bizName,
    booking: {
      service: booking.service, date: booking.date, time: booking.time,
      duration: booking.duration, staff: booking.staff || null,
      status: booking.status, customerName: booking.customerName,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { bizId, token, action, date, time } = await req.json();
    if (!bizId || !token || !action) return NextResponse.json({ error: 'missing' }, { status: 400 });

    const { biz, bookings, booking } = await findBooking(bizId, token);
    if (!biz || !booking) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    const bizName = ((biz.cfg as Record<string, unknown>)?.biz_name as string) || 'העסק';

    if (action === 'cancel') {
      const updated = bookings.map((b) => (b.manageToken === token ? { ...b, status: 'cancelled' } : b));
      await setBizField(bizId, ['appointments', 'bookings'], updated);
      // Notify owner
      const ownerPhone = ((biz.cfg as Record<string, unknown>)?.owner_phone as string) || ((biz.booking as Record<string, unknown>)?.notifyPhone as string);
      if (ownerPhone) sendSms(ownerPhone, `ביטול תור: ${booking.customerName} · ${booking.service} · ${booking.date} ${booking.time}`).catch(() => {});
      return NextResponse.json({ success: true, status: 'cancelled' });
    }

    if (action === 'reschedule') {
      if (!date || !time) return NextResponse.json({ error: 'missing date/time' }, { status: 400 });
      // Check the new slot is free
      const apt = (biz.appointments as Record<string, unknown>) || {};
      const stations = (apt.stations as number) || 1;
      const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
      const ns = toMin(time); const ne = ns + (booking.duration || 30);
      const overlap = bookings.filter((b) => {
        if (b.manageToken === token || b.date !== date || b.status === 'cancelled') return false;
        const bs = toMin(b.time); const be = bs + (b.duration || 30);
        return ns < be && ne > bs;
      }).length;
      if (overlap >= stations) return NextResponse.json({ error: 'slot_taken' }, { status: 409 });

      const updated = bookings.map((b) => (b.manageToken === token ? { ...b, date, time } : b));
      await setBizField(bizId, ['appointments', 'bookings'], updated);
      const ownerPhone = ((biz.cfg as Record<string, unknown>)?.owner_phone as string) || ((biz.booking as Record<string, unknown>)?.notifyPhone as string);
      if (ownerPhone) sendSms(ownerPhone, `שינוי תור: ${booking.customerName} · ${booking.service}\nל-${date} ${time}`).catch(() => {});
      if (booking.customerPhone) sendSms(booking.customerPhone, `התור שלך ב${bizName} עודכן ל-${date} בשעה ${time}. נתראה!`).catch(() => {});
      return NextResponse.json({ success: true, status: 'rescheduled' });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
