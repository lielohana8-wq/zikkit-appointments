import type { Metadata } from 'next';
import { getBiz } from '@/lib/firestore-admin';

/**
 * Server-rendered identity for each business's app.
 * iOS/Android read the app NAME from the initial HTML — so it must be
 * born with the business's name, not injected later. This is what makes
 * "Add to Home Screen" say "מספרת דניאל" instead of "Zikkit".
 */
export async function generateMetadata({ params }: { params: { bizId: string } }): Promise<Metadata> {
  try {
    const biz = await getBiz(params.bizId);
    const booking = (biz?.booking as Record<string, unknown>) || {};
    const cfg = (biz?.cfg as Record<string, unknown>) || {};
    const name = (booking.appName as string) || (cfg.biz_name as string) || 'הזמנת תור';
    const v = (booking.appIconV as number) || 1;
    return {
      title: name,
      applicationName: name,
      manifest: `/api/biz-manifest?bizId=${params.bizId}&v=${v}`,
      appleWebApp: { capable: true, title: name, statusBarStyle: 'default' },
      icons: { apple: `/api/biz-icon?bizId=${params.bizId}&v=${v}` },
    };
  } catch {
    return { title: 'הזמנת תור' };
  }
}

export default function BookSegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
