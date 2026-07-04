/**
 * AI Growth Center engine — computes growth score, customer segments,
 * opportunities, weekly marketing plan and revenue predictions from the
 * business's real data (bookings, customers, services, reviews).
 *
 * Pure client-side functions over the single-doc data model (same pattern as
 * revenue-engine.ts). "Automations" run live on every page load — detection is
 * recomputed from fresh data, no background jobs required.
 */

import type { Booking, Customer, Service } from './bizdata';

// ---------- shared helpers ----------

const DAY = 24 * 60 * 60 * 1000;

function daysSince(dateStr?: string): number {
  if (!dateStr) return 9999;
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return 9999;
  return Math.floor((Date.now() - t) / DAY);
}

export function avgTicket(bookings: Booking[], services: Service[]): number {
  const priced = bookings.filter((b) => (b.price || 0) > 0);
  if (priced.length >= 5) return Math.round(priced.reduce((s, b) => s + (b.price || 0), 0) / priced.length);
  const svcPrices = services.map((s) => s.price).filter((p) => p > 0);
  if (svcPrices.length) return Math.round(svcPrices.reduce((a, b) => a + b, 0) / svcPrices.length);
  return 120;
}

function completedInWindow(bookings: Booking[], fromDaysAgo: number, toDaysAgo: number): Booking[] {
  return bookings.filter((b) => {
    if (b.status === 'cancelled') return false;
    const d = daysSince(b.date);
    return d >= toDaysAgo && d < fromDaysAgo;
  });
}

// ---------- 1. Growth Score ----------

export interface SubScore { key: string; label: string; icon: string; score: number; hint: string }
export interface GrowthScore { total: number; subs: SubScore[] }

export function calculateGrowthScore(
  bookings: Booking[], customers: Customer[], services: Service[],
  reviewCount: number, campaignsLast30: number,
): GrowthScore {
  const withVisit = customers.filter((c) => c.visits > 0);

  // Retention: share of visiting customers who came back at least twice
  const returning = withVisit.filter((c) => c.visits >= 2).length;
  const retention = withVisit.length ? Math.round((returning / withVisit.length) * 100) : 0;

  // Marketing activity: campaigns sent in last 30 days (4+ = full score)
  const marketing = Math.min(100, Math.round((campaignsLast30 / 4) * 100));

  // Revenue growth: last 30d vs previous 30d
  const avg = avgTicket(bookings, services);
  const rev = (bs: Booking[]) => bs.reduce((s, b) => s + (b.price || avg), 0);
  const cur = rev(completedInWindow(bookings, 30, 0));
  const prev = rev(completedInWindow(bookings, 60, 30));
  const growth = prev === 0 ? (cur > 0 ? 70 : 30) : Math.max(0, Math.min(100, Math.round(50 + ((cur - prev) / prev) * 100)));

  // Reviews: relative to loyal customers (visits>=3)
  const loyal = customers.filter((c) => c.visits >= 3).length;
  const reviews = loyal === 0 ? (reviewCount > 0 ? 80 : 40) : Math.min(100, Math.round((reviewCount / Math.max(1, loyal)) * 100));

  // Return rate: customers active in last 60 days out of all visiting customers
  const active = withVisit.filter((c) => daysSince(c.lastVisit) <= 60).length;
  const returnRate = withVisit.length ? Math.round((active / withVisit.length) * 100) : 0;

  const subs: SubScore[] = [
    { key: 'retention', label: 'שימור לקוחות', icon: '🔁', score: retention, hint: 'כמה מהלקוחות חוזרים לביקור שני' },
    { key: 'marketing', label: 'פעילות שיווקית', icon: '📣', score: marketing, hint: 'קמפיינים שנשלחו ב-30 הימים האחרונים' },
    { key: 'growth', label: 'צמיחת הכנסות', icon: '📈', score: growth, hint: 'החודש מול החודש הקודם' },
    { key: 'reviews', label: 'ביקורות', icon: '⭐', score: reviews, hint: 'ביקורות ביחס ללקוחות הנאמנים' },
    { key: 'return', label: 'קצב חזרה', icon: '💜', score: returnRate, hint: 'לקוחות פעילים ב-60 הימים האחרונים' },
  ];
  const total = Math.round(subs.reduce((s, x) => s + x.score, 0) / subs.length);
  return { total, subs };
}

