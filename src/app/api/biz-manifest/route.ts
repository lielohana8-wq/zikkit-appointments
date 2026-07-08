import { NextRequest, NextResponse } from 'next/server';
import { getBiz } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

/**
 * Per-business PWA manifest — when a customer installs the booking page,
 * they get THE BUSINESS's name, logo and color on their home screen.
 * This is what turns a booking link into "the business's own app".
 */
export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId') || '';
  if (!bizId) return NextResponse.json({ error: 'missing bizId' }, { status: 400 });
  const biz = await getBiz(bizId);
  if (!biz) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const booking = (biz.booking as Record<string, unknown>) || {};
  const cfg = (biz.cfg as Record<string, unknown>) || {};
  const name = (booking.appName as string) || (cfg.biz_name as string) || 'הזמנת תור';
  const accent = (booking.accentColor as string) || '#7C3AED';
  const hasLogo = !!booking.logo;
  const iconUrl = hasLogo ? `/api/biz-icon?bizId=${bizId}` : '/icon-512.png';
  return NextResponse.json({
    name,
    short_name: name.slice(0, 12),
    start_url: `/book/${bizId}`,
    scope: `/book/${bizId}`,
    display: 'standalone',
    dir: 'rtl',
    lang: 'he',
    background_color: '#FBFAFF',
    theme_color: accent,
    icons: [
      { src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=300' } });
}
