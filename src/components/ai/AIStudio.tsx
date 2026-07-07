'use client';

import { useState } from 'react';
import { Box, Typography, Button, CircularProgress, Chip, TextField } from '@mui/material';
import { useAuth } from '@/features/auth/AuthProvider';
import { zikkitColors as c } from '@/styles/theme';

type Tab = 'post' | 'landing';

/**
 * AI Content Studio — combined panel for:
 * - Photo → social post caption
 * - Auto landing page generation
 * (Marketing advice moved to the Growth Center at /growth)
 * - Work gallery upload
 *
 * Drop into a dashboard page: <AIStudio />
 */
export function AIStudio() {
  const { bizId } = useAuth();
  const [tab, setTab] = useState<Tab>('post');

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      {/* Tabs */}
      <Box sx={{ display: 'flex', gap: 1, mb: 4, flexWrap: 'wrap' }}>
        {([
          { id: 'post', label: '📸 תמונה → פוסט' },
          { id: 'landing', label: '🌐 דף נחיתה' },
        ] as Array<{ id: Tab; label: string }>).map((t) => (
          <Button
            key={t.id}
            onClick={() => setTab(t.id)}
            sx={{
              borderRadius: 99, px: 2.5, py: 1, fontWeight: 700, fontSize: 14, textTransform: 'none',
              bgcolor: tab === t.id ? c.accent : c.surface1,
              color: tab === t.id ? '#fff' : c.text2,
              border: `1px solid ${tab === t.id ? c.accent : c.border}`,
              '&:hover': { bgcolor: tab === t.id ? c.accent : c.surface2 },
            }}
          >
            {t.label}
          </Button>
        ))}
      </Box>

      {tab === 'post' && <PostTab bizId={bizId} />}
      {tab === 'landing' && <LandingTab bizId={bizId} />}
    </Box>
  );
}

// ===== Photo → Post =====
function PostTab(_props: { bizId: string | null }) {
  const [image, setImage] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaType(file.type);
    const reader = new FileReader();
    reader.onload = () => setImage((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/post-from-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: image, mediaType, businessName: '', tone: 'friendly' }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: c.text, mb: 1 }}>תמונה → פוסט מקצועי</Typography>
      <Typography sx={{ fontSize: 14, color: c.text2, mb: 3 }}>
        העלה תמונה של עבודה שהשלמת, וה-AI יכתוב פוסט מוכן עם האשטאגים.
      </Typography>

      <Button component="label" variant="outlined" sx={{ py: 1.5, px: 3, borderRadius: 3, mb: 2, borderStyle: 'dashed' }}>
        📷 בחר תמונה
        <input type="file" accept="image/*" hidden onChange={handleFile} />
      </Button>

      {image && (
        <Box sx={{ mb: 2 }}>
          <Box component="img" src={`data:${mediaType};base64,${image}`} sx={{ maxWidth: 300, borderRadius: 3, display: 'block', mb: 2 }} />
          <Button onClick={generate} disabled={loading} variant="contained" sx={{ borderRadius: 3, fontWeight: 800 }}>
            {loading ? <><CircularProgress size={16} sx={{ color: '#fff', mr: 1 }} />יוצר...</> : '✨ צור פוסט'}
          </Button>
        </Box>
      )}

      {error && <Box sx={{ bgcolor: c.hotDim, border: `1px solid ${c.hot}`, borderRadius: 2, p: 2, mt: 2 }}><Typography sx={{ fontSize: 13, color: c.hot }}>{error}</Typography></Box>}

      {result && (
        <Box className="zk-fade-up" sx={{ mt: 2 }}>
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 2.5, mb: 2 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.text3, mb: 1 }}>הפוסט שלך</Typography>
            <Typography sx={{ fontSize: 15, color: c.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{result.caption as string}</Typography>
            {Array.isArray(result.hashtags) && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 2 }}>
                {(result.hashtags as string[]).map((h, i) => <Chip key={i} label={`#${h}`} size="small" sx={{ bgcolor: c.accentDim, color: c.accent }} />)}
              </Box>
            )}
          </Box>
          <Button onClick={() => { navigator.clipboard.writeText(result.caption as string); }} variant="contained" sx={{ borderRadius: 3, fontWeight: 700 }}>📋 העתק פוסט</Button>
        </Box>
      )}
    </Box>
  );
}

// ===== Landing Builder =====
const LANDING_TYPES = ['מספרה', 'מכון יופי', 'קוסמטיקה', 'ציפורניים', 'איפור', 'עיסוי וספא', 'קליניקה', 'רפואת שיניים', 'פיזיותרפיה', 'וטרינר', 'אופטיקה', 'אסתטיקה', 'אחר'];
const LANDING_VIBES = [
  { id: 'luxury', label: '💎 יוקרתי ומפנק' },
  { id: 'warm', label: '☀️ חם ומזמין' },
  { id: 'modern', label: '⚡ מודרני ונקי' },
  { id: 'calm', label: '🌿 רגוע וטבעי' },
  { id: 'bold', label: '🔥 נועז ואנרגטי' },
  { id: 'elegant', label: '✨ אלגנטי ועדין' },
];