// ---------- 2. Opportunities ----------

export interface Opportunity {
  id: string; icon: string; title: string; body: string;
  potential?: number; action: string; segmentId?: string;
}

export function generateGrowthInsights(
  bookings: Booking[], customers: Customer[], services: Service[], reviewCount: number,
): Opportunity[] {
  const avg = avgTicket(bookings, services);
  const ops: Opportunity[] = [];

  // Inactive customers (60d+)
  const inactive = customers.filter((c) => c.visits > 0 && daysSince(c.lastVisit) >= 60);
  if (inactive.length) {
    ops.push({
      id: 'inactive', icon: '🎯',
      title: `${inactive.length} לקוחות לא חזרו מעל 60 יום`,
      body: 'לקוחות שכבר הכירו אותך — הכי קל להחזיר אותם עם הודעה אישית.',
      potential: inactive.length * avg, action: 'שלח קמפיין החזרה', segmentId: 'inactive',
    });
  }

  // Underbooked weekday (based on last 60 days of bookings)
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  completedInWindow(bookings, 60, 0).forEach((b) => { const d = new Date(b.date).getDay(); if (!isNaN(d)) counts[d]++; });
  const workdays = [0, 1, 2, 3, 4].map((i) => ({ i, n: counts[i] }));
  const total = workdays.reduce((s, x) => s + x.n, 0);
  if (total >= 10) {
    const weakest = workdays.sort((a, b) => a.n - b.n)[0];
    ops.push({
      id: 'weekday', icon: '📅',
      title: `יום ${dayNames[weakest.i]} חלש אצלך ביומן`,
      body: `רק ${weakest.n} תורים ביום ${dayNames[weakest.i]} בחודשיים האחרונים. מבצע ממוקד ימלא אותו.`,
      action: `צור מבצע ליום ${dayNames[weakest.i]}`, segmentId: 'all-active',
    });
  }

  // Service pairing (customers who bought A also bought B)
  if (services.length >= 2) {
    const byCust = new Map<string, Set<string>>();
    bookings.forEach((b) => {
      if (!b.customerPhone || !b.service) return;
      if (!byCust.has(b.customerPhone)) byCust.set(b.customerPhone, new Set());
      byCust.get(b.customerPhone)!.add(b.service);
    });
    let best: { a: string; b: string; n: number } | null = null;
    const svcNames = services.map((s) => s.name);
    for (let i = 0; i < svcNames.length; i++) for (let j = 0; j < svcNames.length; j++) {
      if (i === j) continue;
      let n = 0;
      byCust.forEach((set) => { if (set.has(svcNames[i]) && set.has(svcNames[j])) n++; });
      if (n >= 3 && (!best || n > best.n)) best = { a: svcNames[i], b: svcNames[j], n };
    }
    if (best) {
      ops.push({
        id: 'bundle', icon: '🎁',
        title: `לקוחות של "${best.a}" קונים גם "${best.b}"`,
        body: `${best.n} לקוחות כבר משלבים. חבילה משולבת במחיר מיוחד תגדיל את שווי התור.`,
        action: 'צור חבילה משולבת',
      });
    }
  }

  // Review opportunities: loyal customers vs existing reviews
  const loyal = customers.filter((c) => c.visits >= 3);
  const missing = Math.max(0, loyal.length - reviewCount);
  if (missing >= 3) {
    ops.push({
      id: 'reviews', icon: '⭐',
      title: `${missing} לקוחות מרוצים שעוד לא השאירו ביקורת`,
      body: 'לקוחות עם 3+ ביקורים אוהבים אותך — ביקורת שלהם שווה זהב לעסק.',
      action: 'בקש ביקורות', segmentId: 'loyal',
    });
  }

  return ops;
}

