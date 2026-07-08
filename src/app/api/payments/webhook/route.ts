import { NextRequest, NextResponse } from 'next/server';
import { verifyTransaction } from '@/lib/grow';
import { getBiz, setBizField } from '@/lib/firestore-admin';

/**
 * POST /api/payments/webhook?bizId=..&type=deposit|subscription&plan=..
 * Grow calls this after a payment. We re-verify the transaction (never
 * trust the raw callback), then record it in Firestore.
 */
export async function POST(req: NextRequest) {
  try {
    const bizId = req.nextUrl.searchParams.get('bizId') || '';
    const type = req.nextUrl.searchParams.get('type') || 'deposit';
    const plan = req.nextUrl.searchParams.get('plan') || '';

    // Grow posts form-encoded data
    let processId = '', processToken = '', externalId = '';
    const ctype = req.headers.get('content-type') || '';
    if (ctype.includes('application/json')) {
      const j = await req.json();
      processId = j.processId || j.data?.processId || '';
      processToken = j.processToken || j.data?.processToken || '';
      externalId = j.cField1 || j.data?.cField1 || '';
    } else {
      const form = await req.formData();
      processId = String(form.get('processId') || form.get('data[processId]') || '');
      processToken = String(form.get('processToken') || form.get('data[processToken]') || '');
      externalId = String(form.get('cField1') || form.get('data[cField1]') || '');
    }

    if (!bizId || !processId || !processToken) {
      return NextResponse.json({ ok: false, error: 'missing verification data' }, { status: 400 });
    }

    // Re-verify with Grow
    const verify = await verifyTransaction(processId, processToken);
    if (!verify.ok || !verify.paid) {
      return NextResponse.json({ ok: false, error: 'payment not verified' }, { status: 402 });
    }

    const biz = await getBiz(bizId);
    if (!biz) return NextResponse.json({ ok: false, error: 'business not found' }, { status: 404 });

    const record = {
      id: 'pay_' + Date.now(),
      type, plan: plan || null, processId, externalId,
      paidAt: new Date().toISOString(),
    };

    if (type === 'subscription') {
      // Activate/renew the subscription
      await setBizField(bizId, ['subscription'], {
        plan, status: 'active', lastPaymentAt: record.paidAt,
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    // Append to payments log
    const payments = ((biz.payments as Record<string, unknown>)?.items as unknown[]) || [];
    await setBizField(bizId, ['payments', 'items'], [record, ...payments].slice(0, 500));

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

// Grow may probe with GET
export async function GET() {
  return NextResponse.json({ ok: true, service: 'zikkit-payments-webhook' });
}
