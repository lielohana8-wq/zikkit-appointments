'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Slider } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getFirestoreDb, doc, getDoc, setDoc, BIZ_COLLECTION } from '@/lib/firebase';
import { zikkitColors as c } from '@/styles/theme';

export default function StationsPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [stations, setStations] = useState(1);
  const [dataLoading, setDataLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const snap = await getDoc(doc(getFirestoreDb(), BIZ_COLLECTION, bizId));
      if (snap.exists()) setStations(snap.data().appointments?.stations || 1);
    } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!bizId) return;
    const db = getFirestoreDb();
    const snap = await getDoc(doc(db, BIZ_COLLECTION, bizId));
    const existing = snap.exists() ? snap.data() : {};
    await setDoc(doc(db, BIZ_COLLECTION, bizId), {
      ...existing,
      appointments: { ...(existing.appointments || {}), stations },
    }, { merge: true });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.surface1 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 800, color: c.text }}>ניהול עמדות</Typography>
        <Box sx={{ width: 80 }} />
      </Box>

      <Box sx={{ maxWidth: 500, mx: 'auto', p: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ fontSize: 56, mb: 2 }}>💺</Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: c.text, mb: 1 }}>כמה עמדות יש בעסק?</Typography>
          <Typography sx={{ fontSize: 14, color: c.text2 }}>דנה תוכל לקבוע עד {stations} תורים במקביל באותה שעה</Typography>
        </Box>

        <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography sx={{ fontSize: 56, fontWeight: 800, color: c.accent }}>{stations}</Typography>
            <Typography sx={{ fontSize: 14, color: c.text3 }}>כיסאות / עמדות / מטפלים</Typography>
          </Box>
          <Slider value={stations} onChange={(_, v) => setStations(v as number)} min={1} max={15} step={1} marks valueLabelDisplay="auto" sx={{ color: c.accent, '& .MuiSlider-thumb': { width: 24, height: 24 } }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography sx={{ fontSize: 12, color: c.text3 }}>עמדה אחת</Typography>
            <Typography sx={{ fontSize: 12, color: c.text3 }}>15 עמדות</Typography>
          </Box>
        </Box>

        <Box sx={{ bgcolor: c.accentDim, borderRadius: 3, p: 2.5, mt: 3 }}>
          <Typography sx={{ fontSize: 13, color: c.text2, lineHeight: 1.6 }}>
            💡 לדוגמה: אם יש לך 3 כיסאות במספרה, דנה תוכל לקבוע 3 תספורות לאותה שעה — אבל לא תקבע תור רביעי עד שאחד מתפנה.
          </Typography>
        </Box>

        <Button onClick={save} variant="contained" fullWidth sx={{ mt: 3, py: 1.75, borderRadius: 3, fontWeight: 800 }}>
          {saved ? '✓ נשמר!' : 'שמור'}
        </Button>
      </Box>
    </Box>
  );
}