// ---------- 3. Weekly plan / marketing manager ----------

export interface PlanItem { day: string; icon: string; title: string; desc: string }
export interface MorningBrief { tasks: string[]; potential: number }

export function generateMarketingRecommendations(ops: Opportunity[], segments: Segment[]): { calendar: PlanItem[]; brief: MorningBrief } {
  const inactive = segments.find((s) => s.id === 'inactive');
  const calendar: PlanItem[] = [
    { day: 'ראשון', icon: '⭐', title: 'בקש ביקורות', desc: 'שלח ל-3 לקוחות מרוצים בקשה קצרה לביקורת בגוגל' },
    { day: 'שני', icon: '🎯', title: 'החזר לקוחות', desc: 'הודעת "התגעגענו" ללקוחות שלא חזרו — עם הטבה קטנה' },
    { day: 'שלישי', icon: '📅', title: 'מלא חורים', desc: 'מבצע בזק לשעות הפנויות של השבוע' },
    { day: 'רביעי', icon: '📸', title: 'פוסט לפני/אחרי', desc: 'העבודה הכי טובה של השבוע — לאינסטגרם ולסטורי' },
    { day: 'חמישי', icon: '💜', title: 'פנק לקוח קבוע', desc: 'הודעת תודה אישית ללקוח VIP — נאמנות בונים בקטנה' },
  ];
  const tasks: string[] = [];
  let potential = 0;
  if (inactive && inactive.customers.length) {
    const n = Math.min(12, inactive.customers.length);
    tasks.push(`צור קשר עם ${n} לקוחות שלא חזרו`);
    potential += Math.round(inactive.customers.length * (inactive.avg || 120) * 0.3);
  }
  tasks.push('פרסם פוסט לפני/אחרי מהעבודה של השבוע');
  const weekday = ops.find((o) => o.id === 'weekday');
  if (weekday) { tasks.push(weekday.action); potential += 400; }
  else tasks.push('שלח תזכורת ללקוחות עם תור השבוע');
  return { calendar, brief: { tasks: tasks.slice(0, 3), potential } };
}

// ---------- 4. Segments ----------

export interface Segment {
  id: string; label: string; icon: string; desc: string;
  customers: Customer[]; revenue: number; avg: number;
}

export function generateCustomerSegments(customers: Customer[], bookings: Booking[], services: Service[]): Segment[] {
  const avg = avgTicket(bookings, services);
  const upcoming = new Set(
    bookings.filter((b) => b.status !== 'cancelled' && daysSince(b.date) < 0 && daysSince(b.date) > -8).map((b) => b.customerPhone),
  );
  const spendSorted = [...customers].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
  const highValueCut = spendSorted.length ? (spendSorted[Math.floor(spendSorted.length * 0.2)]?.totalSpent || 0) : 0;

  const mk = (id: string, label: string, icon: string, desc: string, list: Customer[]): Segment => ({
    id, label, icon, desc, customers: list,
    revenue: list.reduce((s, c) => s + (c.totalSpent || 0), 0), avg,
  });

  return [
    mk('vip', 'לקוחות VIP', '👑', '8+ ביקורים או מסומנים VIP', customers.filter((c) => c.vip || c.visits >= 8)),
    mk('inactive', 'לקוחות שנעלמו', '🎯', 'לא ביקרו מעל 60 יום', customers.filter((c) => c.visits > 0 && daysSince(c.lastVisit) >= 60)),
    mk('new', 'לקוחות חדשים', '🌱', 'ביקור ראשון ב-30 הימים האחרונים', customers.filter((c) => c.visits <= 1 && daysSince(c.createdAt) <= 30)),
    mk('at-risk', 'בסיכון נטישה', '⚠️', 'לקוחות קבועים שמאחרים לחזור (30-60 יום)', customers.filter((c) => c.visits >= 3 && daysSince(c.lastVisit) >= 30 && daysSince(c.lastVisit) < 60)),
    mk('high-value', 'ערך גבוה', '💎', '20% הלקוחות המכניסים ביותר', customers.filter((c) => (c.totalSpent || 0) >= highValueCut && (c.totalSpent || 0) > 0)),
    mk('loyal', 'נאמנים (3+ ביקורים)', '💜', 'הלקוחות שהכי אוהבים אותך', customers.filter((c) => c.visits >= 3)),
    mk('upcoming', 'תור בשבוע הקרוב', '📆', 'לקוחות עם תור עתידי קרוב', customers.filter((c) => upcoming.has(c.phone))),
  ];
}

