'use client';

/**
 * Dashboard — a daily cockpit, not a catalog.
 * Answers one question: "what's happening today and what's the next step".
 * Everything else lives one tap away in the "all tools" drawer.
 */

import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, CircularProgress, Drawer, TextField, Collapse } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBizDocCached } from '@/lib/firebase';
import { getNotifications, markNotificationsRead, computeInsights, type AppNotification } from '@/lib/bizdata';
import { findChurning } from '@/lib/revenue-engine';
import { ZikkitLogo } from '@/components/ZikkitLogo';
import { useThemeMode } from '@/components/ThemeMode';
import { BookingDetailDialog } from '@/components/BookingDetailDialog';
import { WelcomeWizard } from '@/components/WelcomeWizard';
import { useToast } from '@/components/Toast';
import { waLink, messageTemplates } from '@/lib/messaging';
import { zikkitColors as c } from '@/styles/theme';

interface Booking {
  id: string;
  customerName: string;
  customerPhone?: string;
  service: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  staff?: string;
  price?: number;
  manageToken?: string;
}
interface CustomerLite { id: string; name: string; phone: string; visits: number; lastVisit?: string; totalSpent: number; createdAt: string }

// Full tool catalog — lives behind the 🧰 drawer so the home stays a cockpit.
const ALL_TOOLS: Array<{ title: string; items: Array<{ icon: string; label: string; path: string; staff: boolean }> }> = [
  { title: 'יומיומי', items: [
    { icon: '📅', label: 'יומן תורים', path: '/calendar', staff: true },
    { icon: '👥', label: 'לקוחות', path: '/customers', staff: true },
    { icon: '🔗', label: 'דף הזמנות', path: '/booking-page', staff: false },
    { icon: '🔔', label: 'רשימת המתנה', path: '/waitlist', staff: true },
    { icon: '📋', label: 'המחירון והשירותים שלי', path: '/services', staff: true },
    { icon: '🛍️', label: 'מוצרים', path: '/products', staff: false },
  ]},
  { title: 'כספים', items: [
    { icon: '⚡', label: 'מנוע הכנסות', path: '/revenue', staff: false },
    { icon: '📊', label: 'דוחות', path: '/reports', staff: false },
    { icon: '📈', label: 'אנליטיקס', path: '/analytics', staff: false },
    { icon: '💰', label: 'רווחיות והוצאות', path: '/expenses', staff: false },
    { icon: '🧾', label: 'קבלות ומסמכים', path: '/documents', staff: false },
    { icon: '📤', label: 'ייצוא נתונים', path: '/export-data', staff: false },
  ]},
  { title: 'שיווק וצמיחה', items: [
    { icon: '📈', label: 'מרכז צמיחה', path: '/growth', staff: false },
    { icon: '🎨', label: 'סטודיו תוכן', path: '/ai-studio', staff: false },
    { icon: '🎟️', label: 'מבצעים', path: '/promos', staff: false },
    { icon: '⭐', label: 'ביקורות', path: '/reviews', staff: false },
    { icon: '⚡', label: 'אוטומציות', path: '/automations', staff: false },
  ]},
  { title: 'העסק והגדרות', items: [
    { icon: '🚀', label: 'מוכנות להפעלה', path: '/activate', staff: false },
    { icon: '📞', label: 'דנה — מענה טלפוני', path: '/setup', staff: false },
    { icon: '🕐', label: 'שעות פעילות', path: '/hours', staff: true },
    { icon: '🤝', label: 'צוות', path: '/team', staff: false },
    { icon: '🖼️', label: 'גלריה', path: '/gallery', staff: false },
    { icon: '🎓', label: 'קורסים', path: '/courses', staff: false },
    { icon: '💳', label: 'מנוי ותשלומים', path: '/billing', staff: false },
    { icon: '📨', label: 'בקשות פיילוט', path: '/pilot-requests', staff: false },
    { icon: '📲', label: 'התקן אפליקציה', path: '/app', staff: true },
    { icon: '⚙️', label: 'הגדרות', path: '/settings', staff: false },
  ]},
];

