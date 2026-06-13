'use client';

import { getFirestoreDb, doc, getDoc, setDoc, BIZ_COLLECTION } from '@/lib/firebase';

/**
 * Client-side data layer for ZikkitAppointments.
 * Writes directly to Firestore from the browser (uses the logged-in user's
 * auth — no service account needed). This is more reliable than the REST API
 * for in-app CRUD and works as long as Firestore rules allow the owner.
 */

export interface Booking {
  id: string;
  source: string;
  customerName: string;
  customerPhone: string;
  service: string;
  duration: number;
  date: string;
  time: string;
  staff?: string | null;
  station?: number | null;
  notes?: string;
  status: string;
  price?: number;
  reminded?: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  type: 'course' | 'package' | 'physical';
  name: string;
  description: string;
  price: number;
  contentUrl?: string;
  sessions?: number;
  active: boolean;
  sales: number;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  visits: number;
  lastVisit?: string;
  notes?: string;
  totalSpent: number;
  tags?: string[];        // e.g. "VIP", "חדש", "קבוע"
  vip?: boolean;
  birthday?: string;      // MM-DD
  createdAt: string;
}

export interface BizData {
  cfg?: Record<string, unknown>;
  dana?: Record<string, unknown>;
  appointments?: { bookings?: Booking[]; stations?: number };
  products?: { items?: Product[] };
  customers?: { items?: Customer[] };
  gallery?: { images?: string[] };
  landing?: Record<string, unknown>;
}

export async function loadBiz(bizId: string): Promise<BizData> {
  const snap = await getDoc(doc(getFirestoreDb(), BIZ_COLLECTION, bizId));
  return snap.exists() ? (snap.data() as BizData) : {};
}

async function patchBiz(bizId: string, partial: Record<string, unknown>): Promise<void> {
  const db = getFirestoreDb();
  const ref = doc(db, BIZ_COLLECTION, bizId);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : {};
  await setDoc(ref, { ...existing, ...partial }, { merge: true });
}

// ---------- Bookings ----------
export async function getBookings(bizId: string): Promise<Booking[]> {
  const biz = await loadBiz(bizId);
  return biz.appointments?.bookings || [];
}

export async function addBooking(bizId: string, booking: Partial<Booking>): Promise<Booking> {
  const biz = await loadBiz(bizId);
  const bookings = biz.appointments?.bookings || [];
  // Resolve price: explicit price, else look it up from the service catalog by name.
  let resolvedPrice = booking.price || 0;
  if (!resolvedPrice && booking.service) {
    const svcs = (biz.dana?.services as Array<{ name: string; price?: number | string }>) || [];
    const match = svcs.find((s) => s.name === booking.service);
    if (match) resolvedPrice = typeof match.price === 'number' ? match.price : parseInt(String(match.price || 0)) || 0;
  }
  const newBooking: Booking = {
    id: 'apt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    source: booking.source || 'manual',
    customerName: booking.customerName || '',
    customerPhone: booking.customerPhone || '',
    service: booking.service || '',
    duration: booking.duration || 30,
    date: booking.date || new Date().toISOString().split('T')[0],
    time: booking.time || '10:00',
    staff: booking.staff || null,
    station: booking.station || null,
    notes: booking.notes || '',
    status: 'confirmed',
    price: resolvedPrice,
    reminded: false,
    createdAt: new Date().toISOString(),
  };
  await patchBiz(bizId, {
    appointments: { ...(biz.appointments || {}), bookings: [newBooking, ...bookings] },
  });
  // Auto-create/update customer record
  if (newBooking.customerPhone) {
    await upsertCustomer(bizId, { name: newBooking.customerName, phone: newBooking.customerPhone });
  }
  return newBooking;
}

export async function updateBooking(bizId: string, id: string, changes: Partial<Booking>): Promise<void> {
  const biz = await loadBiz(bizId);
  const bookings = (biz.appointments?.bookings || []).map((b) => (b.id === id ? { ...b, ...changes } : b));
  await patchBiz(bizId, { appointments: { ...(biz.appointments || {}), bookings } });
}

export async function deleteBooking(bizId: string, id: string): Promise<void> {
  const biz = await loadBiz(bizId);
  const bookings = (biz.appointments?.bookings || []).filter((b) => b.id !== id);
  await patchBiz(bizId, { appointments: { ...(biz.appointments || {}), bookings } });
}

