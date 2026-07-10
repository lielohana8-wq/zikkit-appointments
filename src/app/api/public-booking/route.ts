import { NextRequest, NextResponse } from 'next/server';
import { getBiz, setBizField, sendSms } from '@/lib/firestore-admin';
import { enforceRateLimit } from '@/lib/rate-limit';

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
      .map((m) => ({ id: m.id, name: m.name, role: m.role || '', photo: m.photo || '', services: m.services || [], hours: m.hours || null, blockedDates: (m.blockedDates as string[]) || [] }));

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
      hours: ((cfg.hours as { days?: unknown })?.days as never) || null,
      blockedDates: ((cfg.hours as Record<string, unknown>)?.blockedDates as string[]) || [],
      bookings: ((apt.bookings as Array<Record<string, unknown>>) || [])
        .filter((b) => b.status !== 'cancelled')
        .map((b) => ({ date: b.date, time: b.time, duration: b.duration, staff: b.staff || null, status: (b.status as string) || '' })), // include staff for per-staff availability
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
        slotInterval: (booking.slotInterval as number) || 15,
        staffCount: (teamData.members || []).filter((m) => m.active !== false).length,
        bookingWindowDays: (booking.bookingWindowDays as number) || 14,
        slotMode: booking.slotMode === 'packed' ? 'packed' : 'interval',
        requireRegistration: booking.requireRegistration !== false,
        benefitOn: booking.benefitOn === true,
        benefitText: (booking.benefitText as string) || '',
        benefitEvery: (booking.benefitEvery as number) || 10,
        iconV: (booking.appIconV as number) || 1,
        theme: (booking.theme as string) || 'dark',
        brandColor2: (booking.brandColor2 as string) || '',
        nameFont: (booking.nameFont as string) || 'serif',
        bandImageOn: booking.bandImageOn === true,
        peakOn: booking.peakOn === true,
        peakRules: (booking.peakRules as unknown[]) || [],
        approvalMode: booking.approvalMode === 'manual' ? 'manual' : 'auto',
        policyOn: booking.policyOn === true,
        policyText: booking.policyText || '',
        gallery: booking.gallery || [],
        products: (((biz.products as Record<string, unknown>)?.items as Array<Record<string, unknown>>) || []).filter((pr) => pr.active !== false).slice(0, 12),
        galleryTitle: booking.galleryTitle || 'העבודות שלנו',
        announcement: booking.announcement || '',
        announcementOn: booking.announcementOn === true,
        popupTitle: booking.popupTitle || '',
        popupText: booking.popupText || '',
        popupOn: booking.popupOn === true,
        promoText: booking.promoText || '',
        promoOn: booking.promoOn === true,
        aboutText: booking.aboutText || '',
        tiktok: booking.tiktok || '',
        facebook: booking.facebook || '',
        showReviews: booking.showReviews !== false,
        depositOn: booking.depositOn === true,
        depositAmount: booking.depositAmount || 0,
        depositPercent: booking.depositPercent || 0,
      },
    }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 15 booking attempts per IP per minute
    const limited = enforceRateLimit(req, 'public-booking-post', 15, 60_000);
    if (limited) return limited;

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
      if (ownerPhone) await sendSms(ownerPhone, `רשימת המתנה: ${wl.name} (${wl.phone}) מחכה לתור${wl.service ? ' ל' + wl.service : ''}${wl.preferredDate ? ' · ' + wl.preferredDate : ''}`, bizId).catch(() => {});
      // In-app notification
      const notifications = ((biz.notifications as Record<string, unknown>)?.items as unknown[]) || [];
      await setBizField(bizId, ['notifications', 'items'], [{ id: 'notif_' + Date.now(), type: 'waitlist', text: `${wl.name} נרשם/ה לרשימת המתנה`, read: false, createdAt: new Date().toISOString() }, ...notifications].slice(0, 50));
      return NextResponse.json({ success: true, message: 'נרשמת לרשימת ההמתנה!' });
    }

    // ---- Find my bookings: phone lookup so customers who lost the manage
    // link can still cancel/reschedule. Strictly rate-limited (enumeration guard). ----
    if (action === 'find') {
      const strict = enforceRateLimit(req, 'public-booking-find', 5, 60_000);
      if (strict) return strict;
      const raw = String(body.phone || '').replace(/\D/g, '');
      if (raw.length < 7) return NextResponse.json({ success: false, error: 'מספר טלפון לא תקין' }, { status: 400 });
      const key = raw.slice(-9); // Israeli numbers: compare the last 9 digits (05X / +9725X agnostic)
      const apt2 = (biz.appointments as Record<string, unknown>) || {};
      const all = (apt2.bookings as Array<Record<string, unknown>>) || [];
      const today = new Date().toISOString().split('T')[0];
      let changed = false;
      const matches = all.filter((b) => {
        const bp = String(b.customerPhone || '').replace(/\D/g, '').slice(-9);
        return bp && bp === key && b.status !== 'cancelled' && String(b.date || '') >= today;
      });
      // Manual bookings have no manage link — mint one on demand so every booking is manageable
      for (const m of matches) {
        if (!m.manageToken) { m.manageToken = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); changed = true; }
      }
      if (changed) await setBizField(bizId, ['appointments', 'bookings'], all);
      const custRec = ((((biz.customers as Record<string, unknown>)?.items as Array<Record<string, unknown>>) || [])).find((cu) => String(cu.phone || '').replace(/\D/g, '').slice(-9) === key);
      return NextResponse.json({
        success: true,
        visits: (custRec?.visits as number) || 0,
        bookings: matches
          .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time)))
          .slice(0, 5)
          .map((b) => ({ service: b.service || 'טיפול', date: b.date, time: b.time, token: b.manageToken })),
      });
    }

    // ---- Customer registration: joins the business's app (club) ----
    if (action === 'register') {
      const strict = enforceRateLimit(req, 'public-booking-register', 5, 60_000);
      if (strict) return strict;
      const name = String(body.name || '').trim();
      const rawPhone = String(body.phone || '').replace(/\D/g, '');
      if (!name || rawPhone.length < 9) return NextResponse.json({ success: false, error: 'שם וטלפון תקין נדרשים' }, { status: 400 });
      const key = rawPhone.slice(-9);
      const custWrap = (biz.customers as Record<string, unknown>) || {};
      const custs = (custWrap.items as Array<Record<string, unknown>>) || [];
      const exists = custs.find((cu) => String(cu.phone || '').replace(/\D/g, '').slice(-9) === key);
      if (!exists) {
        custs.unshift({ id: 'cust_' + Date.now(), name, phone: body.phone, visits: 0, totalSpent: 0, createdAt: new Date().toISOString(), source: 'app' });
        await setBizField(bizId, ['customers', 'items'], custs);
      }
      // Existing customer "registering" = logging in — return the name the business knows them by
      return NextResponse.json({ success: true, knownName: exists ? String(exists.name || name) : name });
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
    // Reject bookings in the past — the server clock is UTC, customers are in Israel
    const nowIL = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
    const todayIL = `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, '0')}-${String(nowIL.getDate()).padStart(2, '0')}`;
    if (String(booking.date) < todayIL || (String(booking.date) === todayIL && newStart <= nowIL.getHours() * 60 + nowIL.getMinutes())) {
      return NextResponse.json({ success: false, error: 'השעה שבחרת כבר עברה — רעננו את הדף ובחרו שעה חדשה 🙂' }, { status: 400 });
    }

    // Peak-hours surcharge — computed on the server, not trusted from the client
    const bookCfgP = (biz.booking as Record<string, unknown>) || {};
    const peakRulesArr = (bookCfgP.peakOn === true ? (bookCfgP.peakRules as Array<{ days?: number[]; from?: string; to?: string; extra?: number }>) : []) || [];
    const dowP = new Date(`${booking.date}T00:00:00`).getDay();
    const t2mP = (t: string) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
    const peakExtra = peakRulesArr.reduce((acc, r) => ((r.days || []).includes(dowP) && newStart >= t2mP(r.from || '00:00') && newStart < t2mP(r.to || '23:59') ? acc + (Number(r.extra) || 0) : acc), 0);

    const teamMembers = (((biz.team as Record<string, unknown>)?.members as Array<Record<string, unknown>>) || []).filter((m) => m.active !== false);
    const overlapsWith = (staffName: string | null) => existing.filter((b) => {
      if (b.date !== booking.date || b.status === 'cancelled') return false;
      if (staffName && b.staff !== staffName && !(b.status === 'blocked' && !b.staff)) return false; // per-barber check (general blocks hit everyone)
      const bStart = toMin(b.time as string);
      const bEnd = bStart + ((b.duration as number) || 30);
      return newStart < bEnd && newEnd > bStart;
    }).length;

    // Booking window: reject dates beyond what the business opened
    const winDays = (((biz.booking as Record<string, unknown>)?.bookingWindowDays as number) || 14);
    const maxDate = new Date(Date.now() + winDays * 86400000).toISOString().split('T')[0];
    if (String(booking.date) > maxDate) {
      return NextResponse.json({ success: false, error: `אפשר לקבוע עד ${winDays} ימים קדימה בלבד` }, { status: 400 });
    }

    // Same customer can't sit in two chairs at once: block an overlapping
    // booking with the SAME name + SAME phone. (Same phone with a different
    // name — e.g. a mom booking for her kid too — is allowed on purpose.)
    const custPhoneKey = String(booking.customerPhone || '').replace(/\D/g, '').slice(-9);
    const custNameKey = String(booking.customerName || '').trim();
    if (custPhoneKey) {
      const selfOverlap = existing.some((b) => {
        if (b.date !== booking.date || b.status === 'cancelled') return false;
        const bp = String(b.customerPhone || '').replace(/\D/g, '').slice(-9);
        if (bp !== custPhoneKey || String(b.customerName || '').trim() !== custNameKey) return false;
        const bs = toMin(b.time as string); const be = bs + ((b.duration as number) || 30);
        return newStart < be && newEnd > bs;
      });
      if (selfOverlap) {
        return NextResponse.json({ success: false, error: 'כבר יש לך תור אצלנו בשעה הזו 😊 אפשר לצפות בו ולנהל אותו דרך "כבר קבעתם תור?" בתחתית הדף.' }, { status: 409 });
      }
    }

    let assignedStaff: string | null = (booking.staff as string) || null;
    if (assignedStaff) {
      // A specific barber was chosen — they can hold exactly one booking at a time
      if (overlapsWith(assignedStaff) >= 1) {
        return NextResponse.json({ success: false, error: 'השעה הזו כבר נתפסה אצל איש הצוות. בחרו שעה אחרת.' }, { status: 409 });
      }
    } else {
      // No preference: capacity = team size (each barber = one chair), else stations
      const capacity = teamMembers.length > 0 ? teamMembers.length : stations;
      if (overlapsWith(null) >= capacity) {
        return NextResponse.json({ success: false, error: 'התור הזה כבר נתפס. בחר שעה אחרת.' }, { status: 409 });
      }
      // Auto-assign a free barber so the calendar always knows who takes it
      const free = teamMembers.find((m) => overlapsWith(String(m.name)) === 0 && !(((m.blockedDates as string[]) || []).includes(String(booking.date))));
      if (free) assignedStaff = String(free.name);
    }

    // Personal vacation day of the assigned member blocks only them
    if (assignedStaff) {
      const memRec = teamMembers.find((m) => String(m.name) === assignedStaff);
      if (memRec && ((memRec.blockedDates as string[]) || []).includes(String(booking.date))) {
        return NextResponse.json({ success: false, error: `${assignedStaff} לא זמין/ה בתאריך הזה — בחרו יום אחר או איש צוות אחר` }, { status: 409 });
      }
    }

    const manageToken = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const pageCfg = (biz.booking as Record<string, unknown>) || {};
    const needsApproval = pageCfg.approvalMode === 'manual';
    const newBooking = {
      id: 'apt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      source: 'online',
      customerName: booking.customerName || '',
      customerPhone: booking.customerPhone || '',
      service: booking.service || '',
      duration: booking.duration || 30,
      date: booking.date,
      time: booking.time,
      staff: assignedStaff,
      price: (Number(booking.price) || 0) + peakExtra,
      status: needsApproval ? 'pending' : 'confirmed',
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

    // SMS confirmations — skipped sends are logged too, so the SMS log
    // always answers "why didn't X get a message".
    const logSkip = async (reason: string) => {
      try {
        const fresh = await (await import('@/lib/firestore-admin')).getBiz(bizId);
        const log = (((fresh?.smsLog as Record<string, unknown>)?.items as unknown[]) || []);
        await setBizField(bizId, ['smsLog', 'items'], [{ at: new Date().toISOString(), to: '—', ok: false, err: reason, preview: '' }, ...log].slice(0, 30));
      } catch { /* never break booking */ }
    };
    const bizName = (biz.cfg as Record<string, unknown>)?.biz_name || 'העסק';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
    const manageUrl = `${baseUrl}/manage/${bizId}/${manageToken}`;
    if (!booking.customerPhone) await logSkip('אישור ללקוח דולג: הלקוח לא הזין טלפון');
    if (booking.customerPhone) {
      // No URL in the SMS on purpose: Israeli carriers filter link-bearing
      // messages from international senders. Managing is via the app.
      await sendSms(booking.customerPhone, needsApproval ? `הבקשה שלך ל${bizName} התקבלה ⏳ ${booking.date} בשעה ${booking.time}. נעדכן ברגע שיאושר.` : `התור שלך ב${bizName} אושר! ${booking.date} בשעה ${booking.time} · ${booking.service}. לשינוי/ביטול: דף ההזמנות של העסק. נתראה!`, bizId).catch(() => {});
    }
    // Notify owner
    const ownerPhone = ((biz.cfg as Record<string, unknown>)?.owner_phone as string)
      || ((biz.booking as Record<string, unknown>)?.notifyPhone as string);
    if (!ownerPhone) await logSkip('התראה לבעל העסק דולגה: לא הוגדר "הטלפון שלך להתראות" בהגדרות דף ההזמנות');
    if (ownerPhone) {
      await sendSms(ownerPhone, `תור חדש אונליין! ${booking.customerName} · ${booking.service} · ${booking.date} ${booking.time}${assignedStaff ? ' · אצל ' + assignedStaff : ''}`, bizId).catch(() => {});
    }
    if (assignedStaff) {
      const member = teamMembers.find((m) => String(m.name) === assignedStaff);
      const staffPhone = member && (member.phone as string);
      if (!staffPhone) await logSkip(`התראה לאיש הצוות ${assignedStaff} דולגה: לא הוגדר לו טלפון בכרטיס הצוות`);
      if (staffPhone) await sendSms(staffPhone, `תור חדש אצלך! ${booking.customerName} · ${booking.service} · ${booking.date} בשעה ${booking.time}`, bizId).catch(() => {});
    }

    return NextResponse.json({ success: true, message: 'התור נקבע בהצלחה!', manageToken });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
