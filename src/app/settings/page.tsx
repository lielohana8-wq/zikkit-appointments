'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, TextField, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBizSettings, saveBizSettings, type BizSettings } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

const BIZ_TYPES = ['מספרה', 'מכון יופי', 'קוסמטיקה', 'ציפורניים', 'איפור', 'עיסוי', 'קליניקה', 'רופא שיניים', 'פיזיותרפיה', 'וטרינר', 'אופטיקה', 'אחר'];

export default function SettingsPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading, logout } = useAuth();
  const [s, setS] = useState<BizSettings | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    try { await saveBizSettings(bizId, s); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { alert('שגיאה: ' + (e as Error).message); }
    finally { setSaving(false); }
  };

  if (loading || dataLoading || !s) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</Typography>
      <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2.5, boxShadow: c.shadowSm }}>{children}</Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>הגדרות עסק</Typography>
        <Button onClick={save} variant="contained" disabled={saving} sx={{ borderRadius: 99, fontWeight: 700 }}>{saved ? '✓' : saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'שמור'}</Button>
      </Box>

      <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {/* Logo + name */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2.5, boxShadow: c.shadowSm }}>
          {s.logo ? <Box component="img" src={s.logo} sx={{ width: 64, height: 64, borderRadius: 3, objectFit: 'cover' }} /> : <Box sx={{ width: 64, height: 64, borderRadius: 3, background: `linear-gradient(135deg, ${c.accent}, ${c.accent2})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800 }}>{s.businessName?.[0] || '?'}</Box>}
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text }}>{s.businessName || 'העסק שלי'}</Typography>
            <Button component="label" size="small" sx={{ color: c.accent, fontWeight: 600, px: 0 }}>שנה לוגו<input type="file" accept="image/*" hidden onChange={handleLogo} /></Button>
          </Box>
        </Box>

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

        <Section title="העדפות">
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

        <Button onClick={save} variant="contained" fullWidth disabled={saving} sx={{ py: 1.75, borderRadius: 3, fontWeight: 700, mb: 3 }}>
          {saved ? '✓ נשמר!' : saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'שמור הגדרות'}
        </Button>

        {/* Danger zone */}
        <Box sx={{ borderTop: `1px solid ${c.border}`, pt: 3 }}>
          <Button onClick={() => logout()} fullWidth variant="outlined" sx={{ borderRadius: 3, fontWeight: 600, color: c.hot, borderColor: c.border2, '&:hover': { borderColor: c.hot, bgcolor: c.hotDim } }}>התנתק מהחשבון</Button>
        </Box>
      </Box>
    </Box>
  );
}
