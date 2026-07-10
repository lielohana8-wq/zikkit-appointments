import { NextRequest, NextResponse } from 'next/server';
import { getBiz } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

// Push diagnostics: are the keys on the server, and who is subscribed?
export async function GET(req: NextRequest) {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const priv = process.env.VAPID_PRIVATE_KEY || '';
  const bizId = req.nextUrl.searchParams.get('bizId') || '';
  let subscribers: string[] = [];
  if (bizId) {
    const biz = await getBiz(bizId);
    subscribers = Object.keys(((biz?.pushSubs as Record<string, unknown>) || {})).map((k) => '•••' + k.slice(-4));
  }
  return NextResponse.json({
    publicKey: pub ? `מוגדר (${pub.length} תווים)` : '❌ חסר — NEXT_PUBLIC_VAPID_PUBLIC_KEY',
    privateKey: priv ? `מוגדר (${priv.length} תווים)` : '❌ חסר — VAPID_PRIVATE_KEY',
    subscribers,
    subscribersCount: subscribers.length,
    note: subscribers.length === 0 ? 'אף מכשיר לא נרשם עדיין — פתחו את הדשבורד/האפליקציה במכשיר אחרי הדיפלוי ואשרו התראות. באייפון: רק מהאפליקציה שנשמרה למסך הבית (iOS 16.4+).' : 'יש נרשמים — אם פוש לא מגיע, בדקו ביומן ההודעות את שורות ה-push.',
  });
}
