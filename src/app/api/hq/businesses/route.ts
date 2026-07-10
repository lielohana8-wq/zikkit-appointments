import { NextRequest, NextResponse } from 'next/server';
import { listAllBiz, setBizField } from '@/lib/firestore-admin';
import { hqAuth } from '@/lib/hq-auth';

/**
 * GET   /api/hq/businesses?email=..            → list all businesses (summary)
 * PATCH /api/hq/businesses {email, bizId, action} → suspend | activate
 *   action: 'suspend' | 'activate' | 'setPlan'
 */
export async function GET(req: NextRequest) {
  const denied = hqAuth(req);
  if (denied) return denied;

  try {
    const all = await listAllBiz();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const businesses = all.map(({ id, data }) => {
      const cfg = (data.cfg as Record<string, unknown>) || {};
      const appointments = (data.appointments as Record<string, unknown>) || {};
      const bookings = (appointments.bookings as Array<Record<string, unknown>>) || [];
      const sub = (data.subscription as Record<string, unknown>) || {};
      const booking = (data.booking as Record<string, unknown>) || {};

      const lastActivity = bookings
        .map((b) => new Date(String(b.createdAt || 0)).getTime())
        .reduce((mx, t) => Math.max(mx, t), 0);

      const daysSinceActive = lastActivity ? Math.floor((now - lastActivity) / day) : null;

      // Pilot picture: activity, funnel, money, setup completeness
      const live = bookings.filter((b) => b.status !== 'cancelled');
      const todayStr = new Date(now).toISOString().split('T')[0];
      const monthStr = todayStr.slice(0, 7);
      const bookings7 = bookings.filter((b) => now - new Date(String(b.createdAt || 0)).getTime() < 7 * day).length;
      const upcoming = live.filter((b) => String(b.date || '') >= todayStr).length;
      const cancelledCount = bookings.filter((b) => b.status === 'cancelled').length;
      const revenueMonth = live.filter((b) => String(b.date || '').startsWith(monthStr)).reduce((acc, b) => acc + (Number(b.price) || 0), 0);
      const customersCount = (((data.customers as Record<string, unknown>)?.items as unknown[]) || []).length;
      const teamCount = (((data.team as Record<string, unknown>)?.members as Array<Record<string, unknown>>) || []).filter((m) => m.active !== false).length;
      const servicesCount = (((data.services as Record<string, unknown>)?.items as unknown[]) || []).length;
      const smsItems = (((data.smsLog as Record<string, unknown>)?.items as Array<Record<string, unknown>>) || []);
      const smsOk = smsItems.filter((e) => e.ok === true).length;
      const smsFail = smsItems.filter((e) => e.ok !== true).length;
      const galleryCount = ((booking.gallery as unknown[]) || []).length;

      return {
        bookings7, upcoming, cancelledCount, revenueMonth,
        customersCount, teamCount, servicesCount, smsOk, smsFail, galleryCount,
        hasLogo: !!booking.logo, hasBanner: !!booking.banner,
        otpOn: booking.otpOn === true, peakOn: booking.peakOn === true,
        theme: String(booking.theme || 'dark'),
        id,
        name: String(cfg.biz_name || 'ללא שם'),
        ownerEmail: String(cfg.owner_email || cfg.email || ''),
        createdAt: String(cfg.createdAt || ''),
        plan: sub.status === 'active' ? String(sub.plan || '') : '',
        subStatus: String(sub.status || 'trial'),
        bookingsCount: bookings.length,
        bookingEnabled: booking.enabled === true,
        suspended: data.suspended === true,
        lastActivity: lastActivity ? new Date(lastActivity).toISOString() : '',
        daysSinceActive,
        danaOn: Boolean((data.dana as Record<string, unknown>)?.phoneNumber),
      };
    });

    // Newest first
    businesses.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return NextResponse.json({ businesses });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, businesses: [] }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const denied = hqAuth(req, body.email);
    if (denied) return denied;

    const { bizId, action, plan } = body;
    if (!bizId || !action) return NextResponse.json({ error: 'missing bizId/action' }, { status: 400 });

    if (action === 'suspend') {
      await setBizField(bizId, ['suspended'], true);
    } else if (action === 'activate') {
      await setBizField(bizId, ['suspended'], false);
    } else if (action === 'setPlan') {
      await setBizField(bizId, ['subscription'], {
        plan: plan || 'base', status: 'active',
        lastPaymentAt: new Date().toISOString(),
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        grantedByAdmin: true,
      });
    } else {
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
