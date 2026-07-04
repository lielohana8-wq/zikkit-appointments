'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, TextField, MenuItem, Switch, Dialog } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBizSettings, saveBizSettings, resetBusiness, type BizSettings } from '@/lib/bizdata';
import { useToast } from '@/components/Toast';
import { useThemeMode } from '@/components/ThemeMode';
import { zikkitColors as c } from '@/styles/theme';

const BIZ_TYPES = ['מספרה', 'מכון יופי', 'קוסמטיקה', 'ציפורניים', 'איפור', 'עיסוי', 'קליניקה', 'רופא שיניים', 'פיזיותרפיה', 'וטרינר', 'אופטיקה', 'אחר'];

// All settings areas, grouped into categories with icons.
const CATEGORIES: Array<{ title: string; icon: string; items: Array<{ icon: string; label: string; desc: string; path: string }> }> = [
  {
    title: 'העסק', icon: '🏪',
    items: [
      { icon: '🕐', label: 'שעות פעילות', desc: 'מתי העסק פתוח ומתי אפשר להזמין', path: '/hours' },
      { icon: '👥', label: 'צוות ועובדים', desc: 'ניהול אנשי הצוות והרשאות', path: '/team' },
      { icon: '🪑', label: 'עמדות', desc: 'מספר עמדות עבודה במקביל', path: '/stations' },
    ],
  },
  {
    title: 'הזמנות ולקוחות', icon: '📅',
    items: [
      { icon: '🔗', label: 'דף הזמנות', desc: 'עיצוב הדף, מקדמות, גלריה ומבצעים', path: '/booking-page' },
      { icon: '✂️', label: 'שירותים ומחירים', desc: 'השירותים שלקוחות יכולים להזמין', path: '/services' },
      { icon: '🖼️', label: 'גלריית עבודות', desc: 'תמונות שיוצגו בדף ההזמנות', path: '/gallery' },
    ],
  },
  {
    title: 'אוטומציה ו-AI', icon: '🤖',
    items: [
      { icon: '📞', label: 'דנה — מענה טלפוני', desc: 'הגדרת המזכירה החכמה שעונה 24/7', path: '/setup' },
      { icon: '⚡', label: 'אוטומציות', desc: 'תזכורות והודעות אוטומטיות', path: '/automations' },
      { icon: '🧠', label: 'סטודיו AI', desc: 'כלי AI לשיווק ותוכן', path: '/ai-studio' },
    ],
  },
  {
    title: 'עסקי ותשלומים', icon: '💳',
    items: [
      { icon: '💳', label: 'מנוי ותשלומים', desc: 'התוכנית שלך וניהול התשלום', path: '/billing' },
      { icon: '🧾', label: 'חשבוניות וקבלות', desc: 'הפקת מסמכים ללקוחות', path: '/documents' },
      { icon: '📤', label: 'ייצוא נתונים', desc: 'הורדת כל הנתונים שלך', path: '/export-data' },
    ],
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading, logout } = useAuth();
  const { showToast } = useToast();
  const { mode: themeMode, toggle: toggleTheme } = useThemeMode();
  const [s, setS] = useState<BizSettings | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetScope, setResetScope] = useState<'activity' | 'full'>('activity');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try { setS(await getBizSettings(bizId)); } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof BizSettings>(k: K, v: BizSettings[K]) => setS((p) => p ? { ...p, [k]: v } : p);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !s) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, 240 / img.width);
        const cv = document.createElement('canvas'); cv.width = img.width * sc; cv.height = img.height * sc;
        cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
        set('logo', cv.toDataURL('image/jpeg', 0.75));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!bizId || !s) return;
    setSaving(true);
    try { await saveBizSettings(bizId, s); setSaved(true); setTimeout(() => setSaved(false), 2000); showToast('ההגדרות נשמרו', 'success'); }
    catch (e) { showToast('שגיאה: ' + (e as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const openReset = (scope: 'activity' | 'full') => { setResetScope(scope); setResetConfirm(''); setResetOpen(true); };

  const doReset = async () => {
    if (!bizId) return;
    setResetting(true);
    try {
      await resetBusiness(bizId, resetScope);
      showToast(resetScope === 'activity' ? 'הנתונים אופסו — העסק נקי' : 'העסק אופס לחלוטין', 'success');
      setResetOpen(false);
      setTimeout(() => router.push(resetScope === 'full' ? '/onboarding' : '/dashboard'), 800);
    } catch (e) { showToast('שגיאה: ' + (e as Error).message, 'error'); }
    finally { setResetting(false); }
  };

  if (loading || dataLoading || !s) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const confirmWord = resetScope === 'full' ? 'איפוס מלא' : 'איפוס';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>הגדרות</Typography>
        <Button onClick={save} variant="contained" disabled={saving} sx={{ borderRadius: 99, fontWeight: 700 }}>{saved ? '✓' : saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'שמור'}</Button>
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 680, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {/* Logo + name quick edit */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.5 }}>
          {s.logo ? <Box component="img" src={s.logo} sx={{ width: 64, height: 64, borderRadius: 2, objectFit: 'cover' }} /> : <Box sx={{ width: 64, height: 64, borderRadius: 2, bgcolor: c.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800 }}>{s.businessName?.[0] || '?'}</Box>}
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text }}>{s.businessName || 'העסק שלי'}</Typography>
            <Button component="label" size="small" sx={{ color: c.accent, fontWeight: 600, px: 0 }}>שנה לוגו<input type="file" accept="image/*" hidden onChange={handleLogo} /></Button>
          </Box>
          <Button onClick={() => router.push('/onboarding')} variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 700, whiteSpace: 'nowrap' }}>אשף הקמה</Button>
        </Box>

        {/* Quick business details */}
        <Section title="פרטי העסק">
          <TextField fullWidth size="small" label="שם העסק" value={s.businessName} onChange={(e) => set('businessName', e.target.value)} sx={{ mb: 2 }} />
          <TextField select fullWidth size="small" label="סוג העסק" value={s.businessType} onChange={(e) => set('businessType', e.target.value)} sx={{ mb: 2 }}>
            {BIZ_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField fullWidth size="small" label="עיר" value={s.city} onChange={(e) => set('city', e.target.value)} />
            <TextField fullWidth size="small" label="כתובת" value={s.address} onChange={(e) => set('address', e.target.value)} />
          </Box>
        </Section>

        <Section title="פרטי בעל העסק">
          <TextField fullWidth size="small" label="שם מלא" value={s.ownerName} onChange={(e) => set('ownerName', e.target.value)} sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField fullWidth size="small" label="טלפון" value={s.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} />
            <TextField fullWidth size="small" label="אימייל" value={s.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} />
          </Box>
        </Section>

        {/* Categorized settings hub */}
        {CATEGORIES.map((cat) => (
          <Box key={cat.title} sx={{ mb: 3.5 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <span>{cat.icon}</span>{cat.title}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {cat.items.map((item) => (
                <Box key={item.path} onClick={() => router.push(item.path)} className="zk-card" sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.75, bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2.5, p: 2 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: c.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flexShrink: 0 }}>{item.icon}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{item.label}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{item.desc}</Typography>
                  </Box>
                  <Box sx={{ color: c.text3, fontSize: 20, fontWeight: 700, flexShrink: 0 }}>‹</Box>
                </Box>
              ))}
            </Box>
          </Box>
        ))}

        {/* Preferences */}
        <Section title="העדפות">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, pb: 2, borderBottom: `1px solid ${c.border}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ fontSize: 20 }}>{themeMode === 'dark' ? '🌙' : '☀️'}</Box>
              <Box>
                <Typography sx={{ fontSize: 14.5, fontWeight: 600, color: c.text }}>מצב כהה</Typography>
                <Typography sx={{ fontSize: 12, color: c.text3 }}>{themeMode === 'dark' ? 'פעיל' : 'כבוי'}</Typography>
              </Box>
            </Box>
            <Switch checked={themeMode === 'dark'} onChange={toggleTheme} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
            <TextField select fullWidth size="small" label="מטבע" value={s.currency} onChange={(e) => set('currency', e.target.value)}>
              <MenuItem value="ILS">₪ שקל</MenuItem>
              <MenuItem value="USD">$ דולר</MenuItem>
              <MenuItem value="EUR">€ אירו</MenuItem>
            </TextField>
            <TextField select fullWidth size="small" label="משך תור ברירת מחדל" value={s.defaultDuration} onChange={(e) => set('defaultDuration', Number(e.target.value))}>
              {[15, 30, 45, 60].map((d) => <MenuItem key={d} value={d}>{d} דק'</MenuItem>)}
            </TextField>
          </Box>
          <TextField fullWidth size="small" label="מדיניות ביטול" value={s.cancellationPolicy} onChange={(e) => set('cancellationPolicy', e.target.value)} multiline rows={2} placeholder="למשל: ביטול עד 24 שעות לפני התור" />
        </Section>

        <Button onClick={save} variant="contained" fullWidth disabled={saving} sx={{ py: 1.75, borderRadius: 2, fontWeight: 700, mb: 3 }}>
          {saved ? '✓ נשמר!' : saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'שמור הגדרות'}
        </Button>

        {/* Danger zone */}
        <Box sx={{ borderTop: `1px solid ${c.hot}33`, mt: 2, pt: 3 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: c.hot, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚠️ אזור מסוכן</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, bgcolor: c.surface1, border: `1px solid ${c.hot}33`, borderRadius: 2.5, p: 2 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: c.text }}>איפוס נתונים</Typography>
                <Typography sx={{ fontSize: 12.5, color: c.text3 }}>מוחק תורים, לקוחות והוצאות. שומר שירותים, שעות ודף הזמנות.</Typography>
              </Box>
              <Button onClick={() => openReset('activity')} variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 700, color: c.hot, borderColor: `${c.hot}55`, whiteSpace: 'nowrap' }}>אפס</Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, bgcolor: c.surface1, border: `1px solid ${c.hot}33`, borderRadius: 2.5, p: 2 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: c.text }}>איפוס עסק מלא</Typography>
                <Typography sx={{ fontSize: 12.5, color: c.text3 }}>מוחק את הכל ומתחיל מאפס — כמו עסק חדש.</Typography>
              </Box>
              <Button onClick={() => openReset('full')} variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 700, color: c.hot, borderColor: `${c.hot}55`, whiteSpace: 'nowrap' }}>אפס הכל</Button>
            </Box>
          </Box>
          <Button onClick={() => logout()} fullWidth variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, color: c.text2, borderColor: c.border2 }}>התנתק מהחשבון</Button>
        </Box>
      </Box>

      {/* Reset confirmation dialog */}
      <Dialog open={resetOpen} onClose={() => !resetting && setResetOpen(false)} PaperProps={{ sx: { bgcolor: c.surface1, borderRadius: 3, maxWidth: 420, m: 2 } }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ width: 52, height: 52, borderRadius: '50%', bgcolor: c.hotDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, mb: 2 }}>⚠️</Box>
          <Typography sx={{ fontSize: 19, fontWeight: 800, color: c.text, mb: 1 }}>{resetScope === 'full' ? 'איפוס עסק מלא' : 'איפוס נתונים'}</Typography>
          <Typography sx={{ fontSize: 14, color: c.text2, mb: 2, lineHeight: 1.6 }}>
            {resetScope === 'full'
              ? 'פעולה זו תמחק את כל הנתונים — תורים, לקוחות, שירותים, שעות, דף הזמנות — ותחזיר את העסק למצב חדש לחלוטין. לא ניתן לשחזר.'
              : 'פעולה זו תמחק את כל התורים, הלקוחות, ההוצאות והביקורות. השירותים, השעות ודף ההזמנות יישמרו. לא ניתן לשחזר.'}
          </Typography>
          <Typography sx={{ fontSize: 13, color: c.text3, mb: 1 }}>הקלד <b style={{ color: c.hot }}>{confirmWord}</b> לאישור:</Typography>
          <TextField fullWidth size="small" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder={confirmWord} sx={{ mb: 2.5 }} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setResetOpen(false)} disabled={resetting} fullWidth variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, color: c.text2, borderColor: c.border2 }}>ביטול</Button>
            <Button onClick={doReset} disabled={resetConfirm !== confirmWord || resetting} fullWidth variant="contained" sx={{ borderRadius: 2, fontWeight: 700, bgcolor: c.hot, '&:hover': { bgcolor: c.hot, filter: 'brightness(0.9)' } }}>
              {resetting ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : resetScope === 'full' ? 'אפס הכל' : 'אפס'}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</Typography>
      <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.5 }}>{children}</Box>
    </Box>
  );
}

const Section = SettingsSection;
