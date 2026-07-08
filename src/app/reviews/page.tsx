'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog, TextField, Switch } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getReviews, addReview, updateReview, deleteReview, reviewStats, type Review } from '@/lib/bizdata';
import { useToast } from '@/components/Toast';
import { PageSkeleton } from '@/components/Skeleton';
import { zikkitColors as c } from '@/styles/theme';

export default function ReviewsPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ customerName: '', rating: 5, text: '', service: '' });

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try { setReviews(await getReviews(bizId)); } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!bizId || !draft.customerName || !draft.text) return;
    setSaving(true);
    try { await addReview(bizId, { ...draft, published: true }); setOpen(false); setDraft({ customerName: '', rating: 5, text: '', service: '' }); await load(); showToast('הביקורת נוספה', 'success'); }
    catch (e) { showToast('שגיאה: ' + (e as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const togglePublish = async (r: Review) => {
    if (!bizId) return;
    await updateReview(bizId, r.id, { published: !r.published });
    await load();
  };

  if (loading || dataLoading) return <PageSkeleton rows={6} />;

  const stats = reviewStats(reviews);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>ביקורות</Typography>
        <Button onClick={() => setOpen(true)} variant="contained" sx={{ borderRadius: 99, fontWeight: 700, px: 2.5 }}>+ ביקורת</Button>
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 680, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {/* Stats hero */}
        <Box sx={{ bgcolor: c.accent, borderRadius: 2, p: { xs: 3, sm: 4 }, color: '#fff', mb: 3, boxShadow: c.shadowLg, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 52, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{stats.avg || '—'}</Typography>
          <Typography sx={{ fontSize: 22, mb: 0.5 }}>{'★'.repeat(Math.round(stats.avg))}{'☆'.repeat(5 - Math.round(stats.avg))}</Typography>
          <Typography sx={{ fontSize: 13, opacity: 0.85 }}>{stats.count} ביקורות</Typography>
        </Box>

        {/* Distribution */}
        {stats.count > 0 && (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 3, mb: 3 }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.distribution[star - 1];
              const pct = stats.count ? (count / stats.count) * 100 : 0;
              return (
                <Box key={star} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: c.text2, minWidth: 30 }}>{star} ★</Typography>
                  <Box sx={{ flex: 1, height: 8, bgcolor: c.surface3, borderRadius: 99, overflow: 'hidden' }}>
                    <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: '#FFB224', borderRadius: 99 }} />
                  </Box>
                  <Typography sx={{ fontSize: 12.5, color: c.text3, minWidth: 24, textAlign: 'left' }}>{count}</Typography>
                </Box>
              );
            })}
          </Box>
        )}

        {/* List */}
        {reviews.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{ fontSize: 40, mb: 1.5, opacity: 0.5 }}>⭐</Box>
            <Typography sx={{ color: c.text3 }}>עדיין אין ביקורות</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {reviews.map((r) => (
              <Box key={r.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: c.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>{r.customerName?.[0] || '?'}</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: c.text }}>{r.customerName}</Typography>
                    <Typography sx={{ fontSize: 13, color: '#FFB224' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 11.5, color: c.text3 }}>{r.date}</Typography>
                </Box>
                <Typography sx={{ fontSize: 13.5, color: c.text2, lineHeight: 1.6, mb: 1.5 }}>{r.text}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1.5, borderTop: `1px solid ${c.border}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Switch size="small" checked={r.published} onChange={() => togglePublish(r)} />
                    <Typography sx={{ fontSize: 12.5, color: r.published ? c.green : c.text3, fontWeight: 600 }}>{r.published ? 'מוצג בדף ההזמנות' : 'מוסתר'}</Typography>
                  </Box>
                  <Button onClick={async () => { if (bizId) { await deleteReview(bizId, r.id); await load(); } }} size="small" sx={{ minWidth: 'auto', color: c.text3, fontSize: 12, '&:hover': { color: c.hot } }}>מחק</Button>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Dialog scroll="body" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { borderRadius: 2, p: 3.5, maxWidth: 400, width: '100%' } }}>
        <Typography sx={{ fontSize: 21, fontWeight: 800, mb: 2.5, color: c.text }}>הוסף ביקורת</Typography>
        <TextField fullWidth label="שם הלקוח" value={draft.customerName} onChange={(e) => setDraft((p) => ({ ...p, customerName: e.target.value }))} sx={{ mb: 2 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 1 }}>דירוג</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, mb: 2.5 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Box key={star} onClick={() => setDraft((p) => ({ ...p, rating: star }))} sx={{ cursor: 'pointer', fontSize: 32, color: star <= draft.rating ? '#FFB224' : c.surface4 }}>★</Box>
          ))}
        </Box>
        <TextField fullWidth label="הביקורת" value={draft.text} onChange={(e) => setDraft((p) => ({ ...p, text: e.target.value }))} multiline rows={3} sx={{ mb: 2 }} />
        <TextField fullWidth label="שירות (אופציונלי)" value={draft.service} onChange={(e) => setDraft((p) => ({ ...p, service: e.target.value }))} sx={{ mb: 3 }} />
        <Button onClick={save} variant="contained" fullWidth disabled={!draft.customerName || !draft.text || saving} sx={{ borderRadius: 1.5, fontWeight: 700, py: 1.5 }}>
          {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'הוסף ביקורת'}
        </Button>
      </Dialog>
    </Box>
  );
}
