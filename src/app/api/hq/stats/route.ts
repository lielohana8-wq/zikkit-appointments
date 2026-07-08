import { NextRequest, NextResponse } from 'next/server';
import { listAllBiz } from '@/lib/firestore-admin';
import { hqAuth } from '@/lib/hq-auth';

/**
 * GET /api/hq/stats?email=..
 * Aggregates all businesses into platform-level metrics for the HQ Overview
 * and Revenue tabs. Owner-only.
 */
const PLAN_PRICE: Record<string, number> = { base: 149, dana: 349 };

export async function GET(req: NextRequest) {
  const denied = hqAuth(req);
  if (denied) return denied;

  try {
    const all = await listAllBiz();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    let totalBookings = 0;
    let payingCount = 0;
    let mrr = 0;
    let active7 = 0;
    let active30 = 0;
    const planBreakdown: Record<string, number> = { base: 0, dana: 0, none: 0 };
    const recentPayments: Array<{ biz: string; type: string; paidAt: string }> = [];
    const growthByMonth: Record<string, number> = {};

    for (const { data } of all) {
      const cfg = (data.cfg as Record<string, unknown>) || {};
      const appointments = (data.appointments as Record<string, unknown>) || {};
      const bookings = (appointments.bookings as Array<Record<string, unknown>>) || [];
      const sub = (data.subscription as Record<string, unknown>) || {};
      const payments = ((data.payments as Record<string, unknown>)?.items as Array<Record<string, unknown>>) || [];

      totalBookings += bookings.length;

      // Subscription / MRR
      const plan = sub.status === 'active' ? String(sub.plan || '') : '';
      if (plan && PLAN_PRICE[plan]) {
        payingCount += 1;
        mrr += PLAN_PRICE[plan];
        planBreakdown[plan] = (planBreakdown[plan] || 0) + 1;
      } else {
        planBreakdown.none += 1;
      }

      // Activity — most recent booking's createdAt
      const lastActivity = bookings
        .map((b) => new Date(String(b.createdAt || 0)).getTime())
        .reduce((mx, t) => Math.max(mx, t), 0);
      if (lastActivity && now - lastActivity < 7 * day) active7 += 1;
      if (lastActivity && now - lastActivity < 30 * day) active30 += 1;

      // Growth by signup month (from cfg.createdAt or earliest booking)
      const created = String(cfg.createdAt || '');
      if (created) {
        const m = created.slice(0, 7);
        growthByMonth[m] = (growthByMonth[m] || 0) + 1;
      }

      // Recent payments
      for (const p of payments.slice(0, 3)) {
        recentPayments.push({ biz: String(cfg.biz_name || 'עסק'), type: String(p.type || 'payment'), paidAt: String(p.paidAt || '') });
      }
    }

    recentPayments.sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));

    return NextResponse.json({
      totalBusinesses: all.length,
      active7, active30,
      payingCount,
      mrr,
      totalBookings,
      planBreakdown,
      growthByMonth,
      recentPayments: recentPayments.slice(0, 10),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
