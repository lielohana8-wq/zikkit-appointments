import { NextResponse } from 'next/server';
import { listAllBiz } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Public, aggregate-only pilot scoreboard. No business names, no PII —
 * just the platform-wide proof that the system produces results.
 */
export async function GET() {
  try {
    let businesses = await listAllBiz();
    // Optional whitelist: STATS_INCLUDE_BIZ="id1,id2" → only these businesses
    // feed the public scoreboard (e.g. flagship pilot only). Empty = all.
    const include = (process.env.STATS_INCLUDE_BIZ || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (include.length > 0) businesses = businesses.filter((b) => include.includes(b.id));
    let bookingsTotal = 0, revenue = 0, customers = 0, views = 0, online = 0, manual = 0;
    for (const { data } of businesses) {
      const apt = (data.appointments as Record<string, unknown>) || {};
      const bks = ((apt.bookings as Array<Record<string, unknown>>) || []).filter((b) => b.status !== 'blocked' && b.source !== 'demo');
      const live = bks.filter((b) => b.status !== 'cancelled');
      bookingsTotal += live.length;
      revenue += live.reduce((t, b) => t + (Number(b.price) || 0), 0);
      online += live.filter((b) => b.source === 'online' || b.source === 'app').length;
      manual += live.filter((b) => b.source === 'manual').length;
      customers += (((data.customers as Record<string, unknown>)?.list as unknown[]) || []).length;
      views += Number(((data.usage as Record<string, number>) || {}).book_view) || 0;
    }
    const onlinePct = online + manual > 0 ? Math.round((online / (online + manual)) * 100) : null;
    return NextResponse.json(
      { businesses: businesses.length, bookings: bookingsTotal, revenue, customers, views, online, onlinePct, at: new Date().toISOString() },
      { headers: { ...CORS, 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } }
    );
  } catch {
    return NextResponse.json({ error: 'stats_unavailable' }, { status: 500, headers: CORS });
  }
}
