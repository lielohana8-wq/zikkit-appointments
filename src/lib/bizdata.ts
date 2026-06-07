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
    price: booking.price || 0,
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

export function computeReport(bookings: Booking[], fromDate: string, toDate: string): ReportData {
  const inRange = bookings.filter((b) => b.date >= fromDate && b.date <= toDate);
  const completed = inRange.filter((b) => b.status === 'confirmed' || b.status === 'completed');
  const cancelled = inRange.filter((b) => b.status === 'cancelled').length;
  const noShows = inRange.filter((b) => b.status === 'no_show').length;
  const totalRevenue = completed.reduce((s, b) => s + (b.price || 0), 0);

  const serviceMap = new Map<string, { count: number; revenue: number }>();
  completed.forEach((b) => {
    const key = b.service || 'אחר';
    const cur = serviceMap.get(key) || { count: 0, revenue: 0 };
    cur.count++; cur.revenue += b.price || 0;
    serviceMap.set(key, cur);
  });
  const byService = Array.from(serviceMap.entries())
    .map(([service, v]) => ({ service, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  const dayMap = new Map<string, { revenue: number; count: number }>();
  completed.forEach((b) => {
    const cur = dayMap.get(b.date) || { revenue: 0, count: 0 };
    cur.revenue += b.price || 0; cur.count++;
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
