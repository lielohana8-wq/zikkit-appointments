'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, TextField, Switch, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBranding, saveBranding, type BookingBranding } from '@/lib/bizdata';
import { useToast } from '@/components/Toast';
import { zikkitColors as c } from '@/styles/theme';

const COLORS = ['#9333EA', '#EC4899', '#06B6D4', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#1C1917', '#0EA5E9', '#D946EF'];

export default function BookingPageSettings() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const { showToast } = useToast();
  const [b, setB] = useState<BookingBranding | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [saved, setSaved] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);
  useEffect(() => { if (typeof window !== 'undefined') setBaseUrl(window.location.origin); }, []);

  const load = useCallback(async () => {
    if (!bizId) return;
    try { setB(await getBranding(bizId)); } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof BookingBranding>(key: K, val: BookingBranding[K]) => setB((p) => p ? { ...p, [key]: val } : p);

  const runAiDesign = async () => {
    if (!aiPrompt || !b) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/design-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, businessType: '' }),
      });
      const data = await res.json();
      if (data.design) {
        const d = data.design;
        setB((p) => p ? {
          ...p,
          brandColor: d.brandColor || p.brandColor,
          headerStyle: d.headerStyle || p.headerStyle,
          welcomeText: d.welcomeText || p.welcomeText,
          thankYouMessage: d.thankYouMessage || p.thankYouMessage,
          cancellationNote: d.cancellationNote || p.cancellationNote,
        } : p);
        setAiPrompt('');
      } else {
        showToast(data.error || 'לא הצלחתי לעצב — נסה שוב', 'error');
      }
    } catch (e) {
      showToast('שגיאה: ' + (e as Error).message, 'error');
    } finally { setAiLoading(false); }
  };

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
        set(field, canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Add an image to the gallery (compressed)
  const addGalleryImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !b) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 900 / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        set('gallery', [...(b.gallery || []), dataUrl].slice(0, 12));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeGalleryImage = (idx: number) => {
    if (!b) return;
    set('gallery', (b.gallery || []).filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!bizId || !b) return;
    setSaving(true);
    try { await saveBranding(bizId, b); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { showToast('שגיאה בשמירה: ' + (e as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const bookingUrl = bizId ? `${baseUrl}/book/${bizId}` : '';

  if (loading || dataLoading || !b) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>דף הזמנות</Typography>
        <Button onClick={save} variant="contained" disabled={saving} sx={{ borderRadius: 99, fontWeight: 700 }}>
          {saved ? '✓' : saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'שמור'}
        </Button>
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 600, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {/* Enable */}
        <Box sx={{ bgcolor: b.enabled ? c.accentDim : c.surface1, border: `2px solid ${b.enabled ? c.accent : c.border}`, borderRadius: 2, p: 3, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ fontSize: 32 }}>{b.enabled ? '🟢' : '⚪'}</Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text }}>{b.enabled ? 'דף ההזמנות פעיל' : 'דף ההזמנות כבוי'}</Typography>
            <Typography sx={{ fontSize: 13, color: c.text2 }}>{b.enabled ? 'לקוחות יכולים לקבוע תורים' : 'הפעל כדי שלקוחות יוכלו להזמין'}</Typography>
          </Box>
          <Switch checked={b.enabled} onChange={(e) => set('enabled', e.target.checked)} />
        </Box>

        {/* Link */}
        {b.enabled && (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.5, mb: 3 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.text3, mb: 1 }}>🔗 הלינק שלך</Typography>
            <Typography sx={{ fontSize: 13, color: c.accent, fontWeight: 600, wordBreak: 'break-all', fontFamily: 'monospace', mb: 1.5 }}>{bookingUrl}</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button onClick={() => navigator.clipboard.writeText(bookingUrl)} size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>📋 העתק</Button>
              <Button href={bookingUrl} target="_blank" size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>👁️ תצוגה</Button>
              <Button onClick={() => setShowQR(!showQR)} size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>📱 QR</Button>
              <Button href={`https://wa.me/?text=${encodeURIComponent('קבעו תור: ' + bookingUrl)}`} target="_blank" size="small" sx={{ color: '#25D366', fontWeight: 700 }}>שתף בוואטסאפ</Button>
            </Box>
            {showQR && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Box component="img" src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingUrl)}`} sx={{ width: 200, height: 200, borderRadius: 2, border: `1px solid ${c.border2}`, bgcolor: '#fff', p: 1 }} alt="QR" />
                <Typography sx={{ fontSize: 12, color: c.text3, mt: 1 }}>הדפיסו והציגו בעסק — לקוחות סורקים וקובעים תור</Typography>
              </Box>
            )}
          </Box>
        )}

        <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text, mb: 2, mt: 1 }}>🎨 עיצוב</Typography>

        {/* AI design prompt */}
        <Box sx={{ bgcolor: `linear-gradient(135deg, ${c.accentDim}, ${c.surface1})`, background: `linear-gradient(135deg, ${c.accentDim}, ${c.surface1})`, border: `1px solid ${c.accentMid}`, borderRadius: 2, p: 2.5, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ fontSize: 20 }}>✨</Box>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text }}>עיצוב עם AI</Typography>
          </Box>
          <Typography sx={{ fontSize: 12.5, color: c.text2, mb: 1.5 }}>תאר איך אתה רוצה שדף ההזמנות ירגיש, וה-AI יעצב אותו עבורך.</Typography>
          <TextField fullWidth size="small" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="למשל: יוקרתי ומפנק, צבעים חמים, אווירה רגועה" multiline rows={2} sx={{ mb: 1.5, bgcolor: '#fff', borderRadius: 2 }} />
          <Button onClick={runAiDesign} disabled={aiLoading || !aiPrompt} variant="contained" fullWidth sx={{ borderRadius: 2.5, fontWeight: 700 }}>
            {aiLoading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : '✨ עצב לי את הדף'}
          </Button>
        </Box>

        {/* Images */}
        <Section title="לוגו ותמונת רקע">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            {b.logo ? <Box component="img" src={b.logo} sx={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} /> : <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: c.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🖼️</Box>}
            <Button component="label" variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 600 }}>לוגו<input type="file" accept="image/*" hidden onChange={handleImage('logo', 200)} /></Button>
            {b.logo && <Button onClick={() => set('logo', '')} size="small" sx={{ color: c.hot }}>הסר</Button>}
          </Box>
          {b.banner && <Box component="img" src={b.banner} sx={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 2, mb: 1 }} />}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button component="label" variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 600 }}>באנר<input type="file" accept="image/*" hidden onChange={handleImage('banner', 1000)} /></Button>
            {b.banner && <Button onClick={() => set('banner', '')} size="small" sx={{ color: c.hot }}>הסר</Button>}
          </Box>
        </Section>

        {/* Color */}
        <Section title="צבע מותג">
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {COLORS.map((col) => (
              <Box key={col} onClick={() => set('brandColor', col)} sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: col, cursor: 'pointer', border: b.brandColor === col ? `3px solid ${c.text}` : '3px solid transparent' }} />
            ))}
          </Box>
          <TextField select fullWidth size="small" label="סגנון כותרת" value={b.headerStyle} onChange={(e) => set('headerStyle', e.target.value)}>
            <MenuItem value="centered">ממורכז</MenuItem>
            <MenuItem value="banner">באנר גדול</MenuItem>
            <MenuItem value="minimal">מינימלי</MenuItem>
          </TextField>
        </Section>

        {/* Texts */}
        <Section title="טקסטים">
          <TextField fullWidth size="small" label="טקסט ברוכים הבאים" value={b.welcomeText} onChange={(e) => set('welcomeText', e.target.value)} sx={{ mb: 2 }} multiline rows={2} placeholder="קבעו תור בקלות, נשמח לראותכם!" />
          <TextField fullWidth size="small" label="הודעת תודה (אחרי קביעת תור)" value={b.thankYouMessage} onChange={(e) => set('thankYouMessage', e.target.value)} sx={{ mb: 2 }} placeholder="תודה! נתראה בקרוב" />
          <TextField fullWidth size="small" label="הערת ביטול/מדיניות" value={b.cancellationNote} onChange={(e) => set('cancellationNote', e.target.value)} multiline rows={2} placeholder="ביטול עד 24 שעות לפני התור" />
        </Section>

        {/* Gallery */}
        <Section title="📸 גלריית תמונות">
          <Typography sx={{ fontSize: 13, color: c.text3, mb: 2 }}>הציגו את העבודות שלכם — תמונות שימשכו לקוחות לקבוע. עד 12 תמונות.</Typography>
          <TextField fullWidth size="small" label="כותרת הגלריה" value={b.galleryTitle} onChange={(e) => set('galleryTitle', e.target.value)} sx={{ mb: 2 }} placeholder="העבודות שלנו" />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 2 }}>
            {(b.gallery || []).map((img, i) => (
              <Box key={i} sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', aspectRatio: '1', border: `1px solid ${c.border2}` }}>
                <Box component="img" src={img} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <Box onClick={() => removeGalleryImage(i)} sx={{ position: 'absolute', top: 4, left: 4, width: 24, height: 24, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', '&:hover': { bgcolor: c.hot } }}>✕</Box>
              </Box>
            ))}
            {(b.gallery || []).length < 12 && (
              <Box component="label" sx={{ cursor: 'pointer', borderRadius: 2, border: `2px dashed ${c.border}`, aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: c.text3, gap: 0.5, '&:hover': { borderColor: c.accent, color: c.accent } }}>
                <Box sx={{ fontSize: 24 }}>+</Box>
                <Typography sx={{ fontSize: 11, fontWeight: 600 }}>הוסף</Typography>
                <input type="file" accept="image/*" hidden onChange={addGalleryImage} />
              </Box>
            )}
          </Box>
        </Section>

        {/* Announcement banner */}
        <Section title="📢 הודעת עדכון">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text }}>הצג באנר הודעה בראש הדף</Typography>
            <Switch checked={b.announcementOn} onChange={(e) => set('announcementOn', e.target.checked)} />
          </Box>
          <TextField fullWidth size="small" label="טקסט ההודעה" value={b.announcement} onChange={(e) => set('announcement', e.target.value)} multiline rows={2} placeholder="🎉 מבצע חגים! 20% הנחה על כל הטיפולים החודש" disabled={!b.announcementOn} />
        </Section>

        {/* Promo strip */}
        <Section title="🔥 רצועת מבצע">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text }}>הצג רצועת מבצע בולטת</Typography>
            <Switch checked={b.promoOn} onChange={(e) => set('promoOn', e.target.checked)} />
          </Box>
          <TextField fullWidth size="small" label="טקסט המבצע" value={b.promoText} onChange={(e) => set('promoText', e.target.value)} placeholder="לקוח חדש? קבל 15% הנחה על הביקור הראשון!" disabled={!b.promoOn} />
        </Section>

        {/* Popup */}
        <Section title="💬 פופאפ פתיחה">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text }}>הצג פופאפ כשנכנסים לדף</Typography>
            <Switch checked={b.popupOn} onChange={(e) => set('popupOn', e.target.checked)} />
          </Box>
          <TextField fullWidth size="small" label="כותרת הפופאפ" value={b.popupTitle} onChange={(e) => set('popupTitle', e.target.value)} sx={{ mb: 2 }} placeholder="ברוכים הבאים! 🎉" disabled={!b.popupOn} />
          <TextField fullWidth size="small" label="תוכן הפופאפ" value={b.popupText} onChange={(e) => set('popupText', e.target.value)} multiline rows={3} placeholder="קבעו תור עכשיו וקבלו 10% הנחה. מחכים לכם!" disabled={!b.popupOn} />
        </Section>

        {/* About */}
        <Section title="ℹ️ קצת עלינו">
          <TextField fullWidth size="small" label="טקסט 'אודות'" value={b.aboutText} onChange={(e) => set('aboutText', e.target.value)} multiline rows={3} placeholder="ספרו ללקוחות עליכם — ניסיון, התמחות, מה מייחד אתכם..." />
        </Section>

        {/* Contact */}
        <Section title="פרטי קשר (יוצגו בדף)">
          <TextField fullWidth size="small" label="📲 הטלפון שלך לקבלת התראות על תורים" value={b.notifyPhone} onChange={(e) => set('notifyPhone', e.target.value)} sx={{ mb: 2 }} placeholder="050-0000000" helperText="לכאן יישלח SMS על כל תור חדש" />
          <TextField fullWidth size="small" label="כתובת" value={b.address} onChange={(e) => set('address', e.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="טלפון" value={b.phone} onChange={(e) => set('phone', e.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="אינסטגרם (שם משתמש)" value={b.instagram} onChange={(e) => set('instagram', e.target.value)} sx={{ mb: 2 }} placeholder="@mybusiness" />
          <TextField fullWidth size="small" label="וואטסאפ (מספר)" value={b.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="0501234567" sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="פייסבוק (קישור או שם)" value={b.facebook} onChange={(e) => set('facebook', e.target.value)} sx={{ mb: 2 }} placeholder="facebook.com/mybusiness" />
          <TextField fullWidth size="small" label="טיקטוק (שם משתמש)" value={b.tiktok} onChange={(e) => set('tiktok', e.target.value)} placeholder="@mybusiness" />
        </Section>

        {/* Options */}
        <Section title="אפשרויות">
          {[
            { key: 'showPrices' as const, label: 'הצג מחירים' },
            { key: 'showDuration' as const, label: 'הצג משך טיפול' },
            { key: 'showReviews' as const, label: 'הצג ביקורות' },
            { key: 'requirePhone' as const, label: 'דרוש טלפון מהלקוח' },
            { key: 'requireEmail' as const, label: 'דרוש אימייל מהלקוח' },
          ].map((o) => (
            <Box key={o.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
              <Typography sx={{ fontSize: 14, color: c.text }}>{o.label}</Typography>
              <Switch checked={b[o.key]} onChange={(e) => set(o.key, e.target.checked)} />
            </Box>
          ))}
        </Section>

        <Button onClick={save} variant="contained" fullWidth disabled={saving} sx={{ py: 1.75, borderRadius: 1.5, fontWeight: 800, mt: 2 }}>
          {saved ? '✓ נשמר!' : saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'שמור הכל'}
        </Button>
      </Box>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.5, mb: 2 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.text, mb: 2 }}>{title}</Typography>
      {children}
    </Box>
  );
}
