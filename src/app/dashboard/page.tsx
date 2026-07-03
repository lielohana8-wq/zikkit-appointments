'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBizDocCached } from '@/lib/firebase';
import { getNotifications, markNotificationsRead, computeInsights, type AppNotification } from '@/lib/bizdata';
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
}

export default function DashboardPage() {
  const router = useRouter();
  const { firebaseUser, user, bizId, loading, logout, staffName } = useAuth();
  const { showToast } = useToast();
  const { mode: themeMode, toggle: toggleTheme } = useThemeMode();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [bizName, setBizName] = useState('');
  const [setupState, setSetupState] = useState({ hasServices: false, hasHours: false, bookingEnabled: false, hasBooking: false });
  const [danaPhone, setDanaPhone] = useState('');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !firebaseUser) { router.push('/login'); return; }
  }, [loading, firebaseUser, router]);

  useEffect(() => {
    if (!bizId) return;
    (async () => {
      try {
        const raw = await getBizDocCached(bizId);
        if (raw) {
          const data = raw as { cfg?: { biz_name?: string; hours?: unknown }; dana?: { phoneNumber?: string; services?: unknown[] }; hours?: unknown; booking?: { enabled?: boolean }; appointments?: { bookings?: unknown[] } };
          setBizName(data.cfg?.biz_name || '');
          setDanaPhone(data.dana?.phoneNumber || '');
          // Onboarding checklist state
          setSetupState({
            hasServices: ((data.dana?.services as unknown[]) || []).length > 0,
            hasHours: !!data.hours || !!data.cfg?.hours,
            bookingEnabled: data.booking?.enabled === true,
            hasBooking: ((data.appointments?.bookings as unknown[]) || []).length > 0,
          });
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
          }} variant="contained" size="large" sx={{ py: 1.75, px: 5, borderRadius: 1.5, fontWeight: 800 }}>
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
  // Today's expected revenue (from non-cancelled bookings today)
  const todayRevenue = todayBookings
    .filter((b) => b.status !== 'cancelled' && b.status !== 'no_show')
    .reduce((sum, b) => sum + (Number((b as { price?: number }).price) || 0), 0);
  // This week's completed revenue
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  const weekRevenue = bookings
    .filter((b) => b.date >= weekAgoStr && b.date <= today && b.status === 'completed')
    .reduce((sum, b) => sum + (Number((b as { price?: number }).price) || 0), 0);
  // Tomorrow's bookings — for one-tap WhatsApp reminders
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const tomorrowBookings = bookings.filter((b) => b.date === tomorrowStr && b.status !== 'cancelled');
  const insights = user?.role !== 'staff' ? computeInsights(bookings as never) : [];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      {/* Header */}
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <ZikkitLogo size={34} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text2, display: { xs: 'none', sm: 'block' } }}>{bizName}</Typography>
          <Button onClick={toggleTheme} sx={{ color: c.text3, fontWeight: 600, fontSize: 18, minWidth: 'auto', p: 0.5 }}>{themeMode === 'dark' ? '☀️' : '🌙'}</Button>
          <Button onClick={() => router.push('/settings')} sx={{ color: c.text3, fontWeight: 600, fontSize: 18, minWidth: 'auto', p: 0.5 }}>⚙️</Button>
          <Button onClick={() => logout()} sx={{ color: c.text3, fontWeight: 600, fontSize: 14, minWidth: 'auto' }}>יציאה</Button>
        </Box>
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 940, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: { xs: 3, sm: 5 } }}>
        {/* Greeting — editorial */}
        <Box sx={{ mb: 4 }}>
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
            .filter((b) => b.status !== 'cancelled' && (b.date > nowStr || (b.date === nowStr && b.time >= nowTime)))
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
        {notifs.filter((n) => !n.read).length > 0 && (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.5, mb: 3 }}>
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

        {/* Stats — editorial bordered block */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', mb: 4, border: `1.5px solid ${c.border}`, borderRadius: 2, overflow: 'hidden' }}>
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

        {/* Share booking link — drives bookings */}
        {setupState.bookingEnabled && bizId && (
          <Box sx={{ bgcolor: c.accentDim, border: `1px solid ${c.accentMid}`, borderRadius: 2, p: 2.5, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: 1.5, bgcolor: c.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🔗</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, color: c.accent, fontWeight: 700 }}>לינק ההזמנות שלך</Typography>
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{`${typeof window !== 'undefined' ? window.location.origin : ''}/book/${bizId}`}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1.75 }}>
              <Button onClick={() => { const url = `${window.location.origin}/book/${bizId}`; navigator.clipboard?.writeText(url); showToast('הלינק הועתק!', 'success'); }} variant="contained" size="small" sx={{ borderRadius: 2, fontWeight: 700, flex: 1 }}>📋 העתק</Button>
              <Button onClick={() => { const url = `${window.location.origin}/book/${bizId}`; window.open(`https://wa.me/?text=${encodeURIComponent('קבעו תור אצלי: ' + url)}`, '_blank'); }} variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 700, flex: 1, color: c.green, borderColor: c.border2 }}>💬 שתף בוואטסאפ</Button>
              <Button onClick={() => window.open(`/book/${bizId}`, '_blank')} variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 700, flex: 1 }}>👁 תצוגה</Button>
            </Box>
          </Box>
        )}

        {/* Tomorrow's reminders — one-tap WhatsApp, kills no-shows without any SMS provider */}
        {user?.role !== 'staff' && tomorrowBookings.length > 0 && (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.5, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text }}>⏰ תזכורות למחר</Typography>
                <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{tomorrowBookings.length} תורים · שלח תזכורת בלחיצה</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {tomorrowBookings.map((b, i) => {
                const bk = b as { customerName?: string; customerPhone?: string; service?: string; time: string; date: string; manageToken?: string };
                if (!bk.customerPhone) return null;
                const manageUrl = bk.manageToken && bizId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/manage/${bizId}/${bk.manageToken}` : undefined;
                const msg = messageTemplates.reminder({ bizName: bizName || 'העסק', customerName: bk.customerName, service: bk.service, date: bk.date, time: bk.time, manageUrl });
                return (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: c.surface2, borderRadius: 1.5, px: 1.75, py: 1.25 }}>
                    <Box sx={{ fontSize: 14, fontWeight: 800, color: c.accent, minWidth: 44 }}>{bk.time}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bk.customerName}</Typography>
                      <Typography sx={{ fontSize: 12, color: c.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bk.service}</Typography>
                    </Box>
                    <Button href={waLink(bk.customerPhone, msg)} target="_blank" size="small" variant="contained" sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12.5, bgcolor: '#25D366', '&:hover': { bgcolor: '#1EA952' }, whiteSpace: 'nowrap', flexShrink: 0 }}>💬 תזכורת</Button>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Dana add-on (subtle) */}
        {danaPhone ? (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.5, mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 1.5, bgcolor: c.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📞</Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 12, color: c.text3, fontWeight: 600 }}>מספר דנה — מענה אוטומטי</Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: c.text, fontFamily: 'monospace', letterSpacing: '-0.02em' }}>{danaPhone}</Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.5, mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 1.5, bgcolor: c.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📞</Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>דנה — מענה טלפוני אוטומטי</Typography>
              <Typography sx={{ fontSize: 12.5, color: c.text3 }}>אופציונלי · מישהי שעונה לטלפון וקובעת תורים 24/7</Typography>
            </Box>
            <Button onClick={() => router.push('/setup')} variant="outlined" size="small" sx={{ borderRadius: 2.5, fontWeight: 600, whiteSpace: 'nowrap' }}>הפעל</Button>
          </Box>
        )}

        {/* Onboarding checklist — only while incomplete */}
        {user?.role !== 'staff' && (() => {
          const steps = [
            { done: setupState.hasServices, label: 'הוסף שירותים ומחירים', path: '/services', icon: '📋' },
            { done: setupState.hasHours, label: 'הגדר שעות פעילות', path: '/hours', icon: '🕐' },
            { done: setupState.bookingEnabled, label: 'הפעל דף הזמנות', path: '/booking-page', icon: '🔗' },
            { done: setupState.hasBooking, label: 'קבל את התור הראשון', path: '/calendar', icon: '📅' },
          ];
          const doneCount = steps.filter((s) => s.done).length;
          if (doneCount === steps.length) return null;
          return (
            <Box sx={{ mb: 4, bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text }}>בוא נסיים את ההגדרה 🚀</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.accent }}>{doneCount}/{steps.length}</Typography>
              </Box>
              <Box sx={{ height: 6, bgcolor: c.surface3, borderRadius: 99, overflow: 'hidden', mb: 2.5 }}>
                <Box sx={{ width: `${(doneCount / steps.length) * 100}%`, height: '100%', background: `linear-gradient(to right, ${c.accent}, ${c.accent2})`, borderRadius: 99, transition: 'width 0.5s' }} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {steps.map((s) => (
                  <Box key={s.path} onClick={() => !s.done && router.push(s.path)} sx={{ cursor: s.done ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: 1.5, bgcolor: s.done ? 'transparent' : c.surface2, opacity: s.done ? 0.6 : 1, transition: 'all 0.2s', '&:hover': { bgcolor: s.done ? 'transparent' : c.surface3 } }}>
                    <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: s.done ? c.green : c.surface4, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{s.done ? '✓' : ''}</Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text, textDecoration: s.done ? 'line-through' : 'none', flex: 1 }}>{s.label}</Typography>
                    {!s.done && <Typography sx={{ fontSize: 18 }}>{s.icon}</Typography>}
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })()}

        {/* Smart insights */}
        {user?.role !== 'staff' && insights.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>תובנות חכמות</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {insights.slice(0, 3).map((ins, i) => (
                <Box key={i} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2 }}>
                  <Typography sx={{ fontSize: 13.5, color: c.text, fontWeight: 500 }}>{ins}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Feature navigation — organized by category */}
        {([
          {
            title: 'יומיומי',
            items: [
              { icon: '📅', label: 'יומן תורים', path: '/calendar', staff: true },
              { icon: '👥', label: 'לקוחות', path: '/customers', staff: true },
              { icon: '🔗', label: 'דף הזמנות', path: '/booking-page', staff: false },
              { icon: '🔔', label: 'רשימת המתנה', path: '/waitlist', staff: true },
              { icon: '📋', label: 'מחירון', path: '/services', staff: false },
            ],
          },
          {
            title: 'כספים',
            items: [
              { icon: '📊', label: 'דוחות', path: '/reports', staff: false },
              { icon: '📈', label: 'אנליטיקס', path: '/analytics', staff: false },
              { icon: '💰', label: 'רווחיות', path: '/expenses', staff: false },
              { icon: '🧾', label: 'קבלות', path: '/documents', staff: false },
              { icon: '📤', label: 'ייצוא', path: '/export-data', staff: false },
            ],
          },
          {
            title: 'שיווק וצמיחה',
            items: [
              { icon: '🎟️', label: 'מבצעים', path: '/promos', staff: false },
              { icon: '⭐', label: 'ביקורות', path: '/reviews', staff: false },
              { icon: '⚡', label: 'אוטומציות', path: '/automations', staff: false },
              { icon: '🤖', label: 'יועץ AI', path: '/ai-studio', staff: false },
            ],
          },
          {
            title: 'הגדרות העסק',
            items: [
              { icon: '📞', label: 'דנה', path: '/setup', staff: false },
              { icon: '💳', label: 'מנוי ותשלומים', path: '/billing', staff: false },
              { icon: '📨', label: 'בקשות פיילוט', path: '/pilot-requests', staff: false },
              { icon: '🧑‍🤝‍🧑', label: 'צוות', path: '/team', staff: false },
              { icon: '🕐', label: 'שעות', path: '/hours', staff: false },
              { icon: '🖼️', label: 'גלריה', path: '/gallery', staff: false },
              { icon: '🎓', label: 'קורסים', path: '/courses', staff: false },
              { icon: '⚙️', label: 'הגדרות', path: '/settings', staff: false },
            ],
          },
        ] as const).map((section) => {
          const ownerEmails = ['ohanaliel@gmail.com'];
          const isPlatformOwner = ownerEmails.includes((firebaseUser?.email || '').toLowerCase());
          const visible = section.items.filter((t) => {
            if (t.path === '/pilot-requests' && !isPlatformOwner) return false; // owner-only platform tile
            return user?.role !== 'staff' || t.staff;
          });
          if (visible.length === 0) return null;
          return (
            <Box key={section.title} sx={{ mb: 3.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.14em' }}>{section.title}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 0, border: `1.5px solid ${c.border}`, borderRadius: 2, overflow: 'hidden' }}>
                {visible.map((t, idx) => (
                  <Box key={t.path} onClick={() => router.push(t.path)} sx={{ cursor: 'pointer', bgcolor: c.surface1, borderRight: `1px solid ${c.border2}`, borderBottom: `1px solid ${c.border2}`, p: 2.25, transition: 'all 0.15s ease', position: 'relative', '&:hover': { bgcolor: c.text, '& .tile-label': { color: c.bg }, '& .tile-icon': { filter: 'grayscale(0)' } }, '&:active': { bgcolor: c.text } }}>
                    <Box className="tile-icon" sx={{ fontSize: 24, mb: 1, transition: 'all 0.15s' }}>{t.icon}</Box>
                    <Typography className="tile-label" sx={{ fontSize: 14, fontWeight: 700, color: c.text, transition: 'color 0.15s', letterSpacing: '-0.01em' }}>{t.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          );
        })}
        <Box sx={{ mb: 2 }} />

        {/* Today */}
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>התורים של היום</Typography>
        {todayBookings.length === 0 ? (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 5, textAlign: 'center' }}>
            <Box sx={{ fontSize: 32, mb: 1, opacity: 0.5 }}>☕</Box>
            <Typography sx={{ fontSize: 14, color: c.text3 }}>אין תורים היום</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 4 }}>
            {todayBookings.sort((a, b) => a.time.localeCompare(b.time)).map((b) => (
              <BookingRow key={b.id} booking={b} onClick={() => setSelectedBooking(b)} />
            ))}
          </Box>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, mt: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>תורים קרובים</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {upcoming.map((b) => <BookingRow key={b.id} booking={b} showDate onClick={() => setSelectedBooking(b)} />)}
            </Box>
          </>
        )}
      </Box>

      <BookingDetailDialog booking={selectedBooking as never} bizId={bizId} onClose={() => setSelectedBooking(null)} onChanged={() => window.location.reload()} />
      {user?.role !== 'staff' && <WelcomeWizard bizId={bizId} hasServices={setupState.hasServices} hasHours={setupState.hasHours} bookingEnabled={setupState.bookingEnabled} />}

      {/* Quick-add FAB */}
      <Box onClick={() => router.push('/calendar?add=1')} sx={{ position: 'fixed', bottom: 24, left: 24, width: 60, height: 60, borderRadius: '50%', bgcolor: c.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 300, cursor: 'pointer', boxShadow: `0 8px 28px ${c.accent}66`, zIndex: 50, transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)', '&:hover': { transform: 'scale(1.08) translateY(-2px)', boxShadow: `0 12px 36px ${c.accent}88` }, '&:active': { transform: 'scale(1.0)' } }}>+</Box>
    </Box>
  );
}

function BookingRow({ booking, showDate, onClick }: { booking: Booking; showDate?: boolean; onClick?: () => void }) {
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
      {onClick && <Box sx={{ color: c.text3, fontSize: 18 }}>‹</Box>}
    </Box>
  );
}
