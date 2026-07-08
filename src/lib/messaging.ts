/**
 * Central messaging layer — WhatsApp-first, provider-optional.
 *
 * The core product must run with ZERO external providers. Instead of the
 * system *sending* messages (which needs a paid SMS/WhatsApp gateway), it
 * prepares ready-to-send WhatsApp messages the owner opens with one tap
 * (wa.me links) — free, works on every phone, no signup.
 *
 * When Twilio (or another gateway) is later configured, server routes can
 * additionally auto-send; this file is the single source of truth for phone
 * normalization and message copy so both paths stay consistent.
 */

/** Normalize an Israeli phone to international digits for wa.me (972XXXXXXXXX). */
export function normalizePhoneIL(raw: string): string {
  if (!raw) return '';
  let p = raw.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) return p.slice(1);
  if (p.startsWith('972')) return p;
  if (p.startsWith('0')) return '972' + p.slice(1);
  // Bare mobile without leading 0 (e.g. 5X…)
  if (p.length === 9 && p.startsWith('5')) return '972' + p;
  return p;
}

/** Build a wa.me link that opens WhatsApp with a pre-filled message. */
export function waLink(phone: string, message: string): string {
  const num = normalizePhoneIL(phone);
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

/** Share-to-anyone WhatsApp link (no specific recipient). */
export function waShare(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export interface BookingMsgCtx {
  bizName: string;
  customerName?: string;
  service?: string;
  date: string;
  time: string;
  manageUrl?: string;   // self-service cancel/reschedule link
  address?: string;
}

/** Message templates — the single source of truth for copy (Hebrew). */
export const messageTemplates = {
  confirmation(c: BookingMsgCtx): string {
    const lines = [
      `שלום${c.customerName ? ' ' + c.customerName : ''}! 🎉`,
      `התור שלך ב${c.bizName} נקבע:`,
      ``,
      `📅 ${c.date} בשעה ${c.time}`,
      c.service ? `💇 ${c.service}` : '',
      c.address ? `📍 ${c.address}` : '',
      c.manageUrl ? `\nלביטול או שינוי:\n${c.manageUrl}` : '',
      ``,
      `נתראה! 😊`,
    ];
    return lines.filter((l) => l !== '').join('\n');
  },

  reminder(c: BookingMsgCtx): string {
    return [
      `שלום${c.customerName ? ' ' + c.customerName : ''}! ⏰`,
      `תזכורת לתור שלך מחר ב${c.bizName}:`,
      ``,
      `📅 ${c.date} בשעה ${c.time}`,
      c.service ? `💇 ${c.service}` : '',
      c.manageUrl ? `\nלא יכול/ה להגיע? ${c.manageUrl}` : '',
      ``,
      `נתראה! 😊`,
    ].filter((l) => l !== '').join('\n');
  },

  onTheWay(c: BookingMsgCtx): string {
    return `שלום${c.customerName ? ' ' + c.customerName : ''}! התור שלך ב${c.bizName} מתקרב (${c.time}). מחכים לך! 😊`;
  },

  thankYou(c: BookingMsgCtx): string {
    return [
      `תודה שבחרת ב${c.bizName}${c.customerName ? ', ' + c.customerName : ''}! 🙏`,
      `נשמח לשמוע איך היה — המשוב שלך חשוב לנו.`,
      `מקווים לראותך שוב בקרוב! 😊`,
    ].join('\n');
  },

  rebook(c: BookingMsgCtx): string {
    return `שלום${c.customerName ? ' ' + c.customerName : ''}! מזמן לא התראינו ב${c.bizName} 😊 רוצה לקבוע תור? נשמח לארח אותך שוב.`;
  },
};
