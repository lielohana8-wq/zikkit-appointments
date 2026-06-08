'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, TextField, Switch } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBranding, saveBranding, type BookingBranding } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

const COLORS = ['#9333EA', '#EC4899', '#06B6D4', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#1C1917'];

export default function BookingPageSettings() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [branding, setBranding] = useState<BookingBranding | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);
  useEffect(() => { if (typeof window !== 'undefined') setBaseUrl(window.location.origin); }, []);

  const load = useCallback(async () => {
    if (!bizId) return;
    try { setBranding(await getBranding(bizId)); } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  const handleImage = (field: 'logo' | 'banner', maxW: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setBranding((p) => p ? { ...p, [field]: canvas.toDataURL('image/jpeg', 0.7) } : p);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!bizId || !branding) return;
    setSaving(true);
    try { await saveBranding(bizId, branding); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    finally { setSaving(false); }
  };

  const bookingUrl = bizId ? `${baseUrl}/book/${bizId}` : '';

  if (loading || dataLoading || !branding) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.surface1 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 800, color: c.text }}>דף הזמנות ללקוחות</Typography>
        <Box sx={{ width: 60 }} />
      </Box>

      <Box sx={{ maxWidth: 560, mx: 'auto', p: 3 }}>
        {/* Enable toggle */}
        <Box sx={{ bgcolor: branding.enabled ? c.accentDim : c.surface1, border: `2px solid ${branding.enabled ? c.accent : c.border}`, borderRadius: 4, p: 3, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ fontSize: 32 }}>{branding.enabled ? '🟢' : '⚪'}</Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text }}>{branding.enabled ? 'דף ההזמנות פעיל' : 'דף ההזמנות כבוי'}</Typography>
            <Typography sx={{ fontSize: 13, color: c.text2 }}>{branding.enabled ? 'לקוחות יכולים לקבוע תורים דרך הלינק' : 'הפעל כדי שלקוחות יוכלו להזמין'}</Typography>
          </Box>
          <Switch checked={branding.enabled} onChange={(e) => setBranding((p) => p ? { ...p, enabled: e.target.checked } : p)} />
        </Box>

        {/* Share link */}
        {branding.enabled && (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 2.5, mb: 3 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.text3, mb: 1 }}>🔗 הלינק שלך לשיתוף</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography sx={{ flex: 1, fontSize: 13, color: c.accent, fontWeight: 600, wordBreak: 'break-all', fontFamily: 'monospace' }}>{bookingUrl}</Typography>
              <Button onClick={() => navigator.clipboard.writeText(bookingUrl)} size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, minWidth: 'auto' }}>העתק</Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
              <Button href={bookingUrl} target="_blank" size="small" sx={{ color: c.accent, fontWeight: 700 }}>👁️ תצוגה מקדימה</Button>
              <Button href={`https://wa.me/?text=${encodeURIComponent('קבעו תור אצלנו: ' + bookingUrl)}`} target="_blank" size="small" sx={{ color: '#25D366', fontWeight: 700 }}>שתף בוואטסאפ</Button>
            </Box>
          </Box>
        )}

        {/* Design */}
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text, mb: 2 }}>🎨 עיצוב הדף</Typography>

        {/* Logo */}
        <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 2.5, mb: 2 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text, mb: 1.5 }}>לוגו</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {branding.logo ? <Box component="img" src={branding.logo} sx={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover' }} /> : <Box sx={{ width: 60, height: 60, borderRadius: '50%', bgcolor: c.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🖼️</Box>}
            <Button component="label" variant="outlined" sx={{ borderRadius: 2, fontWeight: 600 }}>העלה לוגו<input type="file" accept="image/*" hidden onChange={handleImage('logo', 200)} /></Button>
            {branding.logo && <Button onClick={() => setBranding((p) => p ? { ...p, logo: '' } : p)} size="small" sx={{ color: c.hot }}>הסר</Button>}
          </Box>
        </Box>

        {/* Banner */}
        <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 2.5, mb: 2 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text, mb: 1.5 }}>תמונת רקע (באנר)</Typography>
          {branding.banner && <Box component="img" src={branding.banner} sx={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 2, mb: 1.5 }} />}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button component="label" variant="outlined" sx={{ borderRadius: 2, fontWeight: 600 }}>העלה באנר<input type="file" accept="image/*" hidden onChange={handleImage('banner', 1000)} /></Button>
            {branding.banner && <Button onClick={() => setBranding((p) => p ? { ...p, banner: '' } : p)} size="small" sx={{ color: c.hot }}>הסר</Button>}
          </Box>
        </Box>

        {/* Brand color */}
        <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 2.5, mb: 2 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text, mb: 1.5 }}>צבע מותג</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {COLORS.map((col) => (
              <Box key={col} onClick={() => setBranding((p) => p ? { ...p, brandColor: col } : p)} sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: col, cursor: 'pointer', border: branding.brandColor === col ? `3px solid ${c.text}` : '3px solid transparent' }} />
            ))}
          </Box>
        </Box>

        {/* Welcome text */}
        <TextField fullWidth label="טקסט ברוכים הבאים" value={branding.welcomeText} onChange={(e) => setBranding((p) => p ? { ...p, welcomeText: e.target.value } : p)} sx={{ mb: 2 }} multiline rows={2} placeholder="למשל: קבעו תור בקלות, נשמח לראותכם!" />

        {/* Show prices */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 2, mb: 3 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>הצג מחירים בדף</Typography>
          <Switch checked={branding.showPrices} onChange={(e) => setBranding((p) => p ? { ...p, showPrices: e.target.checked } : p)} />
        </Box>

        <Button onClick={save} variant="contained" fullWidth disabled={saving} sx={{ py: 1.75, borderRadius: 3, fontWeight: 800 }}>
          {saved ? '✓ נשמר!' : saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'שמור'}
        </Button>
      </Box>
    </Box>
  );
}