// ---------- Products / Courses ----------
export async function getProducts(bizId: string): Promise<Product[]> {
  const biz = await loadBiz(bizId);
  return biz.products?.items || [];
}

export async function addProduct(bizId: string, product: Partial<Product>): Promise<void> {
  const biz = await loadBiz(bizId);
  const items = biz.products?.items || [];
  const newProduct: Product = {
    id: 'prod_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    type: product.type || 'course',
    name: product.name || '',
    description: product.description || '',
    price: product.price || 0,
    contentUrl: product.contentUrl || '',
    sessions: product.sessions,
    active: true,
    sales: 0,
    createdAt: new Date().toISOString(),
  };
  await patchBiz(bizId, { products: { items: [newProduct, ...items] } });
}

export async function deleteProduct(bizId: string, id: string): Promise<void> {
  const biz = await loadBiz(bizId);
  const items = (biz.products?.items || []).filter((p) => p.id !== id);
  await patchBiz(bizId, { products: { items } });
}

// ---------- Customers ----------
export async function getCustomers(bizId: string): Promise<Customer[]> {
  const biz = await loadBiz(bizId);
  return biz.customers?.items || [];
}

export async function upsertCustomer(bizId: string, data: { name: string; phone: string; email?: string }): Promise<void> {
  const biz = await loadBiz(bizId);
  const items = biz.customers?.items || [];
  const existing = items.find((cu) => cu.phone === data.phone);
  if (existing) {
    existing.visits = (existing.visits || 0) + 1;
    existing.lastVisit = new Date().toISOString().split('T')[0];
    if (data.name && !existing.name) existing.name = data.name;
  } else {
    items.unshift({
      id: 'cust_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: data.name,
      phone: data.phone,
      email: data.email || '',
      visits: 1,
      lastVisit: new Date().toISOString().split('T')[0],
      totalSpent: 0,
      createdAt: new Date().toISOString(),
    });
  }
  await patchBiz(bizId, { customers: { items } });
}

export async function updateCustomer(bizId: string, id: string, changes: Partial<Customer>): Promise<void> {
  const biz = await loadBiz(bizId);
  const items = (biz.customers?.items || []).map((cu) => (cu.id === id ? { ...cu, ...changes } : cu));
  await patchBiz(bizId, { customers: { items } });
}

export async function deleteCustomer(bizId: string, id: string): Promise<void> {
  const biz = await loadBiz(bizId);
  const items = (biz.customers?.items || []).filter((cu) => cu.id !== id);
  await patchBiz(bizId, { customers: { items } });
}

// Get a customer's full booking history + computed stats
export function getCustomerHistory(bookings: Booking[], phone: string): { history: Booking[]; totalSpent: number; lastService: string } {
  const history = bookings
    .filter((b) => b.customerPhone === phone)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const totalSpent = history.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + (b.price || 0), 0);
  const lastService = history[0]?.service || '';
  return { history, totalSpent, lastService };
}

// ---------- Services / Pricing ----------
export interface Service {
  id: string;
  name: string;
  category: string;
  price: number;
  duration: number;      // minutes
  description: string;
  whatToAsk?: string;    // what Dana should ask before booking
  active: boolean;
}

export async function getServices(bizId: string): Promise<Service[]> {
  const biz = await loadBiz(bizId);
  // Services live under dana.services so Dana uses the same source of truth.
  const raw = (biz.dana?.services as Array<Record<string, unknown>>) || [];
  return raw.map((s) => ({
    id: (s.id as string) || 'svc_' + Math.random().toString(36).slice(2, 8),
    name: (s.name as string) || '',
    category: (s.category as string) || '',
    price: typeof s.price === 'number' ? s.price : parseInt(String(s.price || 0)) || 0,
    duration: (s.duration as number) || 30,
    description: (s.description as string) || '',
    whatToAsk: (s.whatToAsk as string) || '',
    active: s.active !== false,
  }));
}

export async function saveServices(bizId: string, services: Service[]): Promise<void> {
  const biz = await loadBiz(bizId);
  await patchBiz(bizId, { dana: { ...(biz.dana || {}), services } });
}

