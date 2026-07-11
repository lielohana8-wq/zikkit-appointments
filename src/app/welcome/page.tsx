'use client';

/**
 * Self-serve onboarding — a new business goes from signup to a LIVE app in
 * three steps: identity → hours → first service. No human in the loop.
 */

import { useEffect, useState } from 'react';
import { Box, Typography, Button, TextField, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { patchBiz } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function WelcomePage() {
  const router = useRouter();
  const { firebaseUser, loading, user } = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bizName, setBizName] = useState('');
  const [phone, setPhone] = useState('');
  const [days, setDays] = useState<Record<number, { open: boolean; start: string; end: string }>>({
    0: { open: true, start: '09:00', end: '19:00' }, 1: { open: true, start: '09:00', end: '19:00' },
    2: { open: true, start: '09:00', end: '19:00' }, 3: { open: true, start: '09:00', end: '19:00' },
    4: { open: true, start: '09:00', end: '19:00' }, 5: { open: true, start: '09:00', end: '14:00' },
    6: { open: false, start: '09:00', end: '19:00' },
  });
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcDuration, setSvcDuration] = useState('30');

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);
  useEffect(() => { if (!loading && user?.role === 'owner') router.push('/dashboard'); }, [loading, user, router]);

  const finish = async () => {
    if (!firebaseUser) return;
    setBusy(true);
    try {
      const now = new Date();
      const trialEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await patchBiz(firebaseUser.uid, {
        createdAt: now.toISOString(),
        cfg: { biz_name: bizName.trim(), owner_phone: phone.trim(), lang: 'he', currency: 'ILS', region: 'IL', plan: 'trial', planStatus: 'trial', trialEnds, created_at: now.toISOString() },
        hours: { days },
        booking: { notifyPhone: phone.trim(), requireRegistration: true, slotInterval: 30 },
        services: { items: [{ id: 'svc_' + Date.now(), name: svcName.trim() || 'שירות', category: '', price: Number(svcPrice) || 0, priceFrom: false, duration: Number(svcDuration) || 30, description: '', whatToAsk: '' }] },
      });
      window.location.replace('/dashboard');
    } catch {
      setBusy(false);
      alert('משהו השתבש — נסו שוב');
    }
  };

  const canNext = step === 0 ? bizName.trim().length >= 2 && phone.replace(/\D/g, '').length >= 9 : step === 1 ? true : svcName.trim().length >= 2 && Number(svcPrice) > 0;

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2, py: 5 }}>
      <Typography sx={{ fontSize: 26, fontWeight: 900, color: c.text, mb: 0.5 }}>ברוכים הבאים לזיקית 💜</Typography>
      <Typography sx={{ fontSize: 13.5, color: c.text3, mb: 3 }}>3 צעדים — והאפליקציה של העסק שלך באוויר</Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 3.5 }}>
        {[0, 1, 2].map((i) => <Box key={i} sx={{ width: i === step ? 26 : 9, height: 9, borderRadius: 99, bgcolor: i <= step ? c.accent : c.surface3, transition: 'all .3s' }} />)}
      </Box>

      <Box sx={{ width: '100%', maxWidth: 440, bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 4, p: 3 }}>
        {step === 0 && (<>
          <Typography sx={{ fontSize: 17, fontWeight: 900, color: c.text, mb: 2 }}>🏪 מי אתם?</Typography>
          <TextField fullWidth label="שם העסק (כמו שהלקוחות מכירים)" value={bizName} onChange={(e) => setBizName(e.target.value)} sx={{ mb: 2 }} autoFocus />
          <TextField fullWidth label="הטלפון שלך (להתראות על תורים)" value={phone} onChange={(e) => setPhone(e.target.value)} inputProps={{ inputMode: 'tel' }} />
        </>)}

        {step === 1 && (<>
          <Typography sx={{ fontSize: 17, fontWeight: 900, color: c.text, mb: 0.5 }}>🕐 שעות פעילות</Typography>
          <Typography sx={{ fontSize: 12, color: c.text3, mb: 2 }}>אפשר לדייק הכל אחר-כך בהגדרות</Typography>
          {DAY_NAMES.map((dn, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box onClick={() => setDays((p) => ({ ...p, [i]: { ...p[i], open: !p[i].open } }))} sx={{ cursor: 'pointer', width: 64, fontSize: 13, fontWeight: 800, color: days[i].open ? c.accent : c.text3 }}>{days[i].open ? '✓' : '✕'} {dn}</Box>
              {days[i].open && (<>
                <TextField size="small" type="time" value={days[i].start} onChange={(e) => setDays((p) => ({ ...p, [i]: { ...p[i], start: e.target.value } }))} sx={{ width: 115 }} />
                <Typography sx={{ color: c.text3 }}>–</Typography>
                <TextField size="small" type="time" value={days[i].end} onChange={(e) => setDays((p) => ({ ...p, [i]: { ...p[i], end: e.target.value } }))} sx={{ width: 115 }} />
              </>)}
            </Box>
          ))}
        </>)}

        {step === 2 && (<>
          <Typography sx={{ fontSize: 17, fontWeight: 900, color: c.text, mb: 2 }}>💈 השירות הראשון שלך</Typography>
          <TextField fullWidth label="שם השירות (למשל: תספורת גבר)" value={svcName} onChange={(e) => setSvcName(e.target.value)} sx={{ mb: 2 }} autoFocus />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField label="מחיר ₪" type="number" value={svcPrice} onChange={(e) => setSvcPrice(e.target.value)} sx={{ flex: 1 }} />
            <TextField label="משך (דקות)" type="number" value={svcDuration} onChange={(e) => setSvcDuration(e.target.value)} sx={{ flex: 1 }} />
          </Box>
          <Typography sx={{ fontSize: 12, color: c.text3, mt: 1.5 }}>עוד שירותים, צוות, עיצוב ולוגו — מיד אחרי, מהדשבורד 🎨</Typography>
        </>)}

        <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
          {step > 0 && <Button onClick={() => setStep(step - 1)} sx={{ color: c.text2, fontWeight: 700 }}>← חזרה</Button>}
          <Box sx={{ flex: 1 }} />
          {step < 2 && <Button onClick={() => setStep(step + 1)} disabled={!canNext} variant="contained" sx={{ bgcolor: c.accent, fontWeight: 900, borderRadius: 2.5, px: 4 }}>המשך ←</Button>}
          {step === 2 && <Button onClick={finish} disabled={!canNext || busy} variant="contained" sx={{ bgcolor: c.accent, fontWeight: 900, borderRadius: 2.5, px: 4 }}>{busy ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : '🚀 שגר את העסק!'}</Button>}
        </Box>
      </Box>
    </Box>
  );
}
