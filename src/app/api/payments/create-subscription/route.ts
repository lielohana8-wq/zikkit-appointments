import { NextRequest, NextResponse } from 'next/server';
import { createPaymentPage, isGrowConfigured } from '@/lib/grow';
import { getBiz } from '@/lib/firestore-admin';

/**
 * POST /api/payments/create-subscription
 * Body: { bizId, plan: 'base' | 'dana', email }
 * Creates a payment page for the business's own subscription to Zikkit.
 */
const PLANS: Record<string, { amount: number; name: string }> = {
  base: { amount: 149, name: 'Zikkit Base — חודשי' },
  dana: { amount: 349, name: 'Zikkit + דנה — חודשי' },
};

export async function POST(req: NextRequest) {
  try {
    if (!isGrowConfigured()) {
      return NextResponse.json({ ok: false, error: 'תשלומים לא מוגדרים עדיין' }, { status: 503 });
    }
    const { bizId, plan, email } = await req.json();
    if (!bizId || !plan || !PLANS[plan]) return NextResponse.json({ ok: false, error: 'invalid plan' }, { status: 400 });

    const biz = await getBiz(bizId);
    if (!biz) return NextResponse.json({ ok: false, error: 'business not found' }, { status: 404 });

    const p = PLANS[plan];
    const origin = req.nextUrl.origin;
    const result = await createPaymentPage({
      amount: p.amount,
      description: p.name,
      customerEmail: email,
      successUrl: `${origin}/dashboard?sub=active`,
      cancelUrl: `${origin}/settings?sub=cancel`,
      callbackUrl: `${origin}/api/payments/webhook?bizId=${bizId}&type=subscription&plan=${plan}`,
      externalId: `sub_${bizId}_${plan}`,
    });

    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, url: result.url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
