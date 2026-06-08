'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Chip } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBookings, computeReport, bookingsToCSV, type Booking, type ReportData } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

type Range = 'today' | 'week' | 'month' | 'all';

export default function ReportsPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [range, setRange] = useState<Range>('month');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try { setBookings(await getBookings(bizId)); } finally { setDataLoading(false); }
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
    setReport(computeReport(bookings, fromStr, toStr));
  }, [bookings, range]);

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
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.surface1 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 800, color: c.text }}>דוחות כספיים</Typography>
        <Button onClick={exportCSV} size="small" sx={{ color: c.accent, fontWeight: 700 }}>⬇ CSV</Button>
      </Box>

      <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
        {/* Range selector */}
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          {([['today', 'היום'], ['week', 'שבוע'], ['month', 'חודש'], ['all', 'הכל']] as [Range, string][]).map(([r, label]) => (
            <Button key={r} onClick={() => setRange(r)} sx={{ flex: 1, borderRadius: 99, fontWeight: 700, bgcolor: range === r ? c.accent : c.surface1, color: range === r ? '#fff' : c.text2, border: `1px solid ${range === r ? c.accent : c.border}`, '&:hover': { bgcolor: range === r ? c.accent : c.surface2 } }}>{label}</Button>
          ))}
        </Box>

        {report && (
          <>
            {/* KPI cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 3 }}>
              <Box sx={{ bgcolor: `linear-gradient(135deg, ${c.accent}, ${c.accent2})`, background: `linear-gradient(135deg, ${c.accent}, ${c.accent2})`, borderRadius: 4, p: 3, color: '#fff' }}>
                <Typography sx={{ fontSize: 13, opacity: 0.9 }}>הכנסה כוללת</Typography>
                <Typography sx={{ fontSize: 32, fontWeight: 800 }}>₪{report.totalRevenue.toLocaleString()}</Typography>
              </Box>
              <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 3 }}>
                <Typography sx={{ fontSize: 13, color: c.text3 }}>תורים שהושלמו</Typography>
                <Typography sx={{ fontSize: 32, fontWeight: 800, color: c.text }}>{report.completed}</Typography>
              </Box>
              <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 3 }}>
                <Typography sx={{ fontSize: 13, color: c.text3 }}>ממוצע לתור</Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 800, color: c.text }}>₪{report.avgTicket}</Typography>
              </Box>
              <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 3 }}>
                <Typography sx={{ fontSize: 13, color: c.text3 }}>ביטולים</Typography>
                <Typography sx={{ fontSize: 28, fontWeight: 800, color: c.hot }}>{report.cancelled}</Typography>
              </Box>
            </Box>

            {/* Revenue by day - simple bar chart */}
            {report.byDay.length > 0 && (
              <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 3, mb: 3 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text, mb: 2 }}>הכנסה לפי יום</Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 140, overflowX: 'auto' }}>
                  {report.byDay.slice(-14).map((d) => (
                    <Box key={d.date} sx={{ flex: 1, minWidth: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontSize: 9, color: c.text3 }}>₪{d.revenue}</Typography>
                      <Box sx={{ width: '100%', height: `${(d.revenue / maxDayRev) * 100}px`, minHeight: 4, bgcolor: c.accent, borderRadius: 1, transition: 'height 0.3s' }} />
                      <Typography sx={{ fontSize: 8, color: c.text3, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{d.date.slice(5)}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* By service */}
            {report.byService.length > 0 && (
              <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 3 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text, mb: 2 }}>פילוח לפי שירות</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {report.byService.map((s) => (
                    <Box key={s.service} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text, minWidth: 100 }}>{s.service}</Typography>
                      <Box sx={{ flex: 1, height: 8, bgcolor: c.surface3, borderRadius: 99, overflow: 'hidden' }}>
                        <Box sx={{ width: `${(s.revenue / report.totalRevenue) * 100}%`, height: '100%', bgcolor: c.accent }} />
                      </Box>
                      <Chip label={`${s.count}`} size="small" sx={{ bgcolor: c.accentDim, color: c.accent, fontWeight: 700, fontSize: 10 }} />
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.accent, minWidth: 60, textAlign: 'left' }}>₪{s.revenue}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {report.totalBookings === 0 && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Box sx={{ fontSize: 48, mb: 2 }}>📊</Box>
                <Typography sx={{ color: c.text3 }}>אין נתונים בתקופה זו</Typography>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
