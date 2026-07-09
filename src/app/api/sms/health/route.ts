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
      // Show exactly what the server received - so "but they ARE correct"
      // becomes a 10-second comparison against the console.
      const peek = (v: string, keep: number) => v.slice(0, keep) + '…' + v.slice(-keep) + ' (' + v.length + ' תווים)';
      const sidIssue = sid !== sid.trim() ? '⚠️ יש רווח/שורה-חדשה בתוך ה-SID — מחק והדבק נקי'
        : sid.startsWith('SK') ? '⚠️ הדבקת API Key (SK...) במקום Account SID — צריך את ה-SID שמתחיל ב-AC מדף הבית של קונסולת Twilio'
        : !sid.startsWith('AC') ? '⚠️ ה-SID לא מתחיל ב-AC — זה לא Account SID'
        : sid.length !== 34 ? '⚠️ אורך SID חריג (' + sid.length + ' במקום 34)' : null;
      const tokIssue = token !== token.trim() ? '⚠️ יש רווח/שורה-חדשה בתוך ה-Auth Token — מחק והדבק נקי'
        : token.length !== 32 ? '⚠️ אורך Auth Token חריג (' + token.length + ' במקום 32)' : null;
      return NextResponse.json({
        ok: false,
        status: accRes.status,
        serverSees: { TWILIO_ACCOUNT_SID: peek(sid, 4), TWILIO_AUTH_TOKEN: token.slice(0, 2) + '…' + token.slice(-2) + ' (' + token.length + ' תווים)' },
        issues: [sidIssue, tokIssue].filter(Boolean),
        fix: accRes.status === 401
          ? ((sidIssue || tokIssue) ? 'תקן את מה שמסומן ב-issues, שמור ב-Vercel ועשה Redeploy'
            : 'הפורמט תקין אבל Twilio דוחה — כנראה ה-Auth Token סובב (Rotate) בקונסולה והישן מת. העתק את הטוקן הנוכחי מחדש מהקונסולה → הדבק ב-Vercel תחת Production → Redeploy.')
          : 'שגיאת Twilio ' + accRes.status,
      });
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
