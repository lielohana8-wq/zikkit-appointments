import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Lightweight uptime/health probe for monitors (UptimeRobot, Vercel, etc).
 * Reports service configuration status without exposing any secrets.
 */
export async function GET() {
  const has = (k: string) => Boolean(process.env[k] && String(process.env[k]).length > 3);
  return NextResponse.json({
    status: 'ok',
    ts: new Date().toISOString(),
    services: {
      firestore: has('FIREBASE_SERVICE_ACCOUNT_KEY'),
      payments: has('GROW_API_KEY'),
      ai: has('ANTHROPIC_API_KEY'),
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
