import { NextRequest, NextResponse } from 'next/server';
import { hqAuth } from '@/lib/hq-auth';

/**
 * GET /api/hq/system?email=..
 * Reports which integrations are CONFIGURED (env keys present) — never the
 * values. Lets the owner see platform health at a glance and know what still
 * needs wiring in Vercel.
 */
export async function GET(req: NextRequest) {
  const denied = hqAuth(req);
  if (denied) return denied;

  const has = (k: string) => Boolean(process.env[k] && String(process.env[k]).length > 3);

  const services = [
    { key: 'service_account', label: 'Firebase Service Account', configured: has('FIREBASE_SERVICE_ACCOUNT_KEY'), critical: true, note: 'ליבת המערכת — דף הזמנות, תשלומים, HQ' },
    { key: 'grow', label: 'Grow (תשלומים)', configured: has('GROW_API_KEY') && has('GROW_PAGE_CODE'), critical: false, note: 'מנויים ומקדמות' },
    { key: 'anthropic', label: 'Anthropic (AI)', configured: has('ANTHROPIC_API_KEY'), critical: false, note: 'דנה + כלי AI' },
    { key: 'twilio', label: 'Twilio (SMS)', configured: has('TWILIO_ACCOUNT_SID') && has('TWILIO_AUTH_TOKEN'), critical: false, note: 'תזכורות SMS (אופציונלי — יש וואטסאפ)' },
    { key: 'elevenlabs', label: 'ElevenLabs (קול דנה)', configured: has('ELEVENLABS_API_KEY'), critical: false, note: 'המענה הקולי של דנה' },
    { key: 'resend', label: 'Resend (מיילים)', configured: has('RESEND_API_KEY'), critical: false, note: 'התראות לידים במייל' },
  ];

  const env = process.env.GROW_ENV === 'production' ? 'production' : 'sandbox';

  return NextResponse.json({
    services,
    growEnv: env,
    ownerEmails: (process.env.HQ_OWNER_EMAILS || 'ohanaliel@gmail.com'),
    timestamp: new Date().toISOString(),
  });
}
