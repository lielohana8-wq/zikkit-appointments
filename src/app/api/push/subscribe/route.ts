import { NextRequest, NextResponse } from 'next/server';
import { getBiz, setBizField } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

// Store a customer's web-push subscription, keyed by their phone (last 9 digits)
export async function POST(req: NextRequest) {
  try {
    const { bizId, phone, sub } = await req.json();
    const key = String(phone || '').replace(/\D/g, '').slice(-9);
    if (!bizId || key.length < 9 || !sub?.endpoint) return NextResponse.json({ ok: false }, { status: 400 });
    const bizDoc = await getBiz(bizId);
    const existingEntry = ((bizDoc?.pushSubs as Record<string, unknown>) || {})['p' + key];
    const arr = Array.isArray(existingEntry) ? [...existingEntry] : existingEntry ? [existingEntry] : [];
    const ep = (sub as { endpoint?: string })?.endpoint || '';
    const deduped = arr.filter((x) => ((x as { endpoint?: string })?.endpoint || '') !== ep);
    deduped.push(sub);
    await setBizField(bizId, ['pushSubs', 'p' + key], deduped.slice(-5));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
