import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/dana/provision
 * Provisions Dana for an appointments business: saves config, gets phone, creates agent.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessName, services } = body;

    if (!businessName || !services || services.length === 0) {
      return NextResponse.json({ success: false, error: 'חסרים פרטים חיוניים' }, { status: 400 });
    }

    const bizId = req.headers.get('x-biz-id');
    const authHeader = req.headers.get('authorization');
    if (!bizId || !authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'לא מאומת. רענן את הדף.' }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    // Save config (best-effort via REST with user token)
    try {
      await saveConfig(bizId, body, idToken);
    } catch (e) {
      console.error('[Provision] save failed', e);
    }

    // Provision phone — report honestly whether a real number was bought
    let phoneNumber: string | null = null;
    let phoneStatus = 'provisioned';
    try {
      phoneNumber = await provisionTwilioNumber(bizId);
    } catch (e) {
      // Twilio purchase failed — do NOT silently use a private fallback number.
      console.error('[Provision] Twilio purchase failed:', e);
      phoneNumber = null;
      phoneStatus = 'pending'; // owner needs Twilio configured / number purchased
    }

    // Save config back (including mode: 'booking' | 'message')
    try {
      await saveConfig(bizId, { ...body, phoneNumber, phoneStatus, provisioned: true }, idToken);
    } catch (e) {
      console.error('[Provision] save failed:', e);
    }

    return NextResponse.json({
      success: true,
      phoneNumber,
      phoneStatus,
      note: phoneStatus === 'pending'
        ? 'הסוכן הוגדר, אבל מספר טלפון עדיין לא הוקצה. צריך להגדיר Twilio.'
        : undefined,
    });
  } catch (e) {
    console.error('[Provision]', e);
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}

async function saveConfig(bizId: string, config: Record<string, unknown>, idToken: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'zikkit-e87ff';
  // Use granular field paths so we never clobber existing data
  // (bookings, business hours, plan/trial, etc.).
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/appointment_businesses/${bizId}`
    + `?updateMask.fieldPaths=dana`
    + `&updateMask.fieldPaths=appointments.stations`
    + `&updateMask.fieldPaths=appointments.recurring`
    + `&updateMask.fieldPaths=appointments.recurringInterval`
    + `&updateMask.fieldPaths=cfg.biz_name`
    + `&updateMask.fieldPaths=cfg.owner_phone`
    + `&updateMask.fieldPaths=cfg.contact_name`;
  const danaCfg = {
    businessName: config.businessName,
    voiceId: config.voiceId,
    voiceName: config.voiceName,
    greeting: config.greeting,
    services: config.services,
    // mode: 'booking' = Dana books the appointment herself.
    //       'message' = Dana takes a message and you call the customer back.
    mode: config.danaMode || 'booking',
    phoneNumber: config.phoneNumber || null,
    phoneStatus: config.phoneStatus || 'pending',
    provisioned: config.provisioned || false,
    updatedAt: new Date().toISOString(),
  };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        dana: enc(danaCfg),
        appointments: { mapValue: { fields: {
          stations: enc(config.stations || 1),
          recurring: enc(config.recurring || false),
          recurringInterval: enc(config.recurringInterval || 3),
        } } },
        cfg: { mapValue: { fields: {
          biz_name: enc(config.businessName),
          owner_phone: enc(config.ownerPhone || ''),
          contact_name: enc(config.contactName || ''),
        } } },
      },
    }),
  });
  if (!res.ok) throw new Error('Firestore save failed: ' + (await res.text()));
}

async function provisionTwilioNumber(bizId: string): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) throw new Error('Twilio missing');

  const searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/IL/Mobile.json?Limit=1`;
  const searchRes = await fetch(searchUrl, { headers: { Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64') } });
  if (!searchRes.ok) throw new Error('Twilio search failed');
  const numbers = (await searchRes.json()).available_phone_numbers || [];
  if (numbers.length === 0) throw new Error('No numbers');
  const phoneNumber = numbers[0].phone_number;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://zikkit-appointments.vercel.app';
  const buyUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`;
  const buyRes = await fetch(buyUrl, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ PhoneNumber: phoneNumber, VoiceUrl: `${baseUrl}/api/voice/incoming?bizId=${bizId}`, FriendlyName: `ZikkitAppts - ${bizId}` }),
  });
  if (!buyRes.ok) throw new Error('Twilio purchase failed');
  return phoneNumber;
}

type FV = { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; nullValue?: null; arrayValue?: { values?: FV[] }; mapValue?: { fields?: Record<string, FV> } };
function enc(value: unknown): FV {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: value.toString() } : { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(enc) } };
  if (typeof value === 'object') {
    const fields: Record<string, FV> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) fields[k] = enc(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}