function LandingTab({ bizId }: { bizId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rich inputs
  const [name, setName] = useState('');
  const [bizType, setBizType] = useState('');
  const [vibe, setVibe] = useState('warm');
  const [audience, setAudience] = useState('');
  const [highlights, setHighlights] = useState('');
  const [phone, setPhone] = useState('');
  const [extraPrompt, setExtraPrompt] = useState('');

  const build = async () => {
    if (!name.trim()) { setError('צריך לפחות שם עסק'); return; }
    setLoading(true);
    setError(null);
    try {
      // Pull services from the catalog automatically
      let services: Array<{ name: string; price?: number }> = [];
      if (bizId) {
        try {
          const { getServices } = await import('@/lib/bizdata');
          services = await getServices(bizId);
        } catch { /* ignore */ }
      }
      const vibeLabel = LANDING_VIBES.find((v) => v.id === vibe)?.label || '';
      const res = await fetch('/api/ai/build-landing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bizId,
          businessName: name,
          industry: bizType,
          services,
          contactPhone: phone,
          vibe: vibeLabel,
          audience,
          highlights,
          extraPrompt,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: c.text, mb: 1 }}>דף נחיתה אוטומטי</Typography>
      <Typography sx={{ fontSize: 14, color: c.text2, mb: 3 }}>
        ספר לנו על העסק וה-AI יבנה לך דף נחיתה מקצועי שמתאים בדיוק לך.
      </Typography>

      <Box sx={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {/* Business name */}
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 0.75 }}>שם העסק *</Typography>
          <TextField fullWidth size="small" placeholder="למשל: סטודיו רותם" value={name} onChange={(e) => setName(e.target.value)} />
        </Box>

        {/* Business type */}
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 0.75 }}>סוג העסק</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {LANDING_TYPES.map((t) => (
              <Box key={t} onClick={() => setBizType(t)} sx={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, borderRadius: 99, px: 1.75, py: 0.6, bgcolor: bizType === t ? c.accent : c.surface3, color: bizType === t ? '#fff' : c.text2, transition: 'all 0.2s' }}>{t}</Box>
            ))}
          </Box>
        </Box>

        {/* Vibe */}
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 0.75 }}>איזו אווירה?</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.75 }}>
            {LANDING_VIBES.map((v) => (
              <Box key={v.id} onClick={() => setVibe(v.id)} sx={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600, borderRadius: 2.5, px: 1.75, py: 1, textAlign: 'center', bgcolor: vibe === v.id ? c.accentDim : c.surface3, color: vibe === v.id ? c.accent : c.text2, border: `2px solid ${vibe === v.id ? c.accent : 'transparent'}`, transition: 'all 0.2s' }}>{v.label}</Box>
            ))}
          </Box>
        </Box>

        {/* Target audience */}
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 0.75 }}>קהל היעד שלך</Typography>
          <TextField fullWidth size="small" placeholder="למשל: נשים 25-45, מקפידות על מראה מטופח" value={audience} onChange={(e) => setAudience(e.target.value)} />
        </Box>

        {/* Highlights */}
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 0.75 }}>מה מייחד אותך?</Typography>
          <TextField fullWidth size="small" multiline rows={2} placeholder="למשל: 15 שנות ניסיון, מוצרים אורגניים, חניה חינם, אווירה רגועה" value={highlights} onChange={(e) => setHighlights(e.target.value)} />
        </Box>

        {/* Phone */}
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 0.75 }}>טלפון ליצירת קשר</Typography>
          <TextField fullWidth size="small" placeholder="050-0000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Box>

        {/* Extra prompt */}
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 0.75 }}>משהו נוסף שתרצה? (אופציונלי)</Typography>
          <TextField fullWidth size="small" multiline rows={2} placeholder="למשל: תדגיש שאנחנו פתוחים גם בשישי, הוסף קריאה למבצע השקה" value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} />
        </Box>

        <Box sx={{ bgcolor: c.accentDim, borderRadius: 2.5, p: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
          <Box sx={{ fontSize: 16 }}>💡</Box>
          <Typography sx={{ fontSize: 12, color: c.text2 }}>השירותים והמחירים שלך יישלפו אוטומטית מהמחירון.</Typography>
        </Box>

        <Button onClick={build} disabled={loading || !name.trim()} variant="contained" size="large" sx={{ py: 1.5, borderRadius: 3, fontWeight: 800 }}>
          {loading ? <><CircularProgress size={18} sx={{ color: '#fff', mr: 1 }} />בונה את הדף שלך...</> : '✨ בנה דף נחיתה'}
        </Button>
      </Box>

      {error && <Box sx={{ bgcolor: c.hotDim, border: `1px solid ${c.hot}`, borderRadius: 2, p: 2, mt: 2, maxWidth: 520 }}><Typography sx={{ fontSize: 13, color: c.hot }}>{error}</Typography></Box>}

      {result && (
        <Box className="zk-fade-up" sx={{ mt: 3, maxWidth: 520 }}>
          <Box sx={{ bgcolor: c.accentDim, border: `2px solid ${c.accent}`, borderRadius: 3, p: 3, mb: 2 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.accent, mb: 1 }}>✓ הדף שלך מוכן!</Typography>
            <Typography sx={{ fontSize: 13, color: c.text2, mb: 2 }}>הכותרת: <strong>{result.heroTitle as string}</strong></Typography>
            <Button href={`/site/${bizId}`} target="_blank" variant="contained" sx={{ borderRadius: 3, fontWeight: 700 }}>
              🌐 צפה בדף שלך
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