export default function DashboardPage() {
  const router = useRouter();
  const { firebaseUser, user, bizId, loading, logout, staffName } = useAuth();
  const { showToast } = useToast();
  const { mode: themeMode, toggle: toggleTheme } = useThemeMode();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [bizName, setBizName] = useState('');
  const [setupState, setSetupState] = useState({ hasServices: false, hasHours: false, bookingEnabled: false, hasBooking: false });
  const [danaPhone, setDanaPhone] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsQuery, setToolsQuery] = useState('');
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (!loading && !firebaseUser) { router.push('/login'); return; }
  }, [loading, firebaseUser, router]);

  useEffect(() => {
    if (!bizId) return;
    (async () => {
      try {
        const raw = await getBizDocCached(bizId);
        if (raw) {
          const data = raw as { cfg?: { biz_name?: string; hours?: unknown }; dana?: { phoneNumber?: string; services?: unknown[] }; hours?: unknown; booking?: { enabled?: boolean }; appointments?: { bookings?: unknown[] }; customers?: { items?: CustomerLite[] } };
          setBizName(data.cfg?.biz_name || '');
          setDanaPhone(data.dana?.phoneNumber || '');
          setSetupState({
            hasServices: ((data.dana?.services as unknown[]) || []).length > 0,
            hasHours: !!data.hours || !!data.cfg?.hours,
            bookingEnabled: data.booking?.enabled === true,
            hasBooking: ((data.appointments?.bookings as unknown[]) || []).length > 0,
          });
          let bks = (data.appointments?.bookings || []) as Booking[];
          if (user?.role === 'staff' && staffName) bks = bks.filter((b) => b.staff === staffName);
          setBookings(bks);
          setCustomers(data.customers?.items || []);
          if (user?.role !== 'staff') {
            try { setNotifs(await getNotifications(bizId)); } catch { /* ignore */ }
          }
        }
      } catch (e) { console.error(e); } finally { setDataLoading(false); }
    })();
  }, [bizId, user?.role, staffName]);

  const isStaff = user?.role === 'staff';
  const isPlatformOwner = ['ohanaliel@gmail.com'].includes((firebaseUser?.email || '').toLowerCase());

  const today = new Date().toISOString().split('T')[0];
  const todayBookings = bookings.filter((b) => b.date === today && b.status !== 'blocked');
  const upcoming = bookings.filter((b) => b.date > today && b.status !== 'blocked').slice(0, 5);
  const todayRevenue = todayBookings
    .filter((b) => b.status !== 'cancelled' && b.status !== 'no_show')
    .reduce((sum, b) => sum + (Number(b.price) || 0), 0);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  const weekRevenue = bookings
    .filter((b) => b.date >= weekAgoStr && b.date <= today && b.status === 'completed')
    .reduce((sum, b) => sum + (Number(b.price) || 0), 0);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const tomorrowBookings = bookings.filter((b) => b.date === tomorrowStr && b.status !== 'cancelled' && b.status !== 'blocked');

  // ===== Smart alerts — one compact row, max 3, straight from the engines =====
  const unreadNotifs = notifs.filter((n) => !n.read);
  const alerts = useMemo(() => {
    if (isStaff) return [] as Array<{ icon: string; text: string; onClick: () => void; hot?: boolean }>;
    const out: Array<{ icon: string; text: string; onClick: () => void; hot?: boolean }> = [];
    if (unreadNotifs.length > 0) out.push({ icon: '🔔', text: `${unreadNotifs.length} התראות חדשות`, onClick: () => setShowNotifs((v) => !v), hot: true });
    const pendingCount = bookings.filter((b) => b.status === 'pending' && b.date >= today).length;
    if (pendingCount > 0) out.push({ icon: '⏳', text: `${pendingCount} תורים ממתינים לאישור שלך`, onClick: () => router.push('/calendar'), hot: true });
    const steps = [setupState.hasServices, setupState.hasHours, setupState.bookingEnabled, setupState.hasBooking];
    const done = steps.filter(Boolean).length;
    if (done < steps.length) out.push({ icon: '🚀', text: `העסק מוכן ב-${Math.round((done / steps.length) * 100)}% — השלם את ההקמה`, onClick: () => router.push('/activate') });
    try {
      const churn = findChurning(customers as never, bookings as never);
      if (churn.length > 0) out.push({ icon: '🎯', text: `${churn.length} לקוחות בסיכון נטישה — החזר אותם`, onClick: () => router.push('/revenue') });
    } catch { /* engine is best-effort */ }
    if (tomorrowBookings.length > 0) out.push({ icon: '⏰', text: `${tomorrowBookings.length} תזכורות למחר — שלח בלחיצה`, onClick: () => setShowTomorrow((v) => !v) });
    if (!danaPhone) out.push({ icon: '🎙️', text: 'דנה כבויה — הפעל מענה 24/7', onClick: () => router.push('/setup') });
    const ins = computeInsights(bookings as never);
    if (ins.length > 0) out.push({ icon: '💡', text: ins[0], onClick: () => router.push('/reports') });
    return out.slice(0, 3);
  }, [isStaff, unreadNotifs.length, setupState, customers, bookings, today, tomorrowBookings.length, danaPhone, router]);

  // ===== Quick actions — 6 big thumb-friendly tiles =====
  const quickActions = (isStaff
    ? [
        { icon: '📅', label: 'יומן', onClick: () => router.push('/calendar') },
        { icon: '👥', label: 'לקוחות', onClick: () => router.push('/customers') },
        { icon: '🧰', label: 'כל הכלים', onClick: () => setToolsOpen(true) },
      ]
    : [
        { icon: '📅', label: 'יומן', onClick: () => router.push('/calendar') },
        { icon: '👥', label: 'לקוחות', onClick: () => router.push('/customers') },
        { icon: '⚡', label: 'מנוע הכנסות', onClick: () => router.push('/revenue') },
        { icon: '📈', label: 'מרכז צמיחה', onClick: () => router.push('/growth') },
        { icon: '🔗', label: 'לינק הזמנות', onClick: () => { const url = `${window.location.origin}/book/${bizId}`; navigator.clipboard?.writeText(url); showToast('הלינק הועתק — שלח ללקוחות!', 'success'); } },
        { icon: '🧰', label: 'כל הכלים', onClick: () => setToolsOpen(true) },
      ]);

  const filteredTools = ALL_TOOLS.map((sec) => ({
    ...sec,
    items: sec.items.filter((t) => {
      if (t.path === '/pilot-requests' && !isPlatformOwner) return false;
      if (isStaff && !t.staff) return false;
      if (toolsQuery.trim() && !t.label.includes(toolsQuery.trim())) return false;
      return true;
    }),
  })).filter((sec) => sec.items.length > 0);

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
          }} variant="contained" size="large" sx={{ py: 1.75, px: 5, borderRadius: 1.5, fontWeight: 800 }}>
            צור את העסק שלי →
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      {/* Header */}
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <ZikkitLogo size={34} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text2, display: { xs: 'none', sm: 'block' } }}>{bizName}</Typography>
          <Button onClick={() => setToolsOpen(true)} sx={{ color: c.text3, fontWeight: 600, fontSize: 18, minWidth: 'auto', p: 0.5 }}>🧰</Button>
          <Button onClick={toggleTheme} sx={{ color: c.text3, fontWeight: 600, fontSize: 18, minWidth: 'auto', p: 0.5 }}>{themeMode === 'dark' ? '☀️' : '🌙'}</Button>
          <Button onClick={() => router.push('/settings')} sx={{ color: c.text3, fontWeight: 600, fontSize: 18, minWidth: 'auto', p: 0.5 }}>⚙️</Button>
          {isPlatformOwner && (
            <Button onClick={() => router.push('/hq')} sx={{ color: '#fff', bgcolor: c.text, fontWeight: 800, fontSize: 12, minWidth: 'auto', px: 1.25, py: 0.5, borderRadius: 1, letterSpacing: '0.05em', '&:hover': { bgcolor: c.accent } }}>HQ</Button>
          )}
          <Button onClick={() => logout()} sx={{ color: c.text3, fontWeight: 600, fontSize: 14, minWidth: 'auto' }}>יציאה</Button>
        </Box>
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 940, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: { xs: 3, sm: 5 } }}>
        {/* Greeting */}
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.accent, textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1 }}>
            {(() => { const d = new Date(); return `${['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][d.getDay()]} · ${d.getDate()}.${d.getMonth()+1}`; })()}
          </Typography>
          <Typography sx={{ fontSize: { xs: 40, sm: 56 }, fontWeight: 900, color: c.text, letterSpacing: '-0.045em', lineHeight: 0.95 }}>
            {(() => { const h = new Date().getHours(); return h < 12 ? 'בוקר טוב' : h < 18 ? 'צהריים טובים' : 'ערב טוב'; })()}
          </Typography>
          <Typography sx={{ fontSize: 17, color: c.text2, mt: 1.5, fontWeight: 500 }}>{todayBookings.length > 0 ? `${todayBookings.length} תורים מחכים לך היום` : 'אין תורים היום — זמן טוב לקדם את העסק'}</Typography>
        </Box>

        {/* Quick search */}
        <Box onClick={() => { const e = new KeyboardEvent('keydown', { key: 'k', metaKey: true }); window.dispatchEvent(e); }} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 99, px: 2.5, py: 1.5, mb: 3, transition: 'all 0.2s', '&:hover': { borderColor: c.border2 } }}>
          <Box sx={{ fontSize: 18 }}>🔍</Box>
          <Typography sx={{ fontSize: 14.5, color: c.text3, flex: 1 }}>חיפוש לקוחות, תורים, עמודים...</Typography>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}><kbd style={{ background: 'var(--zk-surface3)', color: 'var(--zk-text3)', padding: '3px 8px', borderRadius: 2, fontSize: 11, fontWeight: 600 }}>⌘K</kbd></Box>
        </Box>

        {/* Next appointment — hero card */}
        {(() => {
          const now = new Date();
          const nowStr = now.toISOString().split('T')[0];
          const nowTime = now.toTimeString().slice(0, 5);
          const next = bookings
            .filter((b) => b.status !== 'cancelled' && b.status !== 'blocked' && (b.date > nowStr || (b.date === nowStr && b.time >= nowTime)))
            .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
          if (!next) return null;
          const isToday = next.date === nowStr;
          return (
            <Box onClick={() => setSelectedBooking(next)} sx={{ cursor: 'pointer', background: c.accent, borderRadius: 2, p: { xs: 2.5, sm: 3 }, mb: 3, color: '#fff', position: 'relative', overflow: 'hidden', transition: 'all 0.18s', '&:hover': { background: c.accent3 } }}>
              <Box sx={{ position: 'absolute', top: -30, left: -20, width: 140, height: 140, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)' }} />
              <Typography sx={{ fontSize: 12, opacity: 0.85, fontWeight: 600, position: 'relative', textTransform: 'uppercase', letterSpacing: '0.05em' }}>התור הבא</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, position: 'relative' }}>
                <Box sx={{ textAlign: 'center', bgcolor: 'rgba(255,255,255,0.18)', borderRadius: 1.5, px: 2, py: 1.25, minWidth: 72 }}>
                  <Typography sx={{ fontSize: 24, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>{next.time}</Typography>
                  <Typography sx={{ fontSize: 10.5, opacity: 0.85, mt: 0.25 }}>{isToday ? 'היום' : next.date.slice(5)}</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>{next.customerName}</Typography>
                  <Typography sx={{ fontSize: 13.5, opacity: 0.9 }}>{next.service || 'טיפול'}{next.staff ? ` · ${next.staff}` : ''}</Typography>
                </Box>
                {next.customerPhone && (
                  <Box component="a" href={`tel:${next.customerPhone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, textDecoration: 'none', flexShrink: 0 }}>📞</Box>
                )}
              </Box>
            </Box>
          );
        })()}

        {/* ===== Smart alerts — max 3, from the engines ===== */}
        {alerts.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
            {alerts.map((a, i) => (
              <Box key={i} onClick={a.onClick} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: a.hot ? c.accentDim : c.surface1, border: `1px solid ${a.hot ? c.accentMid : c.border2}`, borderRadius: 2, px: 2, py: 1.5, transition: 'all 0.15s', '&:hover': { borderColor: c.accent } }}>
                <Box sx={{ fontSize: 19 }}>{a.icon}</Box>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text, flex: 1 }}>{a.text}</Typography>
                <Box sx={{ color: c.accent, fontSize: 17, fontWeight: 700 }}>‹</Box>
              </Box>
            ))}
          </Box>
        )}

        {/* Notifications — expands from the 🔔 alert */}
        <Collapse in={showNotifs && unreadNotifs.length > 0}>
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {unreadNotifs.slice(0, 5).map((n) => (
                <Typography key={n.id} sx={{ fontSize: 13.5, color: c.text2, bgcolor: c.surface2, borderRadius: 2.5, px: 1.75, py: 1.25 }}>{n.text}</Typography>
              ))}
            </Box>
            <Button size="small" onClick={async () => { if (bizId) { await markNotificationsRead(bizId); setNotifs((p) => p.map((n) => ({ ...n, read: true }))); setShowNotifs(false); } }} sx={{ fontSize: 12.5, color: c.text3, mt: 1 }}>סמן הכל כנקרא</Button>
          </Box>
        </Collapse>

        {/* Tomorrow reminders — expands from the ⏰ alert */}
        <Collapse in={showTomorrow && tomorrowBookings.length > 0}>
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {tomorrowBookings.map((b, i) => {
                if (!b.customerPhone) return null;
                const manageUrl = b.manageToken && bizId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/manage/${bizId}/${b.manageToken}` : undefined;
                const msg = messageTemplates.reminder({ bizName: bizName || 'העסק', customerName: b.customerName, service: b.service, date: b.date, time: b.time, manageUrl });
                return (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: c.surface2, borderRadius: 1.5, px: 1.75, py: 1.25 }}>
                    <Box sx={{ fontSize: 14, fontWeight: 800, color: c.accent, minWidth: 44 }}>{b.time}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.customerName}</Typography>
                      <Typography sx={{ fontSize: 12, color: c.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.service}</Typography>
                    </Box>
                    <Button href={waLink(b.customerPhone, msg)} target="_blank" size="small" variant="contained" sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12.5, bgcolor: '#25D366', '&:hover': { bgcolor: '#1EA952' }, whiteSpace: 'nowrap', flexShrink: 0 }}>💬 תזכורת</Button>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Collapse>

        {/* Stats */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', mb: 3, border: `1.5px solid ${c.border}`, borderRadius: 2, overflow: 'hidden' }}>
          {[
            { label: 'תורים היום', value: String(todayBookings.length), accent: true },
            { label: 'צפי הכנסה היום', value: `₪${todayRevenue.toLocaleString()}`, accent: false },
            { label: 'הכנסה השבוע', value: `₪${weekRevenue.toLocaleString()}`, accent: false },
          ].map((s, i) => (
            <Box key={i} sx={{ bgcolor: s.accent ? c.accent : c.surface1, borderRight: i < 2 ? `1px solid ${s.accent || i === 0 ? c.accent : c.border2}` : 'none', p: { xs: 2, sm: 3 } }}>
              <Typography sx={{ fontSize: { xs: 28, sm: 38 }, fontWeight: 900, color: s.accent ? '#fff' : c.text, letterSpacing: '-0.04em', lineHeight: 0.9 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: 11.5, color: s.accent ? 'rgba(255,255,255,0.8)' : c.text3, mt: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* ===== 6 quick actions — big, thumb-friendly ===== */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: `repeat(${Math.min(quickActions.length, 6)}, 1fr)` }, gap: 1.25, mb: 4 }}>
          {quickActions.map((q) => (
            <Box key={q.label} onClick={q.onClick} className="zk-card" sx={{ cursor: 'pointer', bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2.5, py: 2.25, px: 1, textAlign: 'center', transition: 'all 0.15s', '&:hover': { borderColor: c.accent, transform: 'translateY(-2px)' }, '&:active': { transform: 'scale(0.98)' } }}>
              <Box sx={{ fontSize: 26, mb: 0.75 }}>{q.icon}</Box>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text, letterSpacing: '-0.01em' }}>{q.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Today */}
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>התורים של היום</Typography>
        {todayBookings.length === 0 ? (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 5, textAlign: 'center', mb: 4 }}>
            <Box sx={{ fontSize: 32, mb: 1, opacity: 0.5 }}>☕</Box>
            <Typography sx={{ fontSize: 14, color: c.text3 }}>אין תורים היום</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 4 }}>
            {todayBookings.sort((a, b) => a.time.localeCompare(b.time)).map((b) => (
              <BookingRow key={b.id} booking={b} bizName={bizName} onClick={() => setSelectedBooking(b)} />
            ))}
          </Box>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, mt: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>תורים קרובים</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {upcoming.map((b) => <BookingRow key={b.id} booking={b} bizName={bizName} showDate onClick={() => setSelectedBooking(b)} />)}
            </Box>
          </>
        )}
      </Box>

      {/* ===== All tools drawer ===== */}
      <Drawer anchor="bottom" open={toolsOpen} onClose={() => setToolsOpen(false)} PaperProps={{ sx: { bgcolor: c.bg, borderRadius: '20px 20px 0 0', maxHeight: '86vh', maxWidth: 720, mx: 'auto', width: '100%' } }}>
        <Box sx={{ p: { xs: 2.5, sm: 3 }, pb: 4 }}>
          <Box sx={{ width: 44, height: 5, borderRadius: 99, bgcolor: c.border2, mx: 'auto', mb: 2 }} />
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: c.text, mb: 1.5 }}>🧰 כל הכלים</Typography>
          <TextField fullWidth size="small" placeholder="חפש כלי..." value={toolsQuery} onChange={(e) => setToolsQuery(e.target.value)} sx={{ mb: 2 }} />
          <Box sx={{ overflowY: 'auto', maxHeight: '58vh' }}>
            {filteredTools.map((sec) => (
              <Box key={sec.title} sx={{ mb: 2.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: c.text3, mb: 1, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{sec.title}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1 }}>
                  {sec.items.map((t) => (
                    <Box key={t.path} onClick={() => { setToolsOpen(false); router.push(t.path); }} sx={{ cursor: 'pointer', bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, py: 1.75, px: 1, textAlign: 'center', transition: 'all 0.15s', '&:hover': { borderColor: c.accent } }}>
                      <Box sx={{ fontSize: 22, mb: 0.5 }}>{t.icon}</Box>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: c.text, lineHeight: 1.25 }}>{t.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
            {filteredTools.length === 0 && <Typography sx={{ fontSize: 14, color: c.text3, textAlign: 'center', py: 3 }}>לא נמצא כלי בשם הזה</Typography>}
          </Box>
        </Box>
      </Drawer>

      <BookingDetailDialog booking={selectedBooking as never} bizId={bizId} onClose={() => setSelectedBooking(null)} onChanged={() => window.location.reload()} />
      {!isStaff && <WelcomeWizard bizId={bizId} hasServices={setupState.hasServices} hasHours={setupState.hasHours} bookingEnabled={setupState.bookingEnabled} />}

      {/* Quick-add FAB */}
      <Box onClick={() => router.push('/calendar?add=1')} sx={{ position: 'fixed', bottom: 24, left: 24, width: 60, height: 60, borderRadius: '50%', bgcolor: c.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 300, cursor: 'pointer', boxShadow: `0 8px 28px ${c.accent}66`, zIndex: 50, transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)', '&:hover': { transform: 'scale(1.08) translateY(-2px)', boxShadow: `0 12px 36px ${c.accent}88` }, '&:active': { transform: 'scale(1.0)' } }}>+</Box>
    </Box>
  );
}

function BookingRow({ booking, bizName, showDate, onClick }: { booking: Booking; bizName?: string; showDate?: boolean; onClick?: () => void }) {
  const msg = booking.customerPhone ? messageTemplates.reminder({ bizName: bizName || 'העסק', customerName: booking.customerName, service: booking.service, date: booking.date, time: booking.time }) : '';
  return (
    <Box onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default', bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2, display: 'flex', alignItems: 'center', gap: 2, transition: 'all 0.15s', '&:hover': onClick ? { borderColor: c.border, bgcolor: c.surface2 } : {} }}>
      <Box sx={{ textAlign: 'center', minWidth: 56, bgcolor: c.accentDim, borderRadius: 1.5, py: 1, px: 1.25 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.accent, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{booking.time}</Typography>
        {showDate && <Typography sx={{ fontSize: 10.5, color: c.accent, opacity: 0.7 }}>{booking.date?.slice(5)}</Typography>}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{booking.customerName}</Typography>
        <Typography sx={{ fontSize: 13, color: c.text3 }}>{booking.service || 'טיפול'}{booking.staff ? ` · ${booking.staff}` : ''} · {booking.duration} דק'</Typography>
      </Box>
      {booking.customerPhone && (
        <Box component="a" href={waLink(booking.customerPhone, msg)} target="_blank" onClick={(e: React.MouseEvent) => e.stopPropagation()} sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: '#25D36622', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, textDecoration: 'none', flexShrink: 0 }}>💬</Box>
      )}
      {onClick && <Box sx={{ color: c.text3, fontSize: 18 }}>‹</Box>}
    </Box>
  );
}