// ---------- 5. Revenue predictions ----------

export interface Prediction { icon: string; title: string; amount: number; period: string; how: string }

export function generateRevenuePredictions(
  bookings: Booking[], customers: Customer[], services: Service[],
): Prediction[] {
  const avg = avgTicket(bookings, services);
  const inactive = customers.filter((c) => c.visits > 0 && daysSince(c.lastVisit) >= 60);
  const active = customers.filter((c) => c.visits > 0);
  const noShows30 = bookings.filter((b) => b.status === 'no_show' && daysSince(b.date) <= 30).length;
  const preds: Prediction[] = [];
  if (inactive.length) preds.push({
    icon: '🎯', title: 'אם תחזיר 30% מהלקוחות שנעלמו',
    amount: Math.round(inactive.length * 0.3) * avg, period: 'חד פעמי',
    how: `${inactive.length} לקוחות × 30% חזרה × ₪${avg} ממוצע`,
  });
  if (active.length) preds.push({
    icon: '🔁', title: 'אם קצב החזרה יעלה ב-10%',
    amount: Math.round(active.length * 0.1 * avg * 6), period: 'בשנה',
    how: `${active.length} לקוחות × 10% × ₪${avg} × ~6 ביקורים בשנה`,
  });
  if (noShows30 > 0) preds.push({
    icon: '🛡️', title: 'אם תמנע את הביטולים (מקדמות)',
    amount: noShows30 * avg, period: 'בחודש',
    how: `${noShows30} אי-הגעות בחודש האחרון × ₪${avg}`,
  });
  if (!preds.length) preds.push({
    icon: '🌱', title: 'התחל לאסוף נתונים',
    amount: 0, period: '',
    how: 'ככל שיהיו יותר תורים ולקוחות במערכת — התחזיות יהיו מדויקות יותר',
  });
  return preds;
}

// ---------- 6. Benchmarks (competitor insights) ----------

export interface Benchmark { icon: string; title: string; body: string; level: 'good' | 'warn' }

export function generateBenchmarks(
  services: Service[], bookings: Booking[], campaignsLast30: number, avg: number,
): Benchmark[] {
  const out: Benchmark[] = [];
  out.push(campaignsLast30 === 0
    ? { icon: '📣', title: 'לא שלחת קמפיין החודש', body: 'עסקים מובילים בתחום שלך שולחים 3-4 קמפיינים בחודש. קמפיין אחד בשבוע = יומן מלא יותר.', level: 'warn' }
    : { icon: '📣', title: `${campaignsLast30} קמפיינים החודש`, body: campaignsLast30 >= 3 ? 'קצב מצוין — אתה בין העסקים הפעילים בתחום.' : 'כיוון טוב! עסקים מובילים שולחים 3-4 בחודש.', level: campaignsLast30 >= 3 ? 'good' : 'warn' });
  out.push(services.length < 5
    ? { icon: '✂️', title: `יש לך ${services.length} שירותים`, body: 'עסקים מובילים מציעים 6-8 שירותים. עוד שירות = עוד סיבה לחזור ועוד הכנסה מכל לקוח.', level: 'warn' }
    : { icon: '✂️', title: `${services.length} שירותים במערכת`, body: 'תפריט שירותים רחב — בדיוק כמו העסקים המובילים.', level: 'good' });
  out.push(avg < 130
    ? { icon: '💰', title: `שווי תור ממוצע: ₪${avg}`, body: 'מתחת לממוצע בתחום (₪150-180). חבילות ושדרוגים יעלו את הממוצע בלי לקוחות חדשים.', level: 'warn' }
    : { icon: '💰', title: `שווי תור ממוצע: ₪${avg}`, body: 'שווי תור בריא — מעל או סביב ממוצע התחום.', level: 'good' });
  return out;
}

