import { NextRequest, NextResponse } from 'next/server';
import { getBiz, setBizField } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

/**
 * Twilio delivery-status webhook. Twilio calls this for every message we
 * send, telling us if it was ACTUALLY DELIVERED to the handset or filtered
 * by the carrier — the truth our "sent OK" status can't see.
 */
const CARRIER_ERRORS: Record<string, string> = {
  '30003': 'המכשיר כבוי/לא זמין',
  '30004': 'המספר חסום להודעות',
  '30005': 'מספר לא קיים',
  '30006': 'קו נייח — לא מקבל SMS',
  '30007': 'סונן ע"י המפעיל כספאם (לינק/תוכן) ⚠️',
  '30008': 'שגיאת מסירה לא ידועה אצל המפעיל',
  '30034': 'המספר השולח לא רשום למסירה במדינה זו ⚠️',
};

export async function POST(req: NextRequest) {
  try {
    const bizId = req.nextUrl.searchParams.get('bizId') || '';
    const form = await req.formData();
    const msgSid = String(form.get('MessageSid') || '');
    const status = String(form.get('MessageStatus') || '');
    const errCode = String(form.get('ErrorCode') || '');
    if (!bizId || !msgSid) return NextResponse.json({ ok: true });

    const biz = await getBiz(bizId);
    if (!biz) return NextResponse.json({ ok: true });
    const items = (((biz.smsLog as Record<string, unknown>)?.items as Array<Record<string, unknown>>) || []);
    let changed = false;
    const updated = items.map((e) => {
      if (e.sid !== msgSid) return e;
      changed = true;
      const label = status === 'delivered' ? '✓ נמסר למכשיר'
        : status === 'undelivered' || status === 'failed' ? `✗ לא נמסר${errCode ? ` — ${errCode}: ${CARRIER_ERRORS[errCode] || 'שגיאת מפעיל'}` : ''}`
        : status; // queued/sent — interim
      return { ...e, delivery: label, ok: status === 'undelivered' || status === 'failed' ? false : e.ok };
    });
    if (changed) await setBizField(bizId, ['smsLog', 'items'], updated);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // never make Twilio retry-storm us
  }
}
