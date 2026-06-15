'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBookings, getCustomers, getExpenses, bookingsToCSV, customersToCSV, expensesToCSV, downloadCSV, type Booking, type Customer, type Expense } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

export default function ExportPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      setBookings(await getBookings(bizId));
      setCustomers(await getCustomers(bizId));
      setExpenses(await getExpenses(bizId));
    } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const today = new Date().toISOString().split('T')[0];

  const exports = [
    { icon: '📅', title: 'תורים', desc: `${bookings.length} תורים · תאריך, לקוח, שירות, מחיר, סטטוס`, count: bookings.length, action: () => downloadCSV(bookingsToCSV(bookings), `zikkit-tor-${today}.csv`) },
    { icon: '👥', title: 'לקוחות', desc: `${customers.length} לקוחות · שם, טלפון, ביקורים, הוצאה, תגיות`, count: customers.length, action: () => downloadCSV(customersToCSV(customers), `zikkit-customers-${today}.csv`) },
    { icon: '💰', title: 'הוצאות', desc: `${expenses.length} הוצאות · תאריך, תיאור, קטגוריה, סכום`, count: expenses.length, action: () => downloadCSV(expensesToCSV(expenses), `zikkit-expenses-${today}.csv`) },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>ייצוא נתונים</Typography>
        <Box sx={{ width: 80 }} />
      </Box>

      <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 4, p: 2, mb: 3, display: 'flex', gap: 1.5, alignItems: 'center', boxShadow: c.shadowSm }}>
          <Box sx={{ fontSize: 22 }}>📊</Box>
          <Typography sx={{ fontSize: 12.5, color: c.text2, lineHeight: 1.5 }}>
            ייצא את הנתונים שלך כקובץ CSV — נפתח באקסל / Google Sheets. כולל תמיכה בעברית.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {exports.map((e) => (
            <Box key={e.title} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 4, p: 2.5, display: 'flex', alignItems: 'center', gap: 2, boxShadow: c.shadowSm }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: c.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{e.icon}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 15.5, fontWeight: 700, color: c.text }}>{e.title}</Typography>
                <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{e.desc}</Typography>
              </Box>
              <Button onClick={e.action} disabled={e.count === 0} variant="contained" sx={{ borderRadius: 2.5, fontWeight: 700, whiteSpace: 'nowrap' }}>⬇ CSV</Button>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 3, p: 2, bgcolor: c.surface2, borderRadius: 3 }}>
          <Typography sx={{ fontSize: 12, color: c.text3, lineHeight: 1.6 }}>
            💡 טיפ: גבה את הנתונים שלך מדי חודש. הקבצים נשמרים במכשיר שלך ולא נשלחים לשום מקום.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
