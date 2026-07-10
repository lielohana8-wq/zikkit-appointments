import { NextRequest, NextResponse } from 'next/server';
import { setBizField } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

// Store a customer's web-push subscription, keyed by their phone (last 9 digits)
export async function POST(req: NextRequest) {
  try {
    const { bizId, phone, sub } = await req.json();
    const key = String(phone || '').replace(/\D/g, '').slice(-9);
    if (!bizId || key.length < 9 || !sub?.endpoint) return NextResponse.json({ ok: false }, { status: 400 });
    await setBizField(bizId, ['pushSubs', 'p' + key], sub);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
