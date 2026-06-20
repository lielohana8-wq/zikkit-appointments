import { NextRequest, NextResponse } from 'next/server';
import { getBiz, setBizField, sendSms } from '@/lib/firestore-admin';

/**
 * Public booking endpoint. Only active if the owner ENABLED their booking page.
 * GET  /api/public-booking?bizId=xxx                → business info + services + branding + bookings (if enabled)
 * POST /api/public-booking  {bizId, action:'book'}  → create a booking (if enabled)
 *
 * The owner controls this via the /booking-page settings (booking.enabled).
 * If not enabled, returns { enabled: false } and refuses bookings.
 */

export async function GET(req: NextRequest) {
  try {
    const bizId = req.nextUrl.searchParams.get('bizId');
    if (!bizId) return NextResponse.json({ error: 'missing bizId' }, { status: 400 });

    // Explicit check: is the service account configured at all?
    if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json({
        enabled: false,
        reason: 'no_service_account',
        error: 'חסר FIREBASE_SERVICE_ACCOUNT_KEY ב-Vercel. צריך להוסיף אותו כדי שדף ההזמנות יעבוד.',
      });
    }

    let biz;
    try {
      biz = await getBiz(bizId);
    } catch (e) {
      return NextResponse.json({
        enabled: false,
        reason: 'firestore_error',
        error: 'שגיאה בקריאה מ-Firestore: ' + (e as Error).message,
      });
    }
    if (!biz) {
      return NextResponse.json({
        enabled: false,
        reason: 'biz_not_found',
        error: 'העסק לא נמצא. ודא שה-bizId נכון ושנשמרו הגדרות.',
      });
    }

    const booking = (biz.booking as Record<string, unknown>) || {};
    // Owner must explicitly enable the page (default: enabled unless set to false)
    if (booking.enabled === false) {
      return NextResponse.json({ enabled: false, reason: 'disabled_by_owner' });
    }

    const cfg = (biz.cfg as Record<string, unknown>) || {};
    const dana = (biz.dana as Record<string, unknown>) || {};
    const apt = (biz.appointments as Record<string, unknown>) || {};
    const teamData = (biz.team as { members?: Array<Record<string, unknown>> }) || {};
    const reviewsData = (biz.reviews as { items?: Array<Record<string, unknown>> }) || {};

    // Only active staff, only public-safe fields
    const team = (teamData.members || [])
      .filter((m) => m.active !== false)
      .map((m) => ({ id: m.id, name: m.name, role: m.role || '', photo: m.photo || '', services: m.services || [] }));

    // Only published reviews, public-safe fields
    const reviews = (reviewsData.items || [])
      .filter((r) => r.published === true)
      .map((r) => ({ customerName: r.customerName, rating: r.rating, text: r.text, date: r.date }))
      .slice(0, 20);

    return NextResponse.json({
      enabled: true,
      businessName: cfg.biz_name || 'העסק',
      services: (dana.services as unknown[]) || [],
      stations: (apt.stations as number) || 1,
      team,
      reviews,
      hours: cfg.hours || null,
      bookings: ((apt.bookings as Array<Record<string, unknown>>) || [])
        .filter((b) => b.status !== 'cancelled')
        .map((b) => ({ date: b.date, time: b.time, duration: b.duration, staff: b.staff || null })), // include staff for per-staff availability
      branding: {
        logo: booking.logo || '',
        banner: booking.banner || '',
        brandColor: booking.brandColor || '#9333EA',
        headerStyle: booking.headerStyle || 'centered',
        welcomeText: booking.welcomeText || '',
        thankYouMessage: booking.thankYouMessage || '',
        cancellationNote: booking.cancellationNote || '',
        address: booking.address || '',
        phone: booking.phone || '',
        instagram: booking.instagram || '',
        whatsapp: booking.whatsapp || '',
        showPrices: booking.showPrices !== false,
        showDuration: booking.showDuration !== false,
        requireEmail: booking.requireEmail === true,
        requirePhone: booking.requirePhone !== false,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bizId, booking, action } = body;
    if (!bizId) return NextResponse.json({ error: 'missing data' }, { status: 400 });

    const biz = await getBiz(bizId);
    if (!biz) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 });

    // ---- Waitlist: customer wants to be notified if a slot opens ----
    if (action === 'waitlist') {
      const wl = body.waitlist || {};
      if (!wl.name || !wl.phone) return NextResponse.json({ error: 'missing name/phone' }, { status: 400 });
      const existing = ((biz.waitlist as Record<string, unknown>)?.items as unknown[]) || [];
      const entry = {
        id: 'wl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: wl.name, phone: wl.phone, service: wl.service || '', staff: wl.staff || '',
        preferredDate: wl.preferredDate || '', note: wl.note || '',
        status: 'waiting', createdAt: new Date().toISOString(),
      };
      await setBizField(bizId, ['waitlist', 'items'], [entry, ...existing].slice(0, 200));
      // Notify owner
      const ownerPhone = ((biz.cfg as Record<string, unknown>)?.owner_phone as string) || ((biz.booking as Record<string, unknown>)?.notifyPhone as string);
      if (ownerPhone) sendSms(ownerPhone, `רשימת המתנה: ${wl.name} (${wl.phone}) מחכה לתור${wl.service ? ' ל' + wl.service : ''}${wl.preferredDate ? ' · ' + wl.preferredDate : ''}`).catch(() => {});
      // In-app notification
      const notifications = ((biz.notifications as Record<string, unknown>)?.items as unknown[]) || [];
      await setBizField(bizId, ['notifications', 'items'], [{ id: 'notif_' + Date.now(), type: 'waitlist', text: `${wl.name} נרשם/ה לרשימת המתנה`, read: false, createdAt: new Date().toISOString() }, ...notifications].slice(0, 50));
      return NextResponse.json({ success: true, message: 'נרשמת לרשימת ההמתנה!' });
    }

    if (!booking) return NextResponse.json({ error: 'missing data' }, { status: 400 });
    const bookingCfg = (biz.booking as Record<string, unknown>) || {};
    if (bookingCfg.enabled === false) {
      return NextResponse.json({ success: false, error: 'הזמנות מקוונות אינן פעילות כרגע' }, { status: 403 });
    }

    const apt = (biz.appointments as Record<string, unknown>) || {};
    const existing = (apt.bookings as Array<Record<string, unknown>>) || [];
    const stations = (apt.stations as number) || 1;

    // Validate the slot is still free (prevent double-booking)
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
    const newStart = toMin(booking.time);
    const newEnd = newStart + (booking.duration || 30);
    const overlapping = existing.filter((b) => {
      if (b.date !== booking.date || b.status === 'cancelled') return false;
      const bStart = toMin(b.time as string);
      const bEnd = bStart + ((b.duration as number) || 30);
      return newStart < bEnd && newEnd > bStart;
    }).length;
    if (overlapping >= stations) {
      return NextResponse.json({ success: false, error: 'התור הזה כבר נתפס. בחר שעה אחרת.' }, { status: 409 });
    }

    const manageToken = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const newBooking = {
      id: 'apt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      source: 'online',
      customerName: booking.customerName || '',
      customerPhone: booking.customerPhone || '',
      service: booking.service || '',
      duration: booking.duration || 30,
      date: booking.date,
      time: booking.time,
      price: booking.price || 0,
      status: 'confirmed',
      reminded: false,
      isNew: true,
      manageToken,
      createdAt: new Date().toISOString(),
    };

    await setBizField(bizId, ['appointments', 'bookings'], [newBooking, ...existing]);

    // In-app notification (always works, no Twilio needed)
    const notifications = ((biz.notifications as Record<string, unknown>)?.items as unknown[]) || [];
    const newNotif = {
      id: 'notif_' + Date.now(),
      type: 'new_booking',
      text: `תור חדש: ${booking.customerName} · ${booking.service} · ${booking.date} ${booking.time}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    await setBizField(bizId, ['notifications', 'items'], [newNotif, ...notifications].slice(0, 50));

    // SMS confirmations
    const bizName = (biz.cfg as Record<string, unknown>)?.biz_name || 'העסק';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
    const manageUrl = `${baseUrl}/manage/${bizId}/${manageToken}`;
    if (booking.customerPhone) {
      sendSms(booking.customerPhone, `התור שלך ב${bizName} נקבע!\n${booking.date} בשעה ${booking.time}\n${booking.service}\n\nלביטול או שינוי:\n${manageUrl}\n\nנתראה!`).catch(() => {});
    }
    // Notify owner
    const ownerPhone = ((biz.cfg as Record<string, unknown>)?.owner_phone as string)
      || ((biz.booking as Record<string, unknown>)?.notifyPhone as string);
    if (ownerPhone) {
      sendSms(ownerPhone, `תור חדש אונליין! ${booking.customerName} · ${booking.service} · ${booking.date} ${booking.time}`).catch(() => {});
    }

    return NextResponse.json({ success: true, message: 'התור נקבע בהצלחה!', manageToken });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
