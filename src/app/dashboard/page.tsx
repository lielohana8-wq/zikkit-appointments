'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreDb, doc, getDoc, BIZ_COLLECTION } from '@/lib/firebase';
import { getNotifications, markNotificationsRead, computeInsights, type AppNotification } from '@/lib/bizdata';
import { ZikkitLogo } from '@/components/ZikkitLogo';
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
  const insights = user?.role !== 'staff' ? computeInsights(bookings as never) : [];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      {/* Header */}
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <ZikkitLogo size={34} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text2, display: { xs: 'none', sm: 'block' } }}>{bizName}</Typography>
          <Button onClick={() => router.push('/settings')} sx={{ color: c.text3, fontWeight: 600, fontSize: 18, minWidth: 'auto', p: 0.5 }}>⚙️</Button>
          <Button onClick={() => logout()} sx={{ color: c.text3, fontWeight: 600, fontSize: 14, minWidth: 'auto' }}>יציאה</Button>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 940, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: { xs: 3, sm: 5 } }}>
        {/* Greeting */}
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: { xs: 28, sm: 34 }, fontWeight: 800, color: c.text, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            {(() => { const h = new Date().getHours(); return h < 12 ? 'בוקר טוב' : h < 18 ? 'צהריים טובים' : 'ערב טוב'; })()} 👋
          </Typography>
          <Typography sx={{ fontSize: 16, color: c.text3, mt: 0.5 }}>{todayBookings.length > 0 ? `יש לך ${todayBookings.length} תורים היום` : 'אין תורים היום — זמן טוב לקדם את העסק'}</Typography>
        </Box>

        {/* New booking notifications */}
        {notifs.filter((n) => !n.read).length > 0 && (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 5, p: 2.5, mb: 3, boxShadow: c.shadowSm }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.accent, animation: 'pulse 2s infinite' }} />
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>{notifs.filter((n) => !n.read).length} התראות חדשות</Typography>
              </Box>
              <Button size="small" onClick={async () => { if (bizId) { await markNotificationsRead(bizId); setNotifs((p) => p.map((n) => ({ ...n, read: true }))); } }} sx={{ fontSize: 12.5, color: c.text3 }}>סמן הכל כנקרא</Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {notifs.filter((n) => !n.read).slice(0, 5).map((n) => (
                <Typography key={n.id} sx={{ fontSize: 13.5, color: c.text2, bgcolor: c.surface2, borderRadius: 2.5, px: 1.75, py: 1.25 }}>{n.text}</Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Stats — premium cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: { xs: 1.5, sm: 2 }, mb: 4 }}>
          {[
            { label: 'תורים היום', value: todayBookings.length, accent: true },
            { label: 'תורים קרובים', value: upcoming.length, accent: false },
            { label: 'סה"כ תורים', value: bookings.length, accent: false },
          ].map((s, i) => (
            <Box key={i} sx={{ bgcolor: s.accent ? c.accent : c.surface1, border: `1px solid ${s.accent ? c.accent : c.border}`, borderRadius: 5, p: { xs: 2, sm: 3 }, boxShadow: c.shadowSm }}>
              <Typography sx={{ fontSize: { xs: 30, sm: 38 }, fontWeight: 800, color: s.accent ? '#fff' : c.text, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: 13, color: s.accent ? 'rgba(255,255,255,0.85)' : c.text3, mt: 0.5, fontWeight: 500 }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Dana add-on (subtle) */}
        {danaPhone ? (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 5, p: 2.5, mb: 4, display: 'flex', alignItems: 'center', gap: 2, boxShadow: c.shadowSm }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: c.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📞</Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 12, color: c.text3, fontWeight: 600 }}>מספר דנה — מענה אוטומטי</Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: c.text, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>{danaPhone}</Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 5, p: 2.5, mb: 4, display: 'flex', alignItems: 'center', gap: 2, boxShadow: c.shadowSm }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: c.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📞</Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>דנה — מענה טלפוני אוטומטי</Typography>
              <Typography sx={{ fontSize: 12.5, color: c.text3 }}>אופציונלי · מישהי שעונה לטלפון וקובעת תורים 24/7</Typography>
            </Box>
            <Button onClick={() => router.push('/setup')} variant="outlined" size="small" sx={{ borderRadius: 2.5, fontWeight: 600, whiteSpace: 'nowrap' }}>הפעל</Button>
          </Box>
        )}

        {/* Smart insights */}
        {user?.role !== 'staff' && insights.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>תובנות חכמות</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {insights.slice(0, 3).map((ins, i) => (
                <Box key={i} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2, boxShadow: c.shadowSm }}>
                  <Typography sx={{ fontSize: 13.5, color: c.text, fontWeight: 500 }}>{ins}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Feature navigation — premium tiles */}
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>ניהול העסק</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: { xs: 1.5, sm: 2 }, mb: 5 }}>
          {([
            { icon: '📅', label: 'יומן תורים', path: '/calendar', staff: true },
            { icon: '🔗', label: 'דף הזמנות', path: '/booking-page', staff: false },
            { icon: '📋', label: 'מחירון', path: '/services', staff: false },
            { icon: '👥', label: 'לקוחות', path: '/customers', staff: true },
            { icon: '📊', label: 'דוחות', path: '/reports', staff: false },
            { icon: '🧾', label: 'קבלות', path: '/documents', staff: false },
            { icon: '⚡', label: 'אוטומציות', path: '/automations', staff: false },
            { icon: '📞', label: 'דנה', path: '/setup', staff: false },
            { icon: '🕐', label: 'שעות', path: '/hours', staff: false },
            { icon: '🎓', label: 'קורסים', path: '/courses', staff: false },
            { icon: '🖼️', label: 'גלריה', path: '/gallery', staff: false },
            { icon: '🧑‍🤝‍🧑', label: 'צוות', path: '/team', staff: false },
            { icon: '📈', label: 'יועץ AI', path: '/ai-studio', staff: false },
            { icon: '⚙️', label: 'הגדרות', path: '/settings', staff: false },
          ].filter((t) => user?.role !== 'staff' || t.staff)).map((t) => (
            <Box key={t.path} onClick={() => router.push(t.path)} sx={{ cursor: 'pointer', bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2.25, transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)', boxShadow: c.shadowSm, '&:hover': { transform: 'translateY(-3px)', boxShadow: c.shadowMd, borderColor: c.border2 }, '&:active': { transform: 'translateY(-1px)' } }}>
              <Box sx={{ fontSize: 26, mb: 1 }}>{t.icon}</Box>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: c.text }}>{t.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Today */}
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>התורים של היום</Typography>
        {todayBookings.length === 0 ? (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 5, p: 5, textAlign: 'center', boxShadow: c.shadowSm }}>
            <Box sx={{ fontSize: 32, mb: 1, opacity: 0.5 }}>☕</Box>
            <Typography sx={{ fontSize: 14, color: c.text3 }}>אין תורים היום</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 4 }}>
            {todayBookings.sort((a, b) => a.time.localeCompare(b.time)).map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </Box>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, mt: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>תורים קרובים</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
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
    <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2, display: 'flex', alignItems: 'center', gap: 2, boxShadow: c.shadowSm, transition: 'all 0.2s', '&:hover': { boxShadow: c.shadowMd } }}>
      <Box sx={{ textAlign: 'center', minWidth: 56, bgcolor: c.accentDim, borderRadius: 3, py: 1, px: 1.25 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.accent, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{booking.time}</Typography>
        {showDate && <Typography sx={{ fontSize: 10.5, color: c.accent, opacity: 0.7 }}>{booking.date?.slice(5)}</Typography>}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{booking.customerName}</Typography>
        <Typography sx={{ fontSize: 13, color: c.text3 }}>{booking.service || 'טיפול'}{booking.staff ? ` · ${booking.staff}` : ''} · {booking.duration} דק'</Typography>
      </Box>
    </Box>
  );
}
