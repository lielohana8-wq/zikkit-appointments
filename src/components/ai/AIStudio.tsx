'use client';

import { useState } from 'react';
import { Box, Typography, Button, CircularProgress, Chip, TextField } from '@mui/material';
import { useAuth } from '@/features/auth/AuthProvider';
import { zikkitColors as c } from '@/styles/theme';

type Tab = 'marketing' | 'post' | 'landing';

/**
 * AI Studio — combined panel for:
 * - Marketing & optimization advice
 * - Photo → social post caption
 * - Auto landing page generation
 * - Work gallery upload
 *
 * Drop into a dashboard page: <AIStudio />
 */
export function AIStudio() {
  const { bizId } = useAuth();
  const [tab, setTab] = useState<Tab>('marketing');

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      {/* Tabs */}
      <Box sx={{ display: 'flex', gap: 1, mb: 4, flexWrap: 'wrap' }}>
        {([
          { id: 'marketing', label: '📈 ייעוץ שיווק' },
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

      {tab === 'marketing' && <MarketingTab bizId={bizId} />}
      {tab === 'post' && <PostTab bizId={bizId} />}
      {tab === 'landing' && <LandingTab bizId={bizId} />}
    </Box>
  );
}

// ===== Marketing Advisor =====
function MarketingTab({ bizId }: { bizId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bizId }),
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
      <Typography sx={{ fontSize: 22, fontWeight: 800, color: c.text, mb: 1 }}>יועץ השיווק החכם</Typography>
      <Typography sx={{ fontSize: 14, color: c.text2, mb: 3 }}>
        ה-AI מנתח את נתוני העסק שלך ונותן המלצות שיווק וייעול קונקרטיות.
      </Typography>

      {!result && (
        <Button onClick={analyze} disabled={loading} variant="contained" size="large"
          sx={{ py: 1.75, px: 4, borderRadius: 3, fontWeight: 800 }}>
          {loading ? <><CircularProgress size={18} sx={{ color: '#fff', mr: 1 }} />מנתח...</> : '✨ נתח את העסק שלי'}
        </Button>
      )}

      {error && <Box sx={{ bgcolor: c.hotDim, border: `1px solid ${c.hot}`, borderRadius: 2, p: 2, mt: 2 }}><Typography sx={{ fontSize: 13, color: c.hot }}>{error}</Typography></Box>}

      {result && (
        <Box className="zk-fade-up">
          <Box sx={{ bgcolor: c.accentDim, border: `1px solid ${c.accent}`, borderRadius: 3, p: 3, mb: 3 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.accent }}>{result.headline as string}</Typography>
          </Box>

          {Boolean(result.quickWin) && (
            <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 2.5, mb: 3 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.text3, mb: 0.5 }}>⚡ ניצחון מהיר להיום</Typography>
              <Typography sx={{ fontSize: 14, color: c.text, fontWeight: 600 }}>{result.quickWin as string}</Typography>
            </Box>
          )}

          {Array.isArray(result.recommendations) && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
              {(result.recommendations as Array<Record<string, unknown>>).map((rec, i) => (
                <Box key={i} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 2.5, display: 'flex', gap: 2 }}>
                  <Box sx={{ fontSize: 28 }}>{rec.icon as string}</Box>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text }}>{rec.title as string}</Typography>
                      <Chip label={rec.category as string} size="small" sx={{ bgcolor: c.accentDim, color: c.accent, fontSize: 10, fontWeight: 700 }} />
                      {rec.impact === 'high' && <Chip label="השפעה גבוהה" size="small" sx={{ bgcolor: c.accent, color: '#fff', fontSize: 10, fontWeight: 700 }} />}
                    </Box>
                    <Typography sx={{ fontSize: 13, color: c.text2, lineHeight: 1.6 }}>{rec.action as string}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {Array.isArray(result.postIdeas) && (
            <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 2.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 1.5 }}>💡 רעיונות לפוסטים</Typography>
              {(result.postIdeas as string[]).map((idea, i) => (
                <Typography key={i} sx={{ fontSize: 14, color: c.text, mb: 1, pr: 2, position: 'relative' }}>
                  <Box component="span" sx={{ position: 'absolute', right: 0, color: c.accent }}>•</Box>{idea}
                </Typography>
              ))}
            </Box>
          )}

          <Button onClick={() => setResult(null)} variant="outlined" sx={{ mt: 3, borderRadius: 3 }}>נתח שוב</Button>
        </Box>
      )}
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
function LandingTab({ bizId }: { bizId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');

  const build = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/build-landing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bizId, businessName: name }),
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
        ה-AI בונה לך דף נחיתה מקצועי מלא תוך שניות. תקבל קישור לשתף.
      </Typography>

      <TextField fullWidth placeholder="שם העסק" value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2, maxWidth: 400 }} />
      <br />
      <Button onClick={build} disabled={loading || !name.trim()} variant="contained" size="large" sx={{ py: 1.5, px: 4, borderRadius: 3, fontWeight: 800 }}>
        {loading ? <><CircularProgress size={18} sx={{ color: '#fff', mr: 1 }} />בונה...</> : '✨ בנה דף נחיתה'}
      </Button>

      {error && <Box sx={{ bgcolor: c.hotDim, border: `1px solid ${c.hot}`, borderRadius: 2, p: 2, mt: 2 }}><Typography sx={{ fontSize: 13, color: c.hot }}>{error}</Typography></Box>}

      {result && (
        <Box className="zk-fade-up" sx={{ mt: 3 }}>
          <Box sx={{ bgcolor: c.accentDim, border: `2px solid ${c.accent}`, borderRadius: 3, p: 3, mb: 2 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.accent, mb: 1 }}>✓ הדף שלך מוכן!</Typography>
            <Typography sx={{ fontSize: 13, color: c.text2, mb: 2 }}>הכותרת: <strong>{result.heroTitle as string}</strong></Typography>
            <Button href={`/site/${result.slug}`} target="_blank" variant="contained" sx={{ borderRadius: 3, fontWeight: 700 }}>
              🌐 צפה בדף שלך
            </Button>
          </Box>
          <Typography sx={{ fontSize: 12, color: c.text3 }}>
            הקישור: zikkit-jvc7.vercel.app/site/{result.slug as string}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
