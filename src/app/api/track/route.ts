import { NextRequest, NextResponse } from 'next/server';
import { getBiz, setBizField } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

// Featherweight product telemetry: tiny counters on the biz doc.
// Events are whitelisted; the map stays small forever.
const EVENTS = new Set(['book_view', 'booked', 'a2hs', 'dashboard']);

export async function POST(req: NextRequest) {
  try {
    const { bizId, ev } = await req.json();
    if (!bizId || !EVENTS.has(String(ev))) return NextResponse.json({ ok: false }, { status: 400 });
    const biz = await getBiz(bizId);
    if (!biz) return NextResponse.json({ ok: false }, { status: 404 });
    const usage = ((biz.usage as Record<string, number>) || {});
    await setBizField(bizId, ['usage'], { ...usage, [String(ev)]: (Number(usage[String(ev)]) || 0) + 1, lastSeen: Date.now() });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
