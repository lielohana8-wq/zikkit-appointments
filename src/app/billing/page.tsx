'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { loadBiz } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

interface Sub { plan?: string; status?: string; renewsAt?: string; }

const PLANS = [
  { id: 'founder', name: '⭐ מייסדים', price: 99, tagline: 'לעסקי הפיילוט — מחיר נעול', features: ['כל מה שב-Base', 'מחיר מייסדים קבוע לשנה', 'קו ישיר למייסד', 'השפעה על הפיצ\'רים הבאים'], featured: true },
  { id: 'base', name: 'Base', price: 149, tagline: 'כל הכלים לניהול העסק', features: ['יומן ותורים ללא הגבלה', 'דף הזמנות ממותג', 'ניהול לקוחות', 'דוחות ורווחיות', 'תזכורות וואטסאפ', 'ביקורות ומבצעים'] },
  { id: 'dana', name: '+ דנה AI', price: 349, tagline: 'הכל + סוכנת AI שעונה לטלפון', features: ['כל מה שב-Base', '🎙️ דנה עונה לטלפון 24/7', 'קביעת תורים אוטומטית', 'סיכום שיחות ב-SMS', 'מספר טלפון ייעודי', 'עדיפות בתמיכה'] },
];

export default function BillingPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [sub, setSub] = useState<Sub>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [busy, setBusy] = useState('');

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  useEffect(() => {
    if (!bizId) return;
    loadBiz(bizId).then((biz) => {
      setSub(((biz as Record<string, unknown>).subscription as Sub) || {});
    }).catch(() => {}).finally(() => setDataLoading(false));
  }, [bizId]);

  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  useEffect(() => { fetch('/api/platform/plans').then((r) => r.json()).then((d) => setLivePrices(d.plans || {})).catch(() => {}); }, []);

  const subscribe = async (plan: string) => {
    if (!bizId) return;
    setBusy(plan);
    try {
      const res = await fetch('/api/payments/create-subscription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bizId, plan, email: firebaseUser?.email }),
      });
      const data = await res.json();
      if (data.ok && data.url) { window.location.href = data.url; }
      else if (res.status === 503) alert('התשלומים עדיין לא הופעלו במערכת. נציג יצור איתך קשר.');
      else alert(data.error || 'שגיאה');
    } catch (e) { alert((e as Error).message); } finally { setBusy(''); }
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const activePlan = sub.status === 'active' ? sub.plan : null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>מנוי ותשלומים</Typography>
        <Box sx={{ width: 60 }} />
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 4 }}>
        {/* Trial / active banner */}
        {activePlan ? (
          <Box sx={{ bgcolor: c.green, color: '#fff', borderRadius: 3, p: 2.5, mb: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800 }}>✓ המנוי שלך פעיל — {activePlan === 'dana' ? 'דנה AI' : 'Base'}</Typography>
            {sub.renewsAt && <Typography sx={{ fontSize: 13, opacity: 0.9, mt: 0.5 }}>מתחדש ב-{new Date(sub.renewsAt).toLocaleDateString('he-IL')}</Typography>}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, bgcolor: c.accentDim, color: c.accent, borderRadius: 99, px: 2, py: 0.6, fontSize: 13, fontWeight: 800, mb: 1.5 }}>🎁 בתקופת פיילוט — חינם</Box>
            <Typography sx={{ fontSize: 26, fontWeight: 900, color: c.text, letterSpacing: '-0.03em' }}>בחר את התוכנית שלך</Typography>
            <Typography sx={{ fontSize: 15, color: c.text3, mt: 0.5 }}>בזמן הפיילוט הכל חינם. כשנצא לאוויר — אלה המחירים.</Typography>
          </Box>
        )}

        {/* Plans */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {PLANS.map((p) => (
            <Box key={p.id} sx={{ position: 'relative', bgcolor: c.surface1, border: `1.5px solid ${p.featured ? c.accent : c.border2}`, borderRadius: 3.5, p: 3, ...(p.featured && { boxShadow: `0 12px 32px ${c.accent}22` }) }}>
              {p.featured && <Box sx={{ position: 'absolute', top: -11, right: 20, bgcolor: c.accent, color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 99, px: 1.5, py: 0.4 }}>הכי פופולרי</Box>}
              <Typography sx={{ fontSize: 20, fontWeight: 900, color: c.text }}>{p.name}</Typography>
              <Typography sx={{ fontSize: 13, color: c.text3, mb: 2 }}>{p.tagline}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 2.5 }}>
                <Typography sx={{ fontSize: 40, fontWeight: 900, color: c.text, letterSpacing: '-0.04em' }}>₪{livePrices[p.id] ?? p.price}</Typography>
                <Typography sx={{ fontSize: 14, color: c.text3, fontWeight: 600 }}>/ חודש</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                {p.features.map((f) => (
                  <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ color: p.featured ? c.accent : c.green, fontWeight: 900, fontSize: 14 }}>✓</Box>
                    <Typography sx={{ fontSize: 13.5, color: c.text2 }}>{f}</Typography>
                  </Box>
                ))}
              </Box>
              <Button onClick={() => subscribe(p.id)} disabled={busy === p.id || activePlan === p.id} fullWidth variant={p.featured ? 'contained' : 'outlined'} sx={{ borderRadius: 2.5, fontWeight: 800, py: 1.4 }}>
                {activePlan === p.id ? 'התוכנית הנוכחית' : busy === p.id ? <CircularProgress size={20} /> : 'בחר תוכנית'}
              </Button>
            </Box>
          ))}
        </Box>

        <Typography sx={{ fontSize: 12, color: c.text3, textAlign: 'center', mt: 3 }}>
          התשלום מאובטח דרך Grow. ניתן לבטל בכל עת. המחירים אינם כוללים מע&quot;מ.
        </Typography>
      </Box>
    </Box>
  );
}