export async function addService(bizId: string, service: Partial<Service>): Promise<void> {
  const services = await getServices(bizId);
  const newService: Service = {
    id: 'svc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name: service.name || '',
    category: service.category || '',
    price: service.price || 0,
    duration: service.duration || 30,
    description: service.description || '',
    whatToAsk: service.whatToAsk || '',
    active: true,
  };
  await saveServices(bizId, [...services, newService]);
}

export async function updateService(bizId: string, id: string, changes: Partial<Service>): Promise<void> {
  const services = await getServices(bizId);
  await saveServices(bizId, services.map((s) => (s.id === id ? { ...s, ...changes } : s)));
}

export async function deleteService(bizId: string, id: string): Promise<void> {
  const services = await getServices(bizId);
  await saveServices(bizId, services.filter((s) => s.id !== id));
}

// ---------- Booking page branding ----------
export interface BookingBranding {
  logo: string;          // data URL
  banner: string;        // data URL (optional hero image)
  brandColor: string;
  accentStyle: string;   // 'gradient' | 'solid'
  welcomeText: string;
  headerStyle: string;   // 'banner' | 'minimal' | 'centered'
  showPrices: boolean;
  showDuration: boolean;
  requireEmail: boolean;
  requirePhone: boolean;
  address: string;
  phone: string;
  instagram: string;
  whatsapp: string;
  notifyPhone: string;
  cancellationNote: string;
  thankYouMessage: string;
  enabled: boolean;
}

export async function getBranding(bizId: string): Promise<BookingBranding> {
  const biz = await loadBiz(bizId);
  const b = ((biz as Record<string, unknown>).booking as Partial<BookingBranding>) || {};
  return {
    logo: b.logo || '',
    banner: b.banner || '',
    brandColor: b.brandColor || '#9333EA',
    accentStyle: b.accentStyle || 'gradient',
    welcomeText: b.welcomeText || '',
    headerStyle: b.headerStyle || 'centered',
    showPrices: b.showPrices !== false,
    showDuration: b.showDuration !== false,
    requireEmail: b.requireEmail === true,
    requirePhone: b.requirePhone !== false,
    address: b.address || '',
    phone: b.phone || '',
    instagram: b.instagram || '',
    whatsapp: b.whatsapp || '',
    notifyPhone: b.notifyPhone || '',
    cancellationNote: b.cancellationNote || '',
    thankYouMessage: b.thankYouMessage || '',
    enabled: b.enabled !== false,
  };
}

export async function saveBranding(bizId: string, branding: BookingBranding): Promise<void> {
  const biz = await loadBiz(bizId);
  await patchBiz(bizId, { booking: { ...((biz as Record<string, unknown>).booking || {}), ...branding } });
}

// Compute free slots for a service on a given date, considering existing
// bookings, station capacity, and business hours.
export function computeFreeSlots(
  bookings: Booking[],
  date: string,
  serviceDuration: number,
  stations: number,
  dayHours: { open: boolean; start: string; end: string },
): string[] {
  if (!dayHours.open) return [];
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
  const toStr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const startMin = toMin(dayHours.start);
  const endMin = toMin(dayHours.end);
  const dayBookings = bookings.filter((b) => b.date === date && b.status !== 'cancelled');
  const slots: string[] = [];
  const step = 15;
  for (let t = startMin; t + serviceDuration <= endMin; t += step) {
    const overlapping = dayBookings.filter((b) => {
      const bStart = toMin(b.time);
      const bEnd = bStart + (b.duration || 30);
      return t < bEnd && t + serviceDuration > bStart;
    }).length;
    if (overlapping < stations) slots.push(toStr(t));
  }
  return slots;
}

// ---------- Stations ----------
export async function setStations(bizId: string, stations: number): Promise<void> {
  const biz = await loadBiz(bizId);
  await patchBiz(bizId, { appointments: { ...(biz.appointments || {}), stations } });
}

// ---------- Team members ----------
export interface TeamMember {
  id: string;
  name: string;
  role: string;          // e.g. "ספר בכיר", "קוסמטיקאית"
  photo: string;         // data URL or hosted URL
  description: string;
  services: string[];    // names of services this member provides
  station: number | null;
  color: string;         // calendar color
  hours: Record<number, { open: boolean; start: string; end: string }>;
  active: boolean;
  createdAt: string;
  // Login credentials (set by owner). staffUid links to a Firebase account
  // once the member logs in for the first time.
  loginEmail?: string;
  staffUid?: string;     // filled after first login
}

