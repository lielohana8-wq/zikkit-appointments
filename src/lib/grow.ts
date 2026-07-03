/**
 * Grow (גרו, מבית Meshulam) payment integration — SERVER ONLY.
 *
 * Grow is an Israeli payment gateway (formerly/parent Meshulam) supporting
 * local credit cards, Bit, Apple/Google Pay, and invoicing. Redirect flow:
 * we create a hosted payment page, the customer pays on Grow's page, and Grow
 * calls our webhook to confirm. No card data touches our servers (PCI-safe).
 *
 * Required env (set in Vercel — the product runs without them; payment
 * features stay dormant until configured):
 *   GROW_PAGE_CODE   — your Grow page code (user/page id)
 *   GROW_API_KEY     — your Grow API key
 *   GROW_ENV         — 'production' | 'sandbox' (default sandbox)
 *
 * Docs: https://grow-il.readme.io/
 */

const GROW_ENDPOINTS = {
  sandbox: 'https://sandbox.meshulam.co.il/api/light/server/1.0',
  production: 'https://secure.meshulam.co.il/api/light/server/1.0',
};

export function isGrowConfigured(): boolean {
  return Boolean(process.env.GROW_API_KEY && process.env.GROW_PAGE_CODE);
}

function endpoint(): string {
  const env = process.env.GROW_ENV === 'production' ? 'production' : 'sandbox';
  return GROW_ENDPOINTS[env];
}

export interface CreatePaymentParams {
  amount: number;              // in ILS
  description: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  callbackUrl: string;         // server webhook Grow calls
  externalId: string;          // our reference (bookingId / subId)
}

export interface CreatePaymentResult {
  ok: boolean;
  url?: string;
  processId?: string;
  error?: string;
}

/** Create a hosted Grow payment page. Returns a URL to redirect the customer to. */
export async function createPaymentPage(params: CreatePaymentParams): Promise<CreatePaymentResult> {
  if (!isGrowConfigured()) return { ok: false, error: 'Grow not configured' };

  const body = new URLSearchParams({
    pageCode: process.env.GROW_PAGE_CODE as string,
    apiKey: process.env.GROW_API_KEY as string,
    sum: String(params.amount),
    description: params.description,
    pageField: JSON.stringify({ fullName: params.customerName || '', phone: params.customerPhone || '', email: params.customerEmail || '' }),
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
    notifyUrl: params.callbackUrl,
    cField1: params.externalId,
  });

  try {
    const res = await fetch(`${endpoint()}/createPaymentProcess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    if (data?.status === 1 && data?.data?.url) {
      return { ok: true, url: data.data.url, processId: data.data.processId };
    }
    return { ok: false, error: data?.err?.message || data?.message || 'payment page creation failed' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Re-verify a transaction after the webhook (never trust the raw callback). */
export async function verifyTransaction(processId: string, processToken: string): Promise<{ ok: boolean; paid: boolean; error?: string }> {
  if (!isGrowConfigured()) return { ok: false, paid: false, error: 'not configured' };
  const body = new URLSearchParams({
    pageCode: process.env.GROW_PAGE_CODE as string,
    apiKey: process.env.GROW_API_KEY as string,
    processId,
    processToken,
  });
  try {
    const res = await fetch(`${endpoint()}/approveTransaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    const paid = data?.status === 1 && (data?.data?.statusCode === '2' || data?.data?.transactionTypeId);
    return { ok: data?.status === 1, paid: Boolean(paid) };
  } catch (e) {
    return { ok: false, paid: false, error: (e as Error).message };
  }
}
