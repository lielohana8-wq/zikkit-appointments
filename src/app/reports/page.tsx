'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Chip } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBookings, computeReport, bookingsToCSV, getServices, type Booking, type ReportData, type Service } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

type Range = 'today' | 'week' | 'month' | 'all';

export default function ReportsPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [range, setRange] = useState<Range>('month');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try { setBookings(await getBookings(bizId)); setServices(await getServices(bizId)); } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const today = new Date();
    let from = new Date();
    if (range === 'today') from = today;
    else if (range === 'week') from.setDate(today.getDate() - 7);
    else if (range === 'month') from.setDate(today.getDate() - 30);
    else from = new Date('2020-01-01');
    const fromStr = from.toISOString().split('T')[0];
    const toStr = today.toISOString().split('T')[0];
    setReport(computeReport(bookings, fromStr, toStr, services));
  }, [bookings, range, services]);

  const exportCSV = () => {
    const csv = bookingsToCSV(bookings);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `zikkit-תורים-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const maxDayRev = report ? Math.max(...report.byDay.map((d) => d.revenue), 1) : 1;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>דוחות כספיים</Typography>
        <Button onClick={exportCSV} size="small" sx={{ color: c.accent, fontWeight: 700 }}>⬇ CSV</Button>
      </Box>

      <Box sx={{ maxWidth: 820, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: { xs: 3, sm: 4 } }}>
        {/* Range selector — segmented control */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 4, bgcolor: c.surface3, p: 0.5, borderRadius: 99, width: 'fit-content', mx: 'auto' }}>
          {([['today', 'היום'], ['week', 'שבוע'], ['month', 'חודש'], ['all', 'הכל']] as [Range, string][]).map(([r, label]) => (
            <Button key={r} onClick={() => setRange(r)} sx={{ borderRadius: 99, fontWeight: 600, fontSize: 14, px: 2.5, py: 0.75, minWidth: 64, bgcolor: range === r ? c.surface1 : 'transparent', color: range === r ? c.text : c.text3, boxShadow: range === r ? c.shadowSm : 'none', '&:hover': { bgcolor: range === r ? c.surface1 : 'transparent' } }}>{label}</Button>
          ))}
        </Box>

        {report && (
          <>
            {/* Hero revenue card */}
            <Box sx={{ bgcolor: c.accent, borderRadius: 2, p: { xs: 3, sm: 4 }, color: '#fff', mb: 2.5, position: 'relative', overflow: 'hidden' }}>
              <Typography sx={{ fontSize: 11, opacity: 0.85, fontWeight: 700, position: 'relative', textTransform: 'uppercase', letterSpacing: '0.12em' }}>הכנסה כוללת</Typography>
              <Typography sx={{ fontSize: { xs: 52, sm: 68 }, fontWeight: 900, letterSpacing: '-0.05em', lineHeight: 0.9, position: 'relative', mt: 1 }}>₪{report.totalRevenue.toLocaleString()}</Typography>
              <Typography sx={{ fontSize: 13, opacity: 0.85, mt: 1.5, position: 'relative', fontWeight: 500 }}>{report.completed} תורים · ₪{report.avgTicket} בממוצע לתור</Typography>
            </Box>

            {/* KPI mini cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: { xs: 1.5, sm: 2 }, mb: 3 }}>
              {[
                { label: 'תורים', value: report.completed, color: c.text },
                { label: 'ממוצע', value: `₪${report.avgTicket}`, color: c.text },
                { label: 'ביטולים', value: report.cancelled, color: report.cancelled > 0 ? c.hot : c.text },
              ].map((k, i) => (
                <Box key={i} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: { xs: 2, sm: 2.5 } }}>
                  <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800, color: k.color, letterSpacing: '-0.02em' }}>{k.value}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: c.text3, fontWeight: 500 }}>{k.label}</Typography>
                </Box>
              ))}
            </Box>

            {/* Revenue by day */}
            {report.byDay.length > 0 && report.totalRevenue > 0 && (
              <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 3, mb: 3 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text, mb: 2.5 }}>הכנסה לפי יום</Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, height: 150 }}>
                  {report.byDay.slice(-14).map((d) => (
                    <Box key={d.date} sx={{ flex: 1, minWidth: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, height: '100%', justifyContent: 'flex-end' }}>
                      <Typography sx={{ fontSize: 9.5, color: c.text3, fontWeight: 600 }}>{d.revenue > 0 ? `₪${d.revenue}` : ''}</Typography>
                      <Box sx={{ width: '100%', height: `${Math.max((d.revenue / maxDayRev) * 110, 3)}px`, background: `linear-gradient(to top, ${c.accent}, ${c.accent2})`, borderRadius: 1.5, transition: 'height 0.4s cubic-bezier(0.22,1,0.36,1)' }} />
                      <Typography sx={{ fontSize: 9, color: c.text3 }}>{d.date.slice(5)}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* By service */}
            {report.byService.length > 0 && (
              <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 3 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text, mb: 2.5 }}>פילוח לפי שירות</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {report.byService.map((s) => (
                    <Box key={s.service}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text }}>{s.service}</Typography>
                          <Box sx={{ bgcolor: c.accentDim, color: c.accent, fontWeight: 700, fontSize: 10.5, borderRadius: 99, px: 1, py: 0.1 }}>{s.count}</Box>
                        </Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>₪{s.revenue.toLocaleString()}</Typography>
                      </Box>
                      <Box sx={{ height: 7, bgcolor: c.surface3, borderRadius: 99, overflow: 'hidden' }}>
                        <Box sx={{ width: `${report.totalRevenue ? (s.revenue / report.totalRevenue) * 100 : 0}%`, height: '100%', background: `linear-gradient(to right, ${c.accent}, ${c.accent2})`, borderRadius: 99, transition: 'width 0.5s' }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {report.totalBookings === 0 && (
              <Box sx={{ textAlign: 'center', py: 7 }}>
                <Box sx={{ fontSize: 44, mb: 1.5, opacity: 0.5 }}>📊</Box>
                <Typography sx={{ color: c.text3 }}>אין נתונים בתקופה זו</Typography>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
