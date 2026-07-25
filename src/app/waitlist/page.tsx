'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/Toast';
import { getWaitlist, updateWaitlistEntry, deleteWaitlistEntry, type WaitlistEntry } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

export default function WaitlistPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<WaitlistEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try { setItems(await getWaitlist(bizId)); } catch { /* ignore */ } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const mark = async (id: string, status: string) => {
    if (!bizId) return;
    try {
      await updateWaitlistEntry(bizId, id, { status });
      setItems((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w)));
      showToast(status === 'contacted' ? 'סומן: יצרת קשר' : status === 'booked' ? 'סומן: נקבע תור' : 'עודכן', 'success');
    } catch (e) { showToast((e as Error).message, 'error'); }
  };

  const remove = async (id: string) => {
    if (!bizId) return;
    try {
      await deleteWaitlistEntry(bizId, id);
      setItems((prev) => prev.filter((w) => w.id !== id));
      showToast('הוסר מהרשימה', 'success');
    } catch (e) { showToast((e as Error).message, 'error'); }
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const waiting = items.filter((w) => w.status === 'waiting');
  const others = items.filter((w) => w.status !== 'waiting');

  const card = (w: WaitlistEntry) => (
    <Box key={w.id} sx={{ bgcolor: c.card, border: `1px solid ${c.border2}`, borderRadius: 4, p: 2.25, mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 600, color: c.text }}>{w.name}</Typography>
          <Typography sx={{ fontSize: 13, color: c.text3 }}>
            {[w.service, w.staff, w.preferredDate].filter(Boolean).join(' · ') || 'ללא העדפה'}
          </Typography>
        </Box>
        {w.status === 'contacted' && <Box sx={{ fontSize: 11, fontWeight: 600, color: '#fff', bgcolor: c.accent, borderRadius: 99, px: 1.25, py: 0.25 }}>יצרת קשר</Box>}
        {w.status === 'booked' && <Box sx={{ fontSize: 11, fontWeight: 600, color: '#fff', bgcolor: c.green, borderRadius: 99, px: 1.25, py: 0.25 }}>נקבע</Box>}
      </Box>
      {w.note && <Typography sx={{ fontSize: 13, color: c.text2, bgcolor: c.fill, borderRadius: 1.5, p: 1.25, mb: 1.5 }}>{w.note}</Typography>}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <Button href={`tel:${w.phone}`} size="small" variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 500, fontSize: 12.5 }}>📞 {w.phone}</Button>
        <Button href={`https://wa.me/972${w.phone.replace(/^0/, '')}`} target="_blank" size="small" variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 500, fontSize: 12.5, color: c.green, borderColor: c.border2 }}>💬 וואטסאפ</Button>
        <Box sx={{ flex: 1 }} />
        {w.status === 'waiting' && <Button onClick={() => mark(w.id, 'contacted')} size="small" sx={{ borderRadius: 1.5, fontWeight: 500, fontSize: 12.5, color: c.accent }}>יצרתי קשר</Button>}
        {w.status !== 'booked' && <Button onClick={() => mark(w.id, 'booked')} size="small" sx={{ borderRadius: 1.5, fontWeight: 500, fontSize: 12.5, color: c.green }}>נקבע תור</Button>}
        <Button onClick={() => remove(w.id)} size="small" sx={{ borderRadius: 1.5, fontWeight: 500, fontSize: 12.5, color: c.text3, minWidth: 'auto' }}>✕</Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.canvas }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.chrome, backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 600, color: c.text }}>רשימת המתנה</Typography>
        <Button onClick={load} sx={{ color: c.text3, fontWeight: 600, minWidth: 'auto' }}>↻</Button>
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 640, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {items.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: 40, mb: 1.5, opacity: 0.5 }}>🔔</Box>
            <Typography sx={{ color: c.text3 }}>אין אף אחד ברשימת ההמתנה כרגע</Typography>
            <Typography sx={{ color: c.text3, fontSize: 13, mt: 0.5 }}>לקוחות יוכלו להירשם מדף ההזמנות כשהיומן מלא</Typography>
          </Box>
        ) : (
          <>
            {waiting.length > 0 && (
              <>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: c.text3, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5 }}>ממתינים ({waiting.length})</Typography>
                {waiting.map(card)}
              </>
            )}
            {others.length > 0 && (
              <>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: c.text3, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.5, mt: 3 }}>טופלו</Typography>
                {others.map(card)}
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