// ---------- 7. Campaign generator (template engine, works offline) ----------

export interface CampaignInput { goal: string; segmentLabel: string; tone: string; bizName: string; bookingUrl: string; offer?: string }
export interface CampaignOutput { headline: string; message: string; cta: string }

const OPENERS: Record<string, string[]> = {
  'חם ואישי': ['היי {name} 💜', 'היי {name}! התגעגענו 🥰', '{name} יקר/ה 💜'],
  'מקצועי': ['שלום {name},', '{name} שלום רב,'],
  'צעיר וקליל': ['יוו {name} 🔥', 'היי היי {name} ✌️'],
};

export function generateCampaign(inp: CampaignInput): CampaignOutput {
  const opener = (OPENERS[inp.tone] || OPENERS['חם ואישי'])[Math.floor(Math.random() * (OPENERS[inp.tone] || OPENERS['חם ואישי']).length)];
  const offer = inp.offer?.trim();
  const link = inp.bookingUrl;
  const G: Record<string, CampaignOutput> = {
    'החזרת לקוחות': {
      headline: 'התגעגענו אליך!',
      message: `${opener}\nעבר קצת זמן מאז הביקור האחרון שלך ב${inp.bizName} ואנחנו חושבים עליך!\n${offer ? `שריינו לך ${offer} לביקור הקרוב 🎁` : 'נשמח לראות אותך שוב 🎁'}\nקובעים תור בקליק: ${link}`,
      cta: 'קבע תור עכשיו',
    },
    'מילוי יומן השבוע': {
      headline: 'התפנו מקומות השבוע!',
      message: `${opener}\nהתפנו כמה שעות טובות השבוע ב${inp.bizName} ${offer ? `— ומי שתופס עכשיו מקבל ${offer} 🔥` : '— והן נחטפות מהר 🔥'}\nמי שקודם זוכה: ${link}`,
      cta: 'תפוס מקום',
    },
    'מבצע חג': {
      headline: 'מבצע חג מיוחד 🎉',
      message: `${opener}\nהחג מתקרב וב${inp.bizName} מתכוננים איתך!\n${offer ? `${offer} לתקופת החג בלבד 🎉` : 'הטבה מיוחדת לתקופת החג 🎉'}\nהמקומות לפני החג נגמרים מהר: ${link}`,
      cta: 'שריין לפני החג',
    },
    'בקשת ביקורות': {
      headline: 'הדעה שלך שווה לנו הכל ⭐',
      message: `${opener}\nהיה לנו כיף לארח אותך ב${inp.bizName}!\nביקורת קצרה ממך עוזרת לנו יותר ממה שנדמה 🙏\nלוקח 30 שניות ושווה לנו עולם ⭐`,
      cta: 'השאר ביקורת',
    },
    'לקוחות חדשים': {
      headline: 'מקום חדש להתפנק בו ✨',
      message: `${opener}\nעוד לא הכרת את ${inp.bizName}? הגיע הזמן!\n${offer ? `${offer} לביקור הראשון 💜` : 'הטבת היכרות מחכה לך 💜'}\nקובעים בקליק: ${link}`,
      cta: 'לביקור ראשון',
    },
  };
  return G[inp.goal] || G['החזרת לקוחות'];
}
