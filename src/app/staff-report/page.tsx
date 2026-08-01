'use client';

/**
 * Staff payroll / commissions report — per member, per month:
 * bookings, revenue (personal prices included), cancellations, average ticket.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { loadBiz } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

interface Bk { staff?: string; price?: number; date?: string; status?: string; service?: string }

export default function StaffReportPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading, user } = useAuth();
  const [bookings, setBookings] = useState<Bk[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);
  useEffect(() => { if (!loading && user?.role === 'staff') router.push('/dashboard'); }, [loading, user, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const biz = (await loadBiz(bizId)) as Record<string, unknown>;
      const apt = (biz.appointments as Record<string, unknown>) || {};
      setBookings(((apt.bookings as Bk[]) || []));
    } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const monthLabel = (m: string) => `${monthNames[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
  const shiftMonth = (dir: number) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const rows = useMemo(() => {
    const inMonth = bookings.filter((b) => String(b.date || '').startsWith(month) && b.status !== 'blocked');
    const byStaff: Record<string, { count: number; revenue: number; cancelled: number }> = {};
    for (const b of inMonth) {
      const key = b.staff || 'ללא שיוך';
      byStaff[key] = byStaff[key] || { count: 0, revenue: 0, cancelled: 0 };
      if (b.status === 'cancelled') { byStaff[key].cancelled++; continue; }
      byStaff[key].count++;
      byStaff[key].revenue += Number(b.price) || 0;
    }
    return Object.entries(byStaff).map(([name, v]) => ({ name, ...v, avg: v.count ? Math.round(v.revenue / v.count) : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [bookings, month]);

  const totals = useMemo(() => rows.reduce((t, r) => ({ count: t.count + r.count, revenue: t.revenue + r.revenue }), { count: 0, revenue: 0 }), [rows]);

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 20, bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)' }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text }}>📊 דוח צוות ושכר</Typography>
        <Box sx={{ width: 90 }} />
      </Box>

      <Box sx={{ maxWidth: 720, mx: 'auto', px: 2, py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2.5 }}>
          <Button onClick={() => shiftMonth(-1)} sx={{ color: c.text2, fontWeight: 900, minWidth: 40 }}>‹</Button>
          <Typography sx={{ fontSize: 17, fontWeight: 900, color: c.text, minWidth: 150, textAlign: 'center' }}>{monthLabel(month)}</Typography>
          <Button onClick={() => shiftMonth(1)} sx={{ color: c.text2, fontWeight: 900, minWidth: 40 }}>›</Button>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2.5 }}>
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 24, fontWeight: 900, color: c.text }}>₪{totals.revenue.toLocaleString()}</Typography>
            <Typography sx={{ fontSize: 12, color: c.text3 }}>סה&quot;כ הכנסות החודש</Typography>
          </Box>
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 24, fontWeight: 900, color: c.text }}>{totals.count}</Typography>
            <Typography sx={{ fontSize: 12, color: c.text3 }}>תורים שבוצעו</Typography>
          </Box>
        </Box>

        {rows.length === 0 && <Typography sx={{ textAlign: 'center', color: c.text3, py: 6 }}>אין נתונים לחודש הזה</Typography>}

        {rows.map((r) => (
          <Box key={r.name} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2, mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: 15.5, fontWeight: 900, color: c.text }}>✂️ {r.name}</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 900, color: c.accent }}>₪{r.revenue.toLocaleString()}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 12.5, color: c.text3 }}>📅 {r.count} תורים</Typography>
              <Typography sx={{ fontSize: 12.5, color: c.text3 }}>💵 ממוצע ₪{r.avg}</Typography>
              {r.cancelled > 0 && <Typography sx={{ fontSize: 12.5, color: c.text3 }}>❌ {r.cancelled} ביטולים</Typography>}
              {totals.revenue > 0 && <Typography sx={{ fontSize: 12.5, color: c.text3 }}>🧮 {Math.round((r.revenue / totals.revenue) * 100)}% מההכנסות</Typography>}
            </Box>
          </Box>
        ))}

        <Typography sx={{ fontSize: 11.5, color: c.text3, textAlign: 'center', mt: 2 }}>מבוסס על מחירי התורים בפועל (כולל מחירים אישיים ותוספות שעות שיא) · תורים שבוטלו לא נספרים בהכנסות</Typography>
      </Box>
    </Box>
  );
}
