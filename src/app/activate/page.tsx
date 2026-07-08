'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/Toast';
import { loadBiz, getServices, getBranding, getBookings } from '@/lib/bizdata';
import { seedDemoData } from '@/lib/demo-data';
import { zikkitColors as c } from '@/styles/theme';

/**
 * Activation Checklist — shows the owner exactly what's needed to go fully live,
 * plus a one-click demo-data seeder for sales demonstrations. This is the
 * "sales readiness" cockpit: know what's missing, fill the system to demo it.
 */
interface CheckItem { key: string; label: string; desc: string; done: boolean; path: string; icon: string; }

export default function ActivatePage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<CheckItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [seedOpen, setSeedOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [hasDemo, setHasDemo] = useState(false);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const [biz, services, branding, bookings] = await Promise.all([
        loadBiz(bizId), getServices(bizId), getBranding(bizId), getBookings(bizId),
      ]);
      const cfg = (biz.cfg as Record<string, unknown>) || {};
      const dana = (biz.dana as Record<string, unknown>) || {};
      setHasDemo((biz as Record<string, unknown>)._demo === true);
      setItems([
        { key: 'biz', label: 'פרטי העסק', desc: 'שם, סוג וכתובת', done: Boolean(cfg.biz_name), path: '/settings', icon: '🏪' },
        { key: 'services', label: 'שירותים ומחירים', desc: 'לפחות שירות אחד', done: services.length > 0, path: '/services', icon: '✂️' },
        { key: 'hours', label: 'שעות פעילות', desc: 'מתי אפשר להזמין', done: Boolean(cfg.hours || biz.dana), path: '/hours', icon: '🕐' },
        { key: 'booking', label: 'דף הזמנות פעיל', desc: 'לקוחות יכולים להזמין', done: branding.enabled !== false, path: '/booking-page', icon: '🔗' },
        { key: 'bookings', label: 'תור ראשון', desc: 'קבע או קבל תור', done: bookings.length > 0, path: '/calendar', icon: '📅' },
        { key: 'dana', label: 'דנה — מענה טלפוני', desc: 'דורש הגדרת מפתחות', done: Boolean(dana.phoneNumber), path: '/setup', icon: '📞' },
        { key: 'payments', label: 'תשלומים (Grow)', desc: 'דורש הגדרת מפתחות ב-Vercel', done: false, path: '/billing', icon: '💳' },
      ]);
    } catch { /* ignore */ } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const seed = async () => {
    if (!bizId) return;
    setSeeding(true);
    try {
      await seedDemoData(bizId);
      showToast('נתוני דוגמה נוספו! המערכת מוכנה להדגמה', 'success');
      setSeedOpen(false);
      setTimeout(() => router.push('/dashboard'), 900);
    } catch (e) { showToast('שגיאה: ' + (e as Error).message, 'error'); } finally { setSeeding(false); }
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>מוכנות להפעלה</Typography>
        <Box sx={{ width: 60 }} />
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 640, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {/* Progress hero */}
        <Box sx={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accentDeep})`, borderRadius: 4, p: { xs: 3, sm: 3.5 }, mb: 3, color: '#fff' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, opacity: 0.9 }}>מוכנות העסק</Typography>
          <Typography sx={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, my: 0.5 }}>{pct}%</Typography>
          <Box sx={{ height: 8, bgcolor: 'rgba(255,255,255,0.25)', borderRadius: 99, overflow: 'hidden', mt: 1.5 }}>
            <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: '#fff', borderRadius: 99, transition: 'width 0.5s' }} />
          </Box>
          <Typography sx={{ fontSize: 13, opacity: 0.9, mt: 1.25 }}>{doneCount} מתוך {items.length} הושלמו</Typography>
        </Box>

        {/* Checklist */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 4 }}>
          {items.map((item) => (
            <Box key={item.key} onClick={() => router.push(item.path)} className="zk-card" sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.75, bgcolor: c.surface1, border: `1px solid ${item.done ? c.green + '44' : c.border2}`, borderRadius: 2.5, p: 2 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: item.done ? c.green : c.surface3, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: item.done ? 20 : 18, flexShrink: 0 }}>{item.done ? '✓' : item.icon}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{item.label}</Typography>
                <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{item.desc}</Typography>
              </Box>
              {item.done ? <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.green }}>הושלם</Typography> : <Box sx={{ color: c.accent, fontSize: 20, fontWeight: 700 }}>‹</Box>}
            </Box>
          ))}
        </Box>

        {/* Demo mode */}
        <Box sx={{ bgcolor: c.surface2, border: `1px dashed ${c.border2}`, borderRadius: 3, p: 2.5 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text, mb: 0.5 }}>🎬 מצב הדגמה</Typography>
          <Typography sx={{ fontSize: 13, color: c.text3, mb: 2, lineHeight: 1.5 }}>
            {hasDemo ? 'המערכת מכילה נתוני דוגמה. לניקוי — הגדרות → איפוס נתונים.' : 'רוצה להדגים את המערכת ללקוח? מלא אותה בתורים ולקוחות לדוגמה — כדי שתיראה חיה ופעילה. אפשר לנקות בכל רגע דרך ההגדרות.'}
          </Typography>
          {!hasDemo && <Button onClick={() => setSeedOpen(true)} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>מלא נתוני דוגמה</Button>}
        </Box>
      </Box>

      {/* Seed confirmation */}
      <Dialog open={seedOpen} onClose={() => !seeding && setSeedOpen(false)} PaperProps={{ sx: { bgcolor: c.surface1, borderRadius: 3, maxWidth: 400, m: 2 } }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ fontSize: 34, mb: 1.5 }}>🎬</Box>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: c.text, mb: 1 }}>מלא נתוני דוגמה?</Typography>
          <Typography sx={{ fontSize: 14, color: c.text2, mb: 2.5, lineHeight: 1.6 }}>המערכת תתמלא ב-12 לקוחות, שירותים ותורים לדוגמה (עבר ועתיד) — מושלם להדגמה. אפשר לנקות בכל רגע דרך הגדרות → איפוס נתונים.</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setSeedOpen(false)} disabled={seeding} fullWidth variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, color: c.text2, borderColor: c.border2 }}>ביטול</Button>
            <Button onClick={seed} disabled={seeding} fullWidth variant="contained" sx={{ borderRadius: 2, fontWeight: 700 }}>{seeding ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'מלא נתונים'}</Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}
