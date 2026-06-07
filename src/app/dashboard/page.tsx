'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreDb, doc, getDoc, BIZ_COLLECTION } from '@/lib/firebase';
import { zikkitColors as c } from '@/styles/theme';

interface Booking {
  id: string;
  customerName: string;
  service: string;
  date: string;
  time: string;
  duration: number;
  status: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { firebaseUser, user, bizId, loading, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bizName, setBizName] = useState('');
  const [danaPhone, setDanaPhone] = useState('');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !firebaseUser) router.push('/login');
  }, [loading, firebaseUser, router]);

  useEffect(() => {
    if (!bizId) return;
    (async () => {
      try {
        const db = getFirestoreDb();
        const snap = await getDoc(doc(db, BIZ_COLLECTION, bizId));
        if (snap.exists()) {
          const data = snap.data();
          setBizName(data.cfg?.biz_name || '');
          setDanaPhone(data.dana?.phoneNumber || '');
          setBookings((data.appointments?.bookings || []) as Booking[]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setDataLoading(false);
      }
    })();
  }, [bizId]);

  if (loading || dataLoading) {
    return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;
  }

  // Pending user - no appointments business yet
  if (user?.role === 'pending') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Box sx={{ textAlign: 'center', maxWidth: 460 }}>
          <Box sx={{ fontSize: 56, mb: 2 }}>👋</Box>
          <Typography sx={{ fontSize: 26, fontWeight: 800, color: c.text, mb: 1 }}>ברוך הבא ל-ZikkitAppointments</Typography>
          <Typography sx={{ fontSize: 15, color: c.text2, mb: 4 }}>בוא נקים את העסק שלך ונפעיל את דנה</Typography>
          <Button onClick={() => router.push('/setup')} variant="contained" size="large" sx={{ py: 2, px: 5, borderRadius: 3, fontWeight: 800 }}>
            הקם את העסק →
          </Button>
        </Box>
      </Box>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const todayBookings = bookings.filter((b) => b.date === today);
  const upcoming = bookings.filter((b) => b.date > today).slice(0, 10);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      {/* Header */}
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.surface1 }}>
        <Box>
          <Typography sx={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 800, color: c.text }}>{bizName || 'הדאשבורד שלי'}</Typography>
          <Typography sx={{ fontSize: 12, color: c.text3 }}>ZikkitAppointments</Typography>
        </Box>
        <Button onClick={() => logout()} sx={{ color: c.text2, fontWeight: 600 }}>יציאה</Button>
      </Box>

      <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
        {/* Dana number card */}
        <Box sx={{ bgcolor: c.surface1, border: `2px solid ${c.accent}`, borderRadius: 4, p: 3, mb: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: c.text3, fontWeight: 700, mb: 1 }}>מספר קביעת התורים שלך</Typography>
          {danaPhone ? (
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: c.accent, fontFamily: 'monospace' }}>{danaPhone}</Typography>
          ) : (
            <Button onClick={() => router.push('/setup')} variant="contained" sx={{ borderRadius: 3, fontWeight: 700 }}>הפעל את דנה</Button>
          )}
        </Box>

        {/* Feature navigation */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1.5, mb: 3 }}>
          {[
            { icon: '📅', label: 'יומן תורים', path: '/calendar' },
            { icon: '👥', label: 'לקוחות', path: '/customers' },
            { icon: '📊', label: 'דוחות כספיים', path: '/reports' },
            { icon: '⚙️', label: 'הגדרת דנה', path: '/setup' },
            { icon: '🕐', label: 'שעות פעילות', path: '/hours' },
            { icon: '🎓', label: 'קורסים ומוצרים', path: '/courses' },
            { icon: '🖼️', label: 'גלריית עבודות', path: '/gallery' },
            { icon: '💺', label: 'ניהול עמדות', path: '/stations' },
            { icon: '📈', label: 'יועץ AI', path: '/ai-studio' },
          ].map((t) => (
            <Box key={t.path} onClick={() => router.push(t.path)} sx={{ cursor: 'pointer', bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 2, textAlign: 'center', transition: 'all 0.2s', '&:hover': { borderColor: c.accent, transform: 'translateY(-2px)' } }}>
              <Box sx={{ fontSize: 28, mb: 0.5 }}>{t.icon}</Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text }}>{t.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
          {[
            { label: 'תורים היום', value: todayBookings.length },
            { label: 'תורים קרובים', value: upcoming.length },
            { label: 'סה"כ תורים', value: bookings.length },
          ].map((s, i) => (
            <Box key={i} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: c.accent }}>{s.value}</Typography>
              <Typography sx={{ fontSize: 13, color: c.text2 }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Today */}
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: c.text, mb: 2 }}>התורים של היום</Typography>
        {todayBookings.length === 0 ? (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, color: c.text3 }}>אין תורים היום</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4 }}>
            {todayBookings.sort((a, b) => a.time.localeCompare(b.time)).map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </Box>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: c.text, mb: 2, mt: 4 }}>תורים קרובים</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {upcoming.map((b) => <BookingRow key={b.id} booking={b} showDate />)}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

function BookingRow({ booking, showDate }: { booking: Booking; showDate?: boolean }) {
  return (
    <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.accent}`, borderRadius: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ textAlign: 'center', minWidth: 60 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: c.accent }}>{booking.time}</Typography>
        {showDate && <Typography sx={{ fontSize: 11, color: c.text3 }}>{booking.date}</Typography>}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{booking.customerName}</Typography>
        <Typography sx={{ fontSize: 13, color: c.text2 }}>{booking.service} · {booking.duration} דק'</Typography>
      </Box>
    </Box>
  );
}
