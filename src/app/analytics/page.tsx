'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBookings, getServices, getCustomers, type Booking, type Service, type Customer } from '@/lib/bizdata';
import { PageSkeleton } from '@/components/Skeleton';
import { zikkitColors as c } from '@/styles/theme';

const HEB_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const HEB_MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

export default function AnalyticsPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      setBookings(await getBookings(bizId));
      setServices(await getServices(bizId));
      setCustomers(await getCustomers(bizId));
    } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  if (loading || dataLoading) return <PageSkeleton rows={4} />;

  const active = bookings.filter((b) => b.status !== 'cancelled');
  const priceOf = (b: Booking) => {
    if (b.price && b.price > 0) return b.price;
    const m = services.find((s) => s.name === b.service);
    return m ? (typeof m.price === 'number' ? m.price : parseInt(String(m.price || 0)) || 0) : 0;
  };

  // Revenue last 6 months
  const now = new Date();
  const months: { label: string; revenue: number; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mb = active.filter((b) => b.date.startsWith(ym));
    months.push({ label: HEB_MONTHS[d.getMonth()], revenue: mb.reduce((s, b) => s + priceOf(b), 0), count: mb.length });
  }
  const maxMonthRev = Math.max(...months.map((m) => m.revenue), 1);

  // Bookings by day-of-week
  const dowCount = new Array(7).fill(0);
  active.forEach((b) => { dowCount[new Date(b.date).getDay()]++; });
  const maxDow = Math.max(...dowCount, 1);

  // Bookings by hour
  const hourCount = new Array(24).fill(0);
  active.forEach((b) => { const h = parseInt(b.time?.split(':')[0] || '0'); hourCount[h]++; });
  const maxHour = Math.max(...hourCount, 1);
  const activeHours = hourCount.map((v, h) => ({ h, v })).filter((x) => x.h >= 7 && x.h <= 22);

  // Top services (pie-ish)
  const svcMap = new Map<string, { count: number; revenue: number }>();
  active.forEach((b) => { const k = b.service || 'אחר'; const cur = svcMap.get(k) || { count: 0, revenue: 0 }; cur.count++; cur.revenue += priceOf(b); svcMap.set(k, cur); });
  const topServices = Array.from(svcMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const totalSvcRev = topServices.reduce((s, x) => s + x.revenue, 0) || 1;
  const PIE_COLORS = ['#7C3AED', '#9061F9', '#B794F6', '#D6BCFA', '#E9D8FD'];

  // Returning vs new customers
  const returning = customers.filter((cu) => (cu.visits || 0) > 1).length;
  const newCust = customers.filter((cu) => (cu.visits || 0) <= 1).length;
  const totalCust = returning + newCust || 1;

  // Pie chart geometry
  let cumulative = 0;
  const pieSlices = topServices.map((s, i) => {
    const frac = s.revenue / totalSvcRev;
    const start = cumulative; cumulative += frac;
    const a0 = start * 2 * Math.PI - Math.PI / 2;
    const a1 = cumulative * 2 * Math.PI - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const r = 70, cx = 80, cy = 80;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return { path: `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`, color: PIE_COLORS[i % PIE_COLORS.length], name: s.name, pct: Math.round(frac * 100) };
  });

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 5, p: 3, mb: 2.5, boxShadow: c.shadowSm }}>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text, mb: 2.5 }}>{title}</Typography>
      {children}
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>אנליטיקס</Typography>
        <Box sx={{ width: 80 }} />
      </Box>

      <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {active.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: 44, mb: 1.5, opacity: 0.5 }}>📈</Box>
            <Typography sx={{ color: c.text3 }}>צריך תורים כדי לראות אנליטיקס</Typography>
          </Box>
        ) : (
          <>
            {/* Revenue trend — 6 months */}
            <Card title="מגמת הכנסה — 6 חודשים">
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 180 }}>
                {months.map((m, i) => (
                  <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, height: '100%', justifyContent: 'flex-end' }}>
                    <Typography sx={{ fontSize: 10, color: c.text3, fontWeight: 700 }}>{m.revenue > 0 ? `₪${m.revenue >= 1000 ? (m.revenue / 1000).toFixed(1) + 'k' : m.revenue}` : ''}</Typography>
                    <Box sx={{ width: '100%', height: `${Math.max((m.revenue / maxMonthRev) * 130, 4)}px`, background: `linear-gradient(to top, ${c.accent}, ${c.accent2})`, borderRadius: 2, transition: 'height 0.5s cubic-bezier(0.22,1,0.36,1)' }} />
                    <Typography sx={{ fontSize: 11, color: c.text2, fontWeight: 600 }}>{m.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Card>

            {/* Top services pie */}
            {topServices.length > 0 && (
              <Card title="התפלגות הכנסה לפי שירות">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                  <svg width="160" height="160" viewBox="0 0 160 160">
                    {pieSlices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
                    <circle cx="80" cy="80" r="38" fill="var(--zk-surface1)" />
                  </svg>
                  <Box sx={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {pieSlices.map((s, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: s.color }} />
                        <Typography sx={{ fontSize: 13, color: c.text, flex: 1 }}>{s.name}</Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2 }}>{s.pct}%</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Card>
            )}

            {/* By day of week */}
            <Card title="עומס לפי יום בשבוע">
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 120 }}>
                {dowCount.map((v, i) => (
                  <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, height: '100%', justifyContent: 'flex-end' }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: c.text2 }}>{v || ''}</Typography>
                    <Box sx={{ width: '100%', height: `${Math.max((v / maxDow) * 80, 3)}px`, bgcolor: v === maxDow ? c.accent : c.accentMid, borderRadius: 1.5, transition: 'height 0.4s' }} />
                    <Typography sx={{ fontSize: 12, color: c.text3, fontWeight: 600 }}>{HEB_DAYS[i]}</Typography>
                  </Box>
                ))}
              </Box>
            </Card>

            {/* By hour heatmap */}
            <Card title="שעות שיא">
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 90 }}>
                {activeHours.map(({ h, v }) => (
                  <Box key={h} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, height: '100%', justifyContent: 'flex-end' }}>
                    <Box sx={{ width: '100%', height: `${Math.max((v / maxHour) * 60, 2)}px`, bgcolor: v === maxHour && v > 0 ? c.accent : c.accentMid, borderRadius: 1, transition: 'height 0.4s' }} />
                    <Typography sx={{ fontSize: 8.5, color: c.text3 }}>{h}</Typography>
                  </Box>
                ))}
              </Box>
            </Card>

            {/* Returning vs new */}
            <Card title="לקוחות חוזרים מול חדשים">
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: returning || 1, bgcolor: c.accent, borderRadius: 3, p: 2, color: '#fff', textAlign: 'center', minWidth: 80 }}>
                  <Typography sx={{ fontSize: 26, fontWeight: 800 }}>{returning}</Typography>
                  <Typography sx={{ fontSize: 12, opacity: 0.9 }}>חוזרים</Typography>
                  <Typography sx={{ fontSize: 11, opacity: 0.8 }}>{Math.round((returning / totalCust) * 100)}%</Typography>
                </Box>
                <Box sx={{ flex: newCust || 1, bgcolor: c.surface3, borderRadius: 3, p: 2, textAlign: 'center', minWidth: 80 }}>
                  <Typography sx={{ fontSize: 26, fontWeight: 800, color: c.text }}>{newCust}</Typography>
                  <Typography sx={{ fontSize: 12, color: c.text3 }}>חדשים</Typography>
                  <Typography sx={{ fontSize: 11, color: c.text3 }}>{Math.round((newCust / totalCust) * 100)}%</Typography>
                </Box>
              </Box>
            </Card>
          </>
        )}
      </Box>
    </Box>
  );
}
