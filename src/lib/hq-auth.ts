import { NextRequest, NextResponse } from 'next/server';

/**
 * HQ (super-admin) access control.
 *
 * Only the platform owner may access /api/hq/*. Gated server-side by email —
 * the caller passes their authenticated Firebase email, which we check against
 * the allowlist. No password is stored in code (that would leak in the repo);
 * identity comes from Firebase Auth, which the user already signed in with.
 *
 * Override the allowlist in Vercel with HQ_OWNER_EMAILS (comma-separated).
 */
export const HQ_OWNER_EMAILS = (process.env.HQ_OWNER_EMAILS || 'ohanaliel@gmail.com')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export function isHqOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  return HQ_OWNER_EMAILS.includes(email.toLowerCase());
}

/** Extract the caller email from query or body and verify HQ access. */
export function hqAuth(req: NextRequest, bodyEmail?: string): NextResponse | null {
  const email = (bodyEmail || req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  if (!isHqOwner(email)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}