const MEMBER_COLORS = ['#9333EA', '#EC4899', '#06B6D4', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#8B5CF6'];

export async function getTeam(bizId: string): Promise<TeamMember[]> {
  const biz = await loadBiz(bizId);
  return ((biz as Record<string, unknown>).team as { members?: TeamMember[] })?.members || [];
}

export async function addTeamMember(bizId: string, member: Partial<TeamMember>): Promise<void> {
  const biz = await loadBiz(bizId);
  const members = ((biz as Record<string, unknown>).team as { members?: TeamMember[] })?.members || [];
  const defaultHours: TeamMember['hours'] = {};
  for (let i = 0; i < 7; i++) defaultHours[i] = { open: i !== 6, start: '09:00', end: i === 5 ? '14:00' : '19:00' };
  const newMember: TeamMember = {
    id: 'team_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name: member.name || '',
    role: member.role || '',
    photo: member.photo || '',
    description: member.description || '',
    services: member.services || [],
    station: member.station ?? null,
    color: member.color || MEMBER_COLORS[members.length % MEMBER_COLORS.length],
    hours: member.hours || defaultHours,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await patchBiz(bizId, { team: { members: [...members, newMember] } });
}

export async function updateTeamMember(bizId: string, id: string, changes: Partial<TeamMember>): Promise<void> {
  const biz = await loadBiz(bizId);
  const members = (((biz as Record<string, unknown>).team as { members?: TeamMember[] })?.members || []).map((m) => (m.id === id ? { ...m, ...changes } : m));
  await patchBiz(bizId, { team: { members } });
}

export async function deleteTeamMember(bizId: string, id: string): Promise<void> {
  const biz = await loadBiz(bizId);
  const members = (((biz as Record<string, unknown>).team as { members?: TeamMember[] })?.members || []).filter((m) => m.id !== id);
  await patchBiz(bizId, { team: { members } });
}

// ---------- Business hours ----------
export interface BizHours {
  // 0=Sunday .. 6=Saturday
  days: Record<number, { open: boolean; start: string; end: string }>;
}

export async function getHours(bizId: string): Promise<BizHours> {
  const biz = await loadBiz(bizId);
  const saved = (biz.cfg as Record<string, unknown>)?.hours as BizHours | undefined;
  if (saved) return saved;
  // Default: Sun-Thu 9-19, Fri 9-14, Sat closed
  const days: BizHours['days'] = {};
  for (let i = 0; i < 7; i++) {
    days[i] = { open: i !== 6, start: '09:00', end: i === 5 ? '14:00' : '19:00' };
  }
  return { days };
}

export async function setHours(bizId: string, hours: BizHours): Promise<void> {
  const biz = await loadBiz(bizId);
  await patchBiz(bizId, { cfg: { ...(biz.cfg || {}), hours } });
}

// ---------- Business settings ----------
export interface BizSettings {
  businessName: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  businessType: string;
  address: string;
  city: string;
  logo: string;
  currency: string;
  defaultDuration: number;
  cancellationPolicy: string;
}

export async function getBizSettings(bizId: string): Promise<BizSettings> {
  const biz = await loadBiz(bizId);
  const cfg = (biz.cfg as Record<string, unknown>) || {};
  const s = ((biz as Record<string, unknown>).settings as Partial<BizSettings>) || {};
  return {
    businessName: s.businessName || (cfg.biz_name as string) || '',
    ownerName: s.ownerName || (cfg.contact_name as string) || '',
    ownerPhone: s.ownerPhone || (cfg.owner_phone as string) || '',
    ownerEmail: s.ownerEmail || (cfg.owner_email as string) || '',
    businessType: s.businessType || (cfg.business_type as string) || '',
    address: s.address || '',
    city: s.city || '',
    logo: s.logo || ((biz as Record<string, unknown>).booking as Record<string, unknown>)?.logo as string || '',
    currency: s.currency || 'ILS',
    defaultDuration: s.defaultDuration || 30,
    cancellationPolicy: s.cancellationPolicy || '',
  };
}

export async function saveBizSettings(bizId: string, settings: BizSettings): Promise<void> {
  const biz = await loadBiz(bizId);
  const cfg = (biz.cfg as Record<string, unknown>) || {};
  // Save to both settings and cfg (so Dana, booking page, reports all see updated info)
  await patchBiz(bizId, {
    settings: { ...((biz as Record<string, unknown>).settings || {}), ...settings },
    cfg: {
      ...cfg,
      biz_name: settings.businessName,
      contact_name: settings.ownerName,
      owner_phone: settings.ownerPhone,
      owner_email: settings.ownerEmail,
      business_type: settings.businessType,
    },
  });
}

// ---------- Business settings end ----------

// ---------- Business insights ----------
export function computeInsights(bookings: Booking[]): string[] {
  const insights: string[] = [];
  const active = bookings.filter((b) => b.status !== 'cancelled');
  if (active.length === 0) return ['התחל לקבל תורים כדי לראות תובנות חכמות על העסק שלך.'];

  // Busiest day of week
  const dayCount = new Array(7).fill(0);
  active.forEach((b) => { dayCount[new Date(b.date).getDay()]++; });
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const busiestDay = dayCount.indexOf(Math.max(...dayCount));
  if (Math.max(...dayCount) > 0) insights.push(`📊 יום ${days[busiestDay]} הוא היום העמוס ביותר שלך`);

  // Most popular service
  const svcCount = new Map<string, number>();
  active.forEach((b) => { if (b.service) svcCount.set(b.service, (svcCount.get(b.service) || 0) + 1); });
  if (svcCount.size > 0) {
    const top = Array.from(svcCount.entries()).sort((a, b) => b[1] - a[1])[0];
    insights.push(`⭐ "${top[0]}" הוא השירות המבוקש ביותר (${top[1]} תורים)`);
  }

  // Cancellation rate
  const cancelled = bookings.filter((b) => b.status === 'cancelled').length;
  if (bookings.length > 5) {
    const rate = Math.round((cancelled / bookings.length) * 100);
    if (rate > 15) insights.push(`⚠️ אחוז הביטולים שלך ${rate}% — שקול תזכורות אוטומטיות`);
    else if (rate < 5 && cancelled >= 0) insights.push(`✅ אחוז ביטולים נמוך (${rate}%) — לקוחות מרוצים!`);
  }

  // Revenue trend (last 7 vs previous 7 days)
  const today = new Date();
  const week1Start = new Date(today); week1Start.setDate(today.getDate() - 7);
  const week2Start = new Date(today); week2Start.setDate(today.getDate() - 14);
  const s = (d: Date) => d.toISOString().split('T')[0];
  const rev1 = active.filter((b) => b.date >= s(week1Start)).reduce((sum, b) => sum + (b.price || 0), 0);
  const rev2 = active.filter((b) => b.date >= s(week2Start) && b.date < s(week1Start)).reduce((sum, b) => sum + (b.price || 0), 0);
  if (rev2 > 0) {
    const change = Math.round(((rev1 - rev2) / rev2) * 100);
    if (change > 0) insights.push(`📈 ההכנסה השבוע עלתה ב-${change}% לעומת שבוע שעבר`);
    else if (change < 0) insights.push(`📉 ההכנסה השבוע ירדה ב-${Math.abs(change)}% — זמן לקדם`);
  }

  return insights.length > 0 ? insights : ['המשך לקבל תורים כדי לראות תובנות.'];
}

// ---------- Documents (receipts & quotes) ----------
export interface BizDocLineItem { description: string; qty: number; price: number; }
export interface BizDocument {
  id: string;
  type: 'receipt' | 'quote';   // קבלה / הצעת מחיר
  number: string;              // doc number e.g. "001"
  customerName: string;
  customerPhone: string;
  date: string;
  items: BizDocLineItem[];
  discount: number;            // amount
  taxRate: number;             // % (0 if not charging VAT)
  notes: string;
  status: string;              // 'draft' | 'sent' | 'paid' | 'accepted'
  createdAt: string;
}

export interface DocBranding {
  logo: string;
  businessName: string;
  businessId: string;          // ע.מ / ח.פ
  address: string;
  phone: string;
  email: string;
  footer: string;
  accentColor: string;
  template: string;            // 'modern' | 'classic' | 'minimal' | 'bold'
  headerStyle: string;         // 'band' | 'centered' | 'side'
  showLogo: boolean;
  showSignature: boolean;
  signatureName: string;
  thankYouNote: string;
}

export async function getDocBranding(bizId: string): Promise<DocBranding> {
  const biz = await loadBiz(bizId);
  const d = ((biz as Record<string, unknown>).docBranding as Partial<DocBranding>) || {};
  const cfg = (biz.cfg as Record<string, unknown>) || {};
  return {
    logo: d.logo || ((biz as Record<string, unknown>).booking as Record<string, unknown>)?.logo as string || '',
    businessName: d.businessName || (cfg.biz_name as string) || '',
    businessId: d.businessId || '',
    address: d.address || '',
    phone: d.phone || (cfg.owner_phone as string) || '',
    email: d.email || '',
    footer: d.footer || 'תודה שבחרתם בנו!',
    accentColor: d.accentColor || '#7C3AED',
    template: d.template || 'modern',
    headerStyle: d.headerStyle || 'band',
    showLogo: d.showLogo !== false,
    showSignature: d.showSignature === true,
    signatureName: d.signatureName || '',
    thankYouNote: d.thankYouNote || '',
  };
}

export async function saveDocBranding(bizId: string, branding: DocBranding): Promise<void> {
  const biz = await loadBiz(bizId);
  await patchBiz(bizId, { docBranding: { ...((biz as Record<string, unknown>).docBranding || {}), ...branding } });
}

export async function getDocuments(bizId: string): Promise<BizDocument[]> {
  const biz = await loadBiz(bizId);
  return ((biz as Record<string, unknown>).documents as { items?: BizDocument[] })?.items || [];
}

export async function saveDocument(bizId: string, document: BizDocument): Promise<void> {
  const docs = await getDocuments(bizId);
  const existing = docs.findIndex((d) => d.id === document.id);
  const next = existing >= 0 ? docs.map((d) => (d.id === document.id ? document : d)) : [document, ...docs];
  await patchBiz(bizId, { documents: { items: next } });
}

export async function deleteDocument(bizId: string, id: string): Promise<void> {
  const docs = await getDocuments(bizId);
  await patchBiz(bizId, { documents: { items: docs.filter((d) => d.id !== id) } });
}

export function docTotal(doc: BizDocument): { subtotal: number; tax: number; total: number } {
  const subtotal = doc.items.reduce((s, i) => s + i.qty * i.price, 0) - (doc.discount || 0);
  const tax = doc.taxRate ? subtotal * (doc.taxRate / 100) : 0;
  return { subtotal, tax, total: subtotal + tax };
}

// ---------- Automations ----------
export interface AutomationSettings {
  // SMS/WhatsApp automations — independent of Dana voice
  confirmOnBooking: boolean;       // send confirmation when booked
  reminderEnabled: boolean;        // day-before reminder
  reminderHoursBefore: number;
  reviewRequest: boolean;          // ask for review after appointment
  reviewLink: string;
  birthdayGreeting: boolean;
  winbackEnabled: boolean;         // re-engage customers who haven't returned
  winbackDays: number;
  channel: 'sms' | 'whatsapp';     // delivery channel
  whatsappNumber: string;          // business WhatsApp number (once connected)
  customConfirmText: string;
  customReminderText: string;
}

export async function getAutomations(bizId: string): Promise<AutomationSettings> {
  const biz = await loadBiz(bizId);
  const a = ((biz as Record<string, unknown>).automations as Partial<AutomationSettings>) || {};
  return {
    confirmOnBooking: a.confirmOnBooking !== false,
    reminderEnabled: a.reminderEnabled !== false,
    reminderHoursBefore: a.reminderHoursBefore || 24,
    reviewRequest: a.reviewRequest === true,
    reviewLink: a.reviewLink || '',
    birthdayGreeting: a.birthdayGreeting === true,
    winbackEnabled: a.winbackEnabled === true,
    winbackDays: a.winbackDays || 60,
    channel: a.channel || 'sms',
    whatsappNumber: a.whatsappNumber || '',
    customConfirmText: a.customConfirmText || '',
    customReminderText: a.customReminderText || '',
  };
}

export async function saveAutomations(bizId: string, settings: AutomationSettings): Promise<void> {
  const biz = await loadBiz(bizId);
  await patchBiz(bizId, { automations: { ...((biz as Record<string, unknown>).automations || {}), ...settings } });
}

// ---------- Notifications ----------
export interface AppNotification {
  id: string;
  type: string;
  text: string;
  read: boolean;
  createdAt: string;
}

export async function getNotifications(bizId: string): Promise<AppNotification[]> {
  const biz = await loadBiz(bizId);
  return ((biz as Record<string, unknown>).notifications as { items?: AppNotification[] })?.items || [];
}

export async function markNotificationsRead(bizId: string): Promise<void> {
  const biz = await loadBiz(bizId);
  const items = (((biz as Record<string, unknown>).notifications as { items?: AppNotification[] })?.items || []).map((n) => ({ ...n, read: true }));
  await patchBiz(bizId, { notifications: { items } });
}

// ---------- Reports / Revenue ----------
export interface ReportData {
  totalRevenue: number;
  totalBookings: number;
  completed: number;
  cancelled: number;
  noShows: number;
  byService: Array<{ service: string; count: number; revenue: number }>;
  byDay: Array<{ date: string; revenue: number; count: number }>;
  avgTicket: number;
}

export function computeReport(bookings: Booking[], fromDate: string, toDate: string, services?: Array<{ name: string; price?: number | string }>): ReportData {
  // Backfill price for bookings that were saved without one (look up by service name)
  const priceOf = (b: Booking): number => {
    if (b.price && b.price > 0) return b.price;
    if (services && b.service) {
      const m = services.find((s) => s.name === b.service);
      if (m) return typeof m.price === 'number' ? m.price : parseInt(String(m.price || 0)) || 0;
    }
    return 0;
  };
  const inRange = bookings.filter((b) => b.date >= fromDate && b.date <= toDate);
  const completed = inRange.filter((b) => b.status === 'confirmed' || b.status === 'completed');
  const cancelled = inRange.filter((b) => b.status === 'cancelled').length;
  const noShows = inRange.filter((b) => b.status === 'no_show').length;
  const totalRevenue = completed.reduce((s, b) => s + priceOf(b), 0);

  const serviceMap = new Map<string, { count: number; revenue: number }>();
  completed.forEach((b) => {
    const key = b.service || 'אחר';
    const cur = serviceMap.get(key) || { count: 0, revenue: 0 };
    cur.count++; cur.revenue += priceOf(b);
    serviceMap.set(key, cur);
  });
  const byService = Array.from(serviceMap.entries())
    .map(([service, v]) => ({ service, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  const dayMap = new Map<string, { revenue: number; count: number }>();
  completed.forEach((b) => {
    const cur = dayMap.get(b.date) || { revenue: 0, count: 0 };
    cur.revenue += priceOf(b); cur.count++;
    dayMap.set(b.date, cur);
  });
  const byDay = Array.from(dayMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalRevenue,
    totalBookings: inRange.length,
    completed: completed.length,
    cancelled,
    noShows,
    byService,
    byDay,
    avgTicket: completed.length ? Math.round(totalRevenue / completed.length) : 0,
  };
}

export function bookingsToCSV(bookings: Booking[]): string {
  const header = 'תאריך,שעה,לקוח,טלפון,שירות,משך,מחיר,סטטוס,מקור';
  const rows = bookings.map((b) =>
    [b.date, b.time, b.customerName, b.customerPhone, b.service, b.duration, b.price || 0, b.status, b.source]
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  );
  return '\uFEFF' + [header, ...rows].join('\n'); // BOM for Hebrew Excel
}

// ---------- Gallery ----------
export async function getGallery(bizId: string): Promise<string[]> {
  const biz = await loadBiz(bizId);
  return biz.gallery?.images || [];
}

export async function addGalleryImage(bizId: string, dataUrl: string): Promise<string[]> {
  const biz = await loadBiz(bizId);
  const images = biz.gallery?.images || [];
  if (images.length >= 12) throw new Error('מקסימום 12 תמונות');
  const updated = [...images, dataUrl];
  await patchBiz(bizId, { gallery: { images: updated } });
  return updated;
}

export async function removeGalleryImage(bizId: string, index: number): Promise<string[]> {
  const biz = await loadBiz(bizId);
  const updated = (biz.gallery?.images || []).filter((_, i) => i !== index);
  await patchBiz(bizId, { gallery: { images: updated } });
  return updated;
}
