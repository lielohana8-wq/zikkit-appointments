'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Button, CircularProgress, TextField, Switch, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { uploadImageToStorage } from '@/lib/firebase';
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

  // One-time migration: move existing base64 images to Storage (fast URLs)
  const migratedRef = useRef(false);
  useEffect(() => {
    if (!b || !bizId || migratedRef.current) return;
    const isData = (v?: string) => !!v && v.startsWith('data:');
    const heavy = ['logo', 'banner', 'appIcon'].filter((f) => isData((b as unknown as Record<string, string>)[f])) as Array<'logo' | 'banner' | 'appIcon'>;
    const heavyGallery = (b.gallery || []).some((g) => isData(g));
    if (heavy.length === 0 && !heavyGallery) { migratedRef.current = true; return; }
    migratedRef.current = true;
    (async () => {
      try {
        for (const f of heavy) {
          const u = await uploadImageToStorage(bizId, f.toLowerCase(), (b as unknown as Record<string, string>)[f]);
          set(f, u);
        }
        if (heavyGallery) {
          const g2: string[] = [];
          for (const g of (b.gallery || [])) g2.push(isData(g) ? await uploadImageToStorage(bizId, 'gallery', g) : g);
          set('gallery', g2);
        }
        showToast('🚀 התמונות הועברו לאחסון מהיר — לחצו "שמור הכל"', 'success');
      } catch { /* storage not enabled yet — keep base64, nothing breaks */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, bizId]);

  // Self-heal: generate the square app icon for logos uploaded before this feature
  useEffect(() => {
    if (!b?.logo || b.appIcon) return;
    const img = new Image();
    img.onload = () => {
      const icon = document.createElement('canvas');
      icon.width = 512; icon.height = 512;
      const ictx = icon.getContext('2d');
      if (!ictx) return;
      const side = Math.min(img.width, img.height);
      ictx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 512, 512);
      { const dIc = icon.toDataURL('image/jpeg', 0.82); uploadImageToStorage(bizId || '', 'appicon', dIc).then((u) => { set('appIcon', u); set('appIconV', Date.now()); }).catch(() => { set('appIcon', dIc); set('appIconV', Date.now()); }); }
    };
    img.src = b.logo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b?.logo, b?.appIcon]);

  const makeIcon = (style: 'cover' | 'tile') => {
    if (!b?.logo) return;
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
      const ctx = cv.getContext('2d'); if (!ctx) return;
      if (style === 'cover') {
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 512, 512);
      } else {
        // The whole logo, centered on a brand-color tile — looks like a designed app icon
        ctx.fillStyle = b.brandColor || '#7C3AED';
        ctx.fillRect(0, 0, 512, 512);
        const scale = Math.min((512 * 0.72) / img.width, (512 * 0.72) / img.height);
        const w = img.width * scale; const h = img.height * scale;
        ctx.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h);
      }
      { const dIc = cv.toDataURL('image/jpeg', 0.85); uploadImageToStorage(bizId || '', 'appicon', dIc).then((u) => { set('appIcon', u); set('appIconV', Date.now()); }).catch(() => { set('appIcon', dIc); set('appIconV', Date.now()); }); }
    };
    img.src = b.logo;
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        uploadImageToStorage(bizId || '', field, dataUrl).then((u) => set(field, u)).catch(() => set(field, dataUrl));
        // The app icon must be a perfect square that FILLS the home-screen tile:
        // center cover-crop of the logo at 512x512 — no white bars, ever.
        if (field === 'logo') {
          const icon = document.createElement('canvas');
          icon.width = 512; icon.height = 512;
          const ictx = icon.getContext('2d');
          if (ictx) {
            const side = Math.min(img.width, img.height);
            const sx = (img.width - side) / 2;
            const sy = (img.height - side) / 2;
            ictx.drawImage(img, sx, sy, side, side, 0, 0, 512, 512);
            { const dIc = icon.toDataURL('image/jpeg', 0.82); uploadImageToStorage(bizId || '', 'appicon', dIc).then((u) => { set('appIcon', u); set('appIconV', Date.now()); }).catch(() => { set('appIcon', dIc); set('appIconV', Date.now()); }); }
          }
        }
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
        uploadImageToStorage(bizId || '', 'gallery', dataUrl).then((u) => set('gallery', [...(b.gallery || []), u].slice(0, 12))).catch(() => set('gallery', [...(b.gallery || []), dataUrl].slice(0, 12)));
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
          <TextField fullWidth size="small" label="📱 שם האפליקציה במסך הבית" value={b.appName || ''} onChange={(e) => set('appName', e.target.value)} sx={{ mt: 2 }} placeholder="למשל: מספרת דניאל" helperText="שים לב: הטלפון מציג ~13 תווים מתחת לאייקון — שם ארוך ייחתך (מגבלת iOS/אנדרואיד). ראה תצוגה מקדימה למטה" />
          {b.logo && (
            <Box sx={{ mt: 2.5, bgcolor: c.surface2, borderRadius: 2.5, p: 2 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 1.5 }}>📲 האייקון במסך הבית — תצוגה מקדימה</Typography>
              <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center' }}>
                <Box sx={{ textAlign: 'center', flexShrink: 0 }}>
                  <Box sx={{ width: 76, height: 76, borderRadius: '17px', overflow: 'hidden', boxShadow: '0 8px 22px rgba(0,0,0,0.2)', mx: 'auto', bgcolor: c.surface3 }}>
                    {b.appIcon && <Box component="img" src={b.appIcon} sx={{ width: '100%', height: '100%', display: 'block' }} />}
                  </Box>
                  <Typography sx={{ fontSize: 10.5, color: c.text, fontWeight: 600, mt: 0.75, maxWidth: 82, mx: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.appName || 'שם האפליקציה'}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Button onClick={() => makeIcon('cover')} size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12, justifyContent: 'flex-start' }}>◼️ מילוי מלא — חיתוך מרכזי</Button>
                    <Button onClick={() => makeIcon('tile')} size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12, justifyContent: 'flex-start' }}>🎨 הלוגו שלם על רקע צבע המותג</Button>
                  </Box>
                  <Typography sx={{ fontSize: 10.5, color: c.text3, mt: 1, lineHeight: 1.5 }}>בחר סגנון → שמור הכל → בטלפון: מחק את האפליקציה מהמסך והוסף מחדש (הטלפון שומר אייקון ישן)</Typography>
                </Box>
              </Box>
            </Box>
          )}
          <Box sx={{ display: 'none' }}>
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

        {/* Deposit / prepayment */}
        <Section title="💳 מקדמה בהזמנה">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text }}>דרוש מקדמה לאישור התור</Typography>
              <Typography sx={{ fontSize: 12, color: c.text3 }}>מוריד ביטולים ו&quot;לא הגיעו&quot; דרמטית</Typography>
            </Box>
            <Switch checked={b.depositOn} onChange={(e) => set('depositOn', e.target.checked)} />
          </Box>
          {b.depositOn && (
            <>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
                <TextField size="small" type="number" label="סכום קבוע (₪)" value={b.depositAmount || ''} onChange={(e) => { set('depositAmount', Number(e.target.value)); if (Number(e.target.value)) set('depositPercent', 0); }} sx={{ flex: 1 }} placeholder="30" />
                <Box sx={{ display: 'flex', alignItems: 'center', color: c.text3, fontSize: 13 }}>או</Box>
                <TextField size="small" type="number" label="אחוז מהמחיר (%)" value={b.depositPercent || ''} onChange={(e) => { set('depositPercent', Number(e.target.value)); if (Number(e.target.value)) set('depositAmount', 0); }} sx={{ flex: 1 }} placeholder="20" />
              </Box>
              <Typography sx={{ fontSize: 12, color: c.text3 }}>💡 דורש חיבור Grow (מנוי ותשלומים). בלי חיבור — הלקוח יתבקש לשלם אבל התשלום לא יעבור.</Typography>
            </>
          )}
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

        {/* Booking rules */}
        <Section title="💰 שעות שיא — תמחור דינמי">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            <Box>
              <Typography sx={{ fontSize: 14, color: c.text }}>תוספת מחיר בשעות מבוקשות</Typography>
              <Typography sx={{ fontSize: 12, color: c.text3 }}>למשל: שישי 12:00-15:00 בתוספת 20 ₪ — מוצג ללקוח בשקיפות (⭐)</Typography>
            </Box>
            <Switch checked={!!b.peakOn} onChange={(e) => set('peakOn', e.target.checked)} />
          </Box>
          {b.peakOn && (
            <Box sx={{ mt: 1.5 }}>
              {(b.peakRules || []).map((rule, ri) => (
                <Box key={ri} sx={{ bgcolor: c.surface2, borderRadius: 2.5, p: 1.5, mb: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                    {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((dl, di) => (
                      <Box key={di} onClick={() => { const rules = [...(b.peakRules || [])]; const ds = new Set(rules[ri].days || []); if (ds.has(di)) ds.delete(di); else ds.add(di); rules[ri] = { ...rules[ri], days: Array.from(ds) }; set('peakRules', rules); }}
                        sx={{ cursor: 'pointer', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 800, bgcolor: (rule.days || []).includes(di) ? c.accent : c.surface3, color: (rule.days || []).includes(di) ? '#fff' : c.text3 }}>{dl}</Box>
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField size="small" type="time" label="מ־" value={rule.from || '12:00'} onChange={(e) => { const rules = [...(b.peakRules || [])]; rules[ri] = { ...rules[ri], from: e.target.value }; set('peakRules', rules); }} sx={{ width: 110 }} InputLabelProps={{ shrink: true }} />
                    <TextField size="small" type="time" label="עד" value={rule.to || '15:00'} onChange={(e) => { const rules = [...(b.peakRules || [])]; rules[ri] = { ...rules[ri], to: e.target.value }; set('peakRules', rules); }} sx={{ width: 110 }} InputLabelProps={{ shrink: true }} />
                    <TextField size="small" type="number" label="תוספת ₪" value={rule.extra || 0} onChange={(e) => { const rules = [...(b.peakRules || [])]; rules[ri] = { ...rules[ri], extra: Math.max(0, Number(e.target.value) || 0) }; set('peakRules', rules); }} sx={{ width: 100 }} />
                    <Button onClick={() => set('peakRules', (b.peakRules || []).filter((_, i) => i !== ri))} sx={{ color: c.hot, minWidth: 'auto', fontWeight: 800 }}>✕</Button>
                  </Box>
                </Box>
              ))}
              <Button onClick={() => set('peakRules', [...(b.peakRules || []), { days: [5], from: '12:00', to: '15:00', extra: 20 }])} sx={{ color: c.accent, fontWeight: 800 }}>+ הוסף כלל</Button>
            </Box>
          )}
        </Section>

        <Section title="🎨 עיצוב האפליקציה">
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 1 }}>ערכת נושא</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, mb: 2.5 }}>
            {([['dark', '🖤 יוקרה כהה', 'linear-gradient(140deg,#0A0710,#241838)'], ['light', '🤍 בהיר ונקי', 'linear-gradient(140deg,#FFFFFF,#EDEAF5)'], ['soft', '🌸 רך ופסטלי', `linear-gradient(140deg, ${b.brandColor || '#7C3AED'}33, #FDF6EE)`], ['bold', '⚡ נועז', `linear-gradient(140deg, ${b.brandColor || '#7C3AED'}, ${b.brandColor2 || '#EC4899'})`]] as const).map(([key, label, bg]) => (
              <Box key={key} onClick={() => set('theme', key)} sx={{ cursor: 'pointer', borderRadius: 2.5, overflow: 'hidden', border: `2px solid ${(b.theme || 'dark') === key ? c.accent : c.border2}`, transition: 'all 0.15s' }}>
                <Box sx={{ height: 44, background: bg }} />
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: c.text, textAlign: 'center', py: 0.75, bgcolor: c.surface1 }}>{label}</Typography>
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 1 }}>צבע משני (לגרדיאנטים ולערכת "נועז")</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2.5 }}>
            {['#EC4899', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#111827'].map((col) => (
              <Box key={col} onClick={() => set('brandColor2', col)} sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: col, cursor: 'pointer', border: b.brandColor2 === col ? `3px solid ${c.text}` : '3px solid transparent' }} />
            ))}
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 1 }}>פונט שם העסק</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
            {([['serif', 'סריף יוקרתי'], ['modern', 'מודרני נועז']] as const).map(([key, label]) => (
              <Box key={key} onClick={() => set('nameFont', key)} sx={{ cursor: 'pointer', px: 2, py: 1, borderRadius: 2, fontSize: 13, fontWeight: 800, border: `1.5px solid ${(b.nameFont || 'serif') === key ? c.accent : c.border2}`, color: (b.nameFont || 'serif') === key ? c.accent : c.text3, bgcolor: (b.nameFont || 'serif') === key ? c.accentDim : 'transparent' }}>{label}</Box>
            ))}
          </Box>
          {b.banner && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
              <Box>
                <Typography sx={{ fontSize: 14, color: c.text }}>תמונת הבאנר כרקע הכותרת</Typography>
                <Typography sx={{ fontSize: 12, color: c.text3 }}>הבאנר שהעלית יופיע מאחורי שם העסק והלוגו</Typography>
              </Box>
              <Switch checked={!!b.bandImageOn} onChange={(e) => set('bandImageOn', e.target.checked)} />
            </Box>
          )}
        </Section>

        <Section title="כללי קביעת תורים">
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 1 }}>איך להציע שעות ללקוחות?</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            {[
              { v: 'packed', icon: '🧲', title: 'חכם — צמוד, בלי שעות מתות (מומלץ)', desc: 'כל תור חדש נצמד לסוף התור הקודם. מושלם כשיש טיפולים באורכים שונים (60/75/90 דק\') — היומן נשאר מלא.' },
              { v: 'interval', icon: '⏱️', title: 'מרווח קבוע', desc: 'שעות במרווחים קבועים מתחילת היום. מתאים כשכל הטיפולים באותו אורך.' },
            ].map((m) => (
              <Box key={m.v} onClick={() => set('slotMode', m.v as 'packed' | 'interval')} sx={{ cursor: 'pointer', display: 'flex', gap: 1.5, alignItems: 'flex-start', border: `1.5px solid ${(b.slotMode || 'interval') === m.v ? c.accent : c.border2}`, bgcolor: (b.slotMode || 'interval') === m.v ? c.accentDim : 'transparent', borderRadius: 2, p: 1.5, transition: 'all 0.15s' }}>
                <Box sx={{ fontSize: 20 }}>{m.icon}</Box>
                <Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: c.text }}>{m.title}</Typography>
                  <Typography sx={{ fontSize: 12, color: c.text3, lineHeight: 1.5 }}>{m.desc}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 1 }}>כמה ימים קדימה היומן פתוח לקביעה?</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {[{ v: 7, l: 'שבוע' }, { v: 14, l: 'שבועיים' }, { v: 21, l: '3 שבועות' }, { v: 30, l: 'חודש' }, { v: 60, l: 'חודשיים' }].map((o) => (
                <Box key={o.v} onClick={() => set('bookingWindowDays', o.v)} sx={{ cursor: 'pointer', px: 1.75, py: 0.6, borderRadius: 99, fontSize: 12.5, fontWeight: 700, border: `1.5px solid ${(b.bookingWindowDays || 14) === o.v ? c.accent : c.border2}`, color: (b.bookingWindowDays || 14) === o.v ? c.accent : c.text3, bgcolor: (b.bookingWindowDays || 14) === o.v ? c.accentDim : 'transparent', transition: 'all 0.15s' }}>{o.l}</Box>
              ))}
            </Box>
            <Typography sx={{ fontSize: 11.5, color: c.text3, mt: 0.75 }}>למשל &quot;שבוע&quot; ביום רביעי = לקוחות רואים עד רביעי הבא בלבד</Typography>
          </Box>
          {(b.slotMode || 'interval') === 'interval' && (
          <Box sx={{ mb: 2 }}>
            <TextField fullWidth size="small" type="number" label="מרווח בין תורים מוצעים (דקות)" value={b.slotInterval || 15}
              onChange={(e) => set('slotInterval', Math.max(10, Math.min(240, Number(e.target.value) || 15)))}
              helperText={(() => { const iv = b.slotInterval || 15; const start = 9 * 60; const ex = [0, 1, 2, 3].map((k) => { const m = start + k * iv; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }).join(' · '); return `כל ערך בין 10 ל-240. למשל מ-09:00: ${ex}...`; })()} />
            <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
              {[15, 30, 45, 60, 75, 90, 120].map((m) => (
                <Box key={m} onClick={() => set('slotInterval', m)} sx={{ cursor: 'pointer', px: 1.5, py: 0.4, borderRadius: 99, fontSize: 12, fontWeight: 700, border: `1.5px solid ${(b.slotInterval || 15) === m ? c.accent : c.border2}`, color: (b.slotInterval || 15) === m ? c.accent : c.text3, bgcolor: (b.slotInterval || 15) === m ? c.accentDim : 'transparent', transition: 'all 0.15s' }}>{m} דק&apos;</Box>
              ))}
            </Box>
          </Box>
          )}
          <TextField select fullWidth size="small" label="ביטול עצמי של לקוחות" value={b.cancelWindowH ?? 0} onChange={(e) => set('cancelWindowH', Number(e.target.value))} sx={{ mb: 2 }} SelectProps={{ native: true }} helperText="פחות מזה — הלקוח לא יוכל לבטל לבד">
            <option value={0}>אפשר לבטל תמיד</option>
            <option value={12}>עד 12 שעות לפני התור</option>
            <option value={24}>עד 24 שעות לפני התור</option>
            <option value={48}>עד 48 שעות לפני התור</option>
          </TextField>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            <Box>
              <Typography sx={{ fontSize: 14, color: c.text }}>חובת הרשמה לאפליקציה</Typography>
              <Typography sx={{ fontSize: 12, color: c.text3 }}>לקוחות חייבים להצטרף (שם+טלפון) לפני שרואים את האפליקציה</Typography>
            </Box>
            <Switch checked={b.requireRegistration !== false} onChange={(e) => set('requireRegistration', e.target.checked)} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            <Box>
              <Typography sx={{ fontSize: 14, color: c.text }}>🔐 אימות בקוד SMS (OTP)</Typography>
              <Typography sx={{ fontSize: 12, color: c.text3 }}>מונע התחזות למספר של אחר. ⚠️ הפעל רק אחרי שההודעות עובדות (בדוק ביומן ההודעות)</Typography>
            </Box>
            <Switch checked={!!b.otpOn} onChange={(e) => set('otpOn', e.target.checked)} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            <Box>
              <Typography sx={{ fontSize: 14, color: c.text }}>אישור תורים ידני</Typography>
              <Typography sx={{ fontSize: 12, color: c.text3 }}>{b.approvalMode === 'manual' ? 'תור חדש ממתין לאישור שלך לפני שהוא נקבע' : 'כבוי — כל תור מאושר אוטומטית'}</Typography>
            </Box>
            <Switch checked={b.approvalMode === 'manual'} onChange={(e) => set('approvalMode', e.target.checked ? 'manual' : 'auto')} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            <Box>
              <Typography sx={{ fontSize: 14, color: c.text }}>תקנון בקביעת תור</Typography>
              <Typography sx={{ fontSize: 12, color: c.text3 }}>הלקוח יאשר את התקנון לפני הקביעה</Typography>
            </Box>
            <Switch checked={!!b.policyOn} onChange={(e) => set('policyOn', e.target.checked)} />
          </Box>
          {b.policyOn && (
            <TextField fullWidth size="small" multiline rows={4} label="נוסח התקנון" value={b.policyText || ''} onChange={(e) => set('policyText', e.target.value)} sx={{ mt: 1.5 }} placeholder={'למשל:\n· איחור של יותר מ-15 דקות = ביטול התור\n· ביטול פחות מ-24 שעות מראש יחויב במקדמה\n· אין להגיע עם מלווים'} />
          )}
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
