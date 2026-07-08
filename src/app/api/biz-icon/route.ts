import { NextRequest, NextResponse } from 'next/server';
import { getBiz } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

/** Serves the business logo (stored as a data-URL) as a real image for the PWA icon. */
export async function GET(req: NextRequest) {
  const bizId = req.nextUrl.searchParams.get('bizId') || '';
  if (!bizId) return new NextResponse('missing bizId', { status: 400 });
  const biz = await getBiz(bizId);
  const logo = ((biz?.booking as Record<string, unknown>)?.logo as string) || '';
  const m = logo.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) {
    // Fallback: redirect to the Zikkit icon
    return NextResponse.redirect(new URL('/icon-512.png', req.nextUrl.origin));
  }
  const buf = Buffer.from(m[2], 'base64');
  return new NextResponse(buf, { headers: { 'Content-Type': m[1], 'Cache-Control': 'public, max-age=3600' } });
}
