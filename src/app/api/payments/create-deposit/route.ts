import { NextRequest, NextResponse } from 'next/server';
import { createPaymentPage, isGrowConfigured } from '@/lib/grow';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getBiz } from '@/lib/firestore-admin';

/**
 * POST /api/payments/create-deposit
 * Body: { bizId, amount, description, customerName, customerPhone, customerEmail, bookingRef }
 * Returns a Grow hosted payment URL to redirect the customer to.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, 'create-deposit', 10, 60000);
    if (limited) return limited;
    if (!isGrowConfigured()) {
      return NextResponse.json({ ok: false, error: 'תשלומים לא מוגדרים עדיין' }, { status: 503 });
    }
    const body = await req.json();
    const { bizId, amount, description, customerName, customerPhone, customerEmail, bookingRef } = body;
    if (!bizId || !amount) return NextResponse.json({ ok: false, error: 'missing bizId or amount' }, { status: 400 });

    const biz = await getBiz(bizId);
    if (!biz) return NextResponse.json({ ok: false, error: 'business not found' }, { status: 404 });
    const bizName = ((biz.cfg as Record<string, unknown>)?.biz_name as string) || 'העסק';

    const origin = req.nextUrl.origin;
    const result = await createPaymentPage({
      amount: Number(amount),
      description: description || `מקדמה לתור ב${bizName}`,
      customerName, customerPhone, customerEmail,
      successUrl: `${origin}/book/${bizId}?paid=1`,
      cancelUrl: `${origin}/book/${bizId}?paid=0`,
      callbackUrl: `${origin}/api/payments/webhook?bizId=${bizId}&type=deposit`,
      externalId: bookingRef || `deposit_${Date.now()}`,
    });

    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, url: result.url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
