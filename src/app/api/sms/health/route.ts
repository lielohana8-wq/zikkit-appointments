import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * SMS diagnostics — open /api/sms/health to see exactly why messages
 * do or don't go out. Detects the classic "sometimes works" causes:
 * Trial account (verified numbers only), empty balance, bad credentials.
 */
export async function GET() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_IL || process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    return NextResponse.json({
      ok: false,
      envPresent: { TWILIO_ACCOUNT_SID: !!sid, TWILIO_AUTH_TOKEN: !!token, TWILIO_PHONE: !!from },
      fix: 'משתני Twilio חסרים ב-Vercel (Production) — הוסף ועשה Redeploy.',
    });
  }
  const auth = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
  try {
    const [accRes, balRes] = await Promise.all([
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: auth } }),
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, { headers: { Authorization: auth } }),
    ]);
    if (!accRes.ok) {
      return NextResponse.json({ ok: false, fix: accRes.status === 401 ? 'SID/Auth Token לא תקינים — בדוק העתקה מ-console.twilio.com' : 'שגיאת Twilio ' + accRes.status });
    }
    const acc = await accRes.json() as { type?: string; status?: string };
    const bal = balRes.ok ? await balRes.json() as { balance?: string; currency?: string } : {};
    const isTrial = acc.type === 'Trial';
    const balance = parseFloat(bal.balance || '0');
    const warnings: string[] = [];
    if (isTrial) warnings.push('⚠️ חשבון Trial — SMS יוצאים רק למספרים שאומתו ידנית בקונסולה! זה בדיוק "פעם שולח פעם לא". פתרון: Upgrade בחשבון Twilio (Billing).');
    if (balance < 1) warnings.push(`⚠️ יתרה נמוכה: ${bal.balance} ${bal.currency || 'USD'} — הודעות ייכשלו כשתיגמר. טען + הפעל Auto-recharge.`);
    return NextResponse.json({
      ok: warnings.length === 0,
      accountType: acc.type, accountStatus: acc.status,
      balance: `${bal.balance || '?'} ${bal.currency || 'USD'}`,
      from,
      warnings: warnings.length ? warnings : undefined,
      message: warnings.length ? undefined : 'Twilio חי, משודרג ועם יתרה ✅ — אם הודעה ספציפית לא הגיעה, בדוק Monitor → Logs → Messaging בקונסולה של Twilio (שם רואים כל ניסיון + קוד שגיאה).',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, fix: 'שגיאת רשת מול Twilio', detail: (e as Error).message });
  }
}
