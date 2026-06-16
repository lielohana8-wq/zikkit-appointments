import { NextRequest, NextResponse } from 'next/server';
import { getBiz, setBizField, sendSms } from '@/lib/firestore-admin';

/**
 * Appointments management (for the visual calendar + manual booking).
 * GET  /api/appointments?bizId=xxx          → all bookings
 * POST /api/appointments                    → create/cancel/update a booking
 */

export async function GET(req: NextRequest) {
  try {
    const bizId = req.nextUrl.searchParams.get('bizId');
    if (!bizId) return NextResponse.json({ error: 'missing bizId' }, { status: 400 });
    const biz = await getBiz(bizId);
    const bookings = ((biz?.appointments as Record<string, unknown>)?.bookings as unknown[]) || [];
    const stations = ((biz?.appointments as Record<string, unknown>)?.stations as number) || 1;
    return NextResponse.json({ success: true, bookings, stations });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bizId, action, booking } = body;
    if (!bizId) return NextResponse.json({ error: 'missing bizId' }, { status: 400 });

    const biz = await getBiz(bizId);
    let bookings = (((biz?.appointments as Record<string, unknown>)?.bookings) as Array<Record<string, unknown>>) || [];

    if (action === 'create') {
      const newBooking = {
        id: 'apt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        source: booking.source || 'manual',
        customerName: booking.customerName || '',
        customerPhone: booking.customerPhone || '',
        service: booking.service || '',
        duration: booking.duration || 30,
        date: booking.date,
        time: booking.time,
        staff: booking.staff || null,
        station: booking.station || null,
        notes: booking.notes || '',
        status: 'confirmed',
        reminded: false,
        createdAt: new Date().toISOString(),
      };
      bookings = [newBooking, ...bookings];
      // SMS confirmation
      if (booking.customerPhone) {
        const bizName = (biz?.cfg as Record<string, unknown>)?.biz_name || 'העסק';
        sendSms(booking.customerPhone, `התור שלך ב${bizName} נקבע!\n${booking.date} בשעה ${booking.time}\n${booking.service}`).catch(() => {});
      }
    } else if (action === 'cancel') {
      bookings = bookings.map((b) => (b.id === booking.id ? { ...b, status: 'cancelled' } : b));
    } else if (action === 'update') {
      bookings = bookings.map((b) => (b.id === booking.id ? { ...b, ...booking } : b));
    } else if (action === 'delete') {
      bookings = bookings.filter((b) => b.id !== booking.id);
    }

    await setBizField(bizId, ['appointments', 'bookings'], bookings);
    return NextResponse.json({ success: true, bookings });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
