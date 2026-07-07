import { NextRequest, NextResponse } from 'next/server';
import { getBiz } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

/** Public landing-page content for /site/[bizId]. */
export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId') || '';
  if (!bizId) return NextResponse.json({ error: 'missing bizId' }, { status: 400 });
  const biz = await getBiz(bizId);
  if (!biz) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const landing = (biz.landing as Record<string, unknown>) || null;
  if (!landing) return NextResponse.json({ error: 'no landing page yet' }, { status: 404 });
  const booking = (biz.booking as Record<string, unknown>) || {};
  const cfg = (biz.cfg as Record<string, unknown>) || {};
  return NextResponse.json({
    landing,
    bizName: (cfg.biz_name as string) || (landing.businessName as string) || '',
    logo: (booking.logo as string) || '',
    accent: (booking.accentColor as string) || (landing.colorTheme as string) || '#7C3AED',
    phone: (booking.phone as string) || (landing.contactPhone as string) || '',
  });
}
