/**
 * Demo-data seeder — fills a business with realistic sample data so an owner
 * can demo a "live" system to a prospect, or explore the product before adding
 * their own data. Everything is clearly Hebrew sample data; a reset (settings →
 * איפוס נתונים) clears it instantly.
 */

import { patchBiz, loadBiz, type Booking, type Customer, type Service } from './bizdata';

const NAMES = ['יוסי כהן', 'מאיה לוי', 'דניאל אברהם', 'נועה פרץ', 'איתי מזרחי', 'שירה ביטון', 'עומר דוד', 'תמר שלום', 'רון אזולאי', 'ליאור חדד', 'גל אוחיון', 'עדן כהן'];
const SERVICES: Array<{ name: string; price: number; duration: number; category: string }> = [
  { name: 'תספורת גברים', price: 80, duration: 30, category: 'תספורות' },
  { name: 'תספורת + זקן', price: 110, duration: 45, category: 'תספורות' },
  { name: 'צבע', price: 220, duration: 90, category: 'צבע' },
  { name: 'פן', price: 90, duration: 40, category: 'עיצוב' },
  { name: 'החלקה', price: 350, duration: 120, category: 'טיפולים' },
];
const STAFF = ['דנה', 'קרן', 'מיכל'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function dateStr(offsetDays: number): string {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function phone(i: number): string { return `05${rand([0, 2, 3, 4, 5])}${String(1000000 + i * 13337).slice(0, 7)}`; }

export async function seedDemoData(bizId: string): Promise<void> {
  const biz = await loadBiz(bizId);

  // Services
  const services: Service[] = SERVICES.map((s, i) => ({
    id: `demo_svc_${i}`, name: s.name, category: s.category, price: s.price, duration: s.duration, description: '', active: true,
  }));

  // Customers with varied visit history
  const customers: Customer[] = NAMES.map((name, i) => {
    const visits = 1 + Math.floor(Math.random() * 12);
    return {
      id: `demo_cust_${i}`, name, phone: phone(i), email: '', visits,
      lastVisit: dateStr(-Math.floor(Math.random() * 60)),
      totalSpent: visits * (80 + Math.floor(Math.random() * 140)),
      tags: visits >= 8 ? ['VIP', 'קבוע'] : visits >= 4 ? ['קבוע'] : ['חדש'],
      vip: visits >= 8, createdAt: dateStr(-90 - i * 10),
    };
  });

  // Bookings — past (completed/no_show) + upcoming, leaving gaps for the engine
  const bookings: Booking[] = [];
  let bid = 0;
  // Past 30 days
  for (let d = -30; d < 0; d++) {
    const count = Math.floor(Math.random() * 4);
    for (let k = 0; k < count; k++) {
      const svc = rand(SERVICES); const cust = rand(customers);
      const hour = 9 + Math.floor(Math.random() * 8);
      bookings.push({
        id: `demo_bk_${bid++}`, source: 'demo', customerName: cust.name, customerPhone: cust.phone,
        service: svc.name, duration: svc.duration, date: dateStr(d), time: `${pad(hour)}:00`,
        staff: rand(STAFF), station: null, notes: '', status: Math.random() < 0.12 ? 'no_show' : 'completed',
        price: svc.price, createdAt: dateStr(d),
      });
    }
  }
  // Upcoming 5 days (sparse — leaves gaps for Smart Gaps to find)
  for (let d = 0; d < 5; d++) {
    const count = 1 + Math.floor(Math.random() * 2);
    for (let k = 0; k < count; k++) {
      const svc = rand(SERVICES); const cust = rand(customers);
      const hour = 10 + Math.floor(Math.random() * 6);
      bookings.push({
        id: `demo_bk_${bid++}`, source: 'demo', customerName: cust.name, customerPhone: cust.phone,
        service: svc.name, duration: svc.duration, date: dateStr(d), time: `${pad(hour)}:00`,
        staff: rand(STAFF), station: null, notes: '', status: 'confirmed',
        price: svc.price, createdAt: dateStr(-1),
      });
    }
  }

  await patchBiz(bizId, {
    dana: { ...(biz.dana || {}), services },
    customers: { items: customers },
    appointments: { ...(biz.appointments || {}), bookings },
    _demo: true,
  });
}
