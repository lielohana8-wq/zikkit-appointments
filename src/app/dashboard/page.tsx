'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreDb, doc, getDoc, BIZ_COLLECTION } from '@/lib/firebase';
import { getNotifications, markNotificationsRead, type AppNotification } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

interface Booking {
  id: string;
  customerName: string;
  service: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  staff?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { firebaseUser, user, bizId, loading, logout, staffName } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [bizName, setBizName] = useState('');
  const [danaPhone, setDanaPhone] = useState('');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !firebaseUser) { router.push('/login'); return; }
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
          let bks = (data.appointments?.bookings || []) as Booking[];
          if (user?.role === 'staff' && staffName) {
            bks = bks.filter((b) => b.staff === staffName);
          }
          setBookings(bks);
          // Load notifications (owner only)
          if (user?.role !== 'staff') {
            try { setNotifs(await getNotifications(bizId)); } catch { /* ignore */ }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setDataLoading(false);
      }
    })();
  }, [bizId, user?.role, staffName]);

  if (loading || dataLoading) {
    return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;
  }

  if (user?.role === 'pending') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Box sx={{ textAlign: 'center', maxWidth: 420 }}>
          <Box sx={{ fontSize: 56, mb: 2 }}>👋</Box>
          <Typography sx={{ fontSize: 24, fontWeight: 800, color: c.text, mb: 1 }}>ברוך הבא!</Typography>
          <Typography sx={{ fontSize: 14, color: c.text2, mb: 3 }}>בוא נקים את העסק שלך — לוקח 10 שניות</Typography>
          <Button onClick={async () => {
            if (!firebaseUser) return;
            const { getFirestoreDb: gdb, doc: d, setDoc: sd, BIZ_COLLECTION: bc } = await import('@/lib/firebase');
            await sd(d(gdb(), bc, firebaseUser.uid), {
              cfg: { biz_name: firebaseUser.email?.split('@')[0] || 'העסק שלי', lang: 'he', currency: 'ILS', region: 'IL', plan: 'trial' },
              appointments: { bookings: [], stations: 1 },
              created: new Date().toISOString(),
              ownerEmail: firebaseUser.email?.toLowerCase() || '',
            }, { merge: true });
            window.location.reload();
          }} variant="contained" size="large" sx={{ py: 1.75, px: 5, borderRadius: 3, fontWeight: 800 }}>
            צור את העסק שלי →
          </Button>
        </Box>
      </Box>
    );
  }

  // (legacy fallback retained below, no longer reached)
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
        {/* New booking notifications */}
        {notifs.filter((n) => !n.read).length > 0 && (
          <Box sx={{ bgcolor: c.accentDim, border: `1px solid ${c.accent}`, borderRadius: 4, p: 2.5, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.accent }}>🔔 {notifs.filter((n) => !n.read).length} התראות חדשות</Typography>
              <Button size="small" onClick={async () => { if (bizId) { await markNotificationsRead(bizId); setNotifs((p) => p.map((n) => ({ ...n, read: true }))); } }} sx={{ fontSize: 12, color: c.text2 }}>סמן הכל כנקרא</Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {notifs.filter((n) => !n.read).slice(0, 5).map((n) => (
                <Typography key={n.id} sx={{ fontSize: 13, color: c.text, bgcolor: c.surface1, borderRadius: 2, px: 1.5, py: 1 }}>{n.text}</Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Dana number card (optional add-on) */}
        {danaPhone ? (
          <Box sx={{ bgcolor: c.surface1, border: `2px solid ${c.accent}`, borderRadius: 4, p: 3, mb: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 12, color: c.text3, fontWeight: 700, mb: 1 }}>📞 מספר דנה (עונה אוטומטית)</Typography>
            <Typography sx={{ fontSize: 28, fontWeight: 800, color: c.accent, fontFamily: 'monospace' }}>{danaPhone}</Typography>
          </Box>
        ) : (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2.5, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ fontSize: 28 }}>📞</Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>דנה — מענה טלפוני אוטומטי (אופציונלי)</Typography>
              <Typography sx={{ fontSize: 12.5, color: c.text3 }}>רוצה שמישהי תענה לטלפון ותקבע תורים? הפעל את דנה. לא חובה.</Typography>
            </Box>
            <Button onClick={() => router.push('/setup')} variant="outlined" size="small" sx={{ borderRadius: 3, fontWeight: 700, whiteSpace: 'nowrap' }}>הפעל דנה</Button>
          </Box>
        )}

        {/* Feature navigation */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1.5, mb: 3 }}>
          {([
            { icon: '📅', label: 'יומן תורים', path: '/calendar', staff: true },
            { icon: '🔗', label: 'דף הזמנות', path: '/booking-page', staff: false },
            { icon: '📋', label: 'מחירון ושירותים', path: '/services', staff: false },
            { icon: '👥', label: 'לקוחות', path: '/customers', staff: true },
            { icon: '📊', label: 'דוחות כספיים', path: '/reports', staff: false },
            { icon: '⚡', label: 'אוטומציות', path: '/automations', staff: false },
            { icon: '📞', label: 'דנה (טלפון)', path: '/setup', staff: false },
            { icon: '🕐', label: 'שעות פעילות', path: '/hours', staff: false },
            { icon: '🎓', label: 'קורסים ומוצרים', path: '/courses', staff: false },
            { icon: '🖼️', label: 'גלריית עבודות', path: '/gallery', staff: false },
            { icon: '🧑‍🤝‍🧑', label: 'צוות ועמדות', path: '/team', staff: false },
            { icon: '📈', label: 'יועץ AI', path: '/ai-studio', staff: false },
          ].filter((t) => user?.role !== 'staff' || t.staff)).map((t) => (
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
