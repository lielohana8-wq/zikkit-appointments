import { NextRequest, NextResponse } from 'next/server';
import { hqAuth } from '@/lib/hq-auth';
import { getBiz, setBizField } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

// Platform-level plan pricing, editable live from HQ (no deploy needed).
// Stored on a reserved doc id '_platform' in the same collection.
const DEFAULTS: Record<string, number> = { founder: 99, base: 149, dana: 349 };

export async function GET() {
  try {
    const doc = await getBiz('_platform');
    const stored = ((doc?.plans as Record<string, number>) || {});
    return NextResponse.json({ plans: { ...DEFAULTS, ...stored } });
  } catch {
    return NextResponse.json({ plans: DEFAULTS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const denied = hqAuth(req, body.email);
    if (denied) return denied;
    const plans: Record<string, number> = {};
    for (const k of Object.keys(DEFAULTS)) {
      const v = Number(body.plans?.[k]);
      if (Number.isFinite(v) && v >= 0 && v <= 5000) plans[k] = Math.round(v);
    }
    await setBizField('_platform', ['plans'], plans);
    return NextResponse.json({ ok: true, plans: { ...DEFAULTS, ...plans } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
