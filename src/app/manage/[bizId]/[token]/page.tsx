'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Box, Typography, Button, CircularProgress, TextField } from '@mui/material';

interface BookingInfo {
  service: string; date: string; time: string; duration: number;
  staff: string | null; status: string; customerName: string;
}

export default function ManageBookingPage() {
  const params = useParams();
  const bizId = params.bizId as string;
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [bizName, setBizName] = useState('');
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'view' | 'reschedule' | 'done'>('view');
  const [doneMsg, setDoneMsg] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const accent = '#7C3AED';

  useEffect(() => {
    fetch(`/api/manage-booking?bizId=${bizId}&token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.booking) { setBooking(d.booking); setBizName(d.bizName); }
        else setError('התור לא נמצא או שהקישור פג תוקף.');
      })
      .catch(() => setError('שגיאה בטעינת התור.'))
      .finally(() => setLoading(false));
  }, [bizId, token]);

  const cancel = async () => {
    if (!confirm('לבטל את התור?')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/manage-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bizId, token, action: 'cancel' }),
      });
      const d = await r.json();
      if (d.success) { setMode('done'); setDoneMsg('התור בוטל. תודה שעדכנת אותנו!'); }
      else setError('לא הצלחנו לבטל. נסה שוב או התקשר לעסק.');
    } catch { setError('שגיאה.'); } finally { setBusy(false); }
  };

  const reschedule = async () => {
    if (!newDate || !newTime) return;
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/manage-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bizId, token, action: 'reschedule', date: newDate, time: newTime }),
      });
      const d = await r.json();
      if (d.success) { setMode('done'); setDoneMsg(`התור עודכן ל-${newDate} בשעה ${newTime}.`); }
      else if (d.error === 'slot_taken') setError('השעה הזו כבר תפוסה. בחר שעה אחרת.');
      else setError('לא הצלחנו לעדכן. נסה שוב.');
    } catch { setError('שגיאה.'); } finally { setBusy(false); }
  };

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#FAFAFA' }}><CircularProgress sx={{ color: accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }} dir="rtl">
      <Box sx={{ maxWidth: 420, width: '100%', bgcolor: '#fff', borderRadius: 4, p: { xs: 3, sm: 4 }, boxShadow: '0 8px 40px rgba(0,0,0,0.08)', border: '1px solid #EEE' }}>
        {error && !booking ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Box sx={{ fontSize: 40, mb: 2 }}>😕</Box>
            <Typography sx={{ fontSize: 16, color: '#444', fontWeight: 600 }}>{error}</Typography>
          </Box>
        ) : mode === 'done' ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Box sx={{ width: 76, height: 76, borderRadius: '50%', bgcolor: accent, color: '#fff', fontSize: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5 }}>✓</Box>
            <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#1C1917', mb: 1, letterSpacing: '-0.02em' }}>בוצע!</Typography>
            <Typography sx={{ fontSize: 15, color: '#57534E', lineHeight: 1.5 }}>{doneMsg}</Typography>
          </Box>
        ) : booking && mode === 'view' ? (
          <>
            <Typography sx={{ fontSize: 12, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>{bizName}</Typography>
            <Typography sx={{ fontSize: 23, fontWeight: 900, color: '#1C1917', textAlign: 'center', mt: 0.5, mb: 0.5, letterSpacing: '-0.02em' }}>התור שלך</Typography>
            {booking.status === 'cancelled' && <Typography sx={{ fontSize: 14, color: '#E5484D', fontWeight: 700, textAlign: 'center', mb: 2 }}>התור בוטל</Typography>}

            <Box sx={{ bgcolor: '#FAF8FF', border: `1px solid ${accent}22`, borderRadius: 3, p: 2.5, my: 2.5 }}>
              <Row label="שירות" value={booking.service} />
              <Row label="תאריך" value={booking.date} />
              <Row label="שעה" value={booking.time} />
              {booking.staff && <Row label="עם" value={booking.staff} />}
            </Box>

            {booking.status !== 'cancelled' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <Button onClick={() => { setMode('reschedule'); setNewDate(booking.date); setNewTime(booking.time); }} variant="contained" sx={{ borderRadius: 2.5, fontWeight: 800, py: 1.4, bgcolor: accent, '&:hover': { bgcolor: '#6D28D9' } }}>שנה מועד</Button>
                <Button onClick={cancel} disabled={busy} sx={{ borderRadius: 2.5, fontWeight: 700, py: 1.2, color: '#E5484D' }}>{busy ? <CircularProgress size={20} /> : 'בטל תור'}</Button>
              </Box>
            )}
          </>
        ) : booking && mode === 'reschedule' ? (
          <>
            <Typography sx={{ fontSize: 20, fontWeight: 900, color: '#1C1917', mb: 2.5, letterSpacing: '-0.02em' }}>בחר מועד חדש</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
              <TextField label="תאריך" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} sx={{ flex: 1 }} InputLabelProps={{ shrink: true }} />
              <TextField label="שעה" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} sx={{ flex: 1 }} InputLabelProps={{ shrink: true }} />
            </Box>
            {error && <Typography sx={{ fontSize: 13, color: '#E5484D', mb: 2, fontWeight: 600 }}>{error}</Typography>}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => { setMode('view'); setError(''); }} sx={{ flex: 1, borderRadius: 2.5, fontWeight: 700, color: '#78716C' }}>חזרה</Button>
              <Button onClick={reschedule} disabled={busy || !newDate || !newTime} variant="contained" sx={{ flex: 2, borderRadius: 2.5, fontWeight: 800, bgcolor: accent, '&:hover': { bgcolor: '#6D28D9' } }}>{busy ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'אשר שינוי'}</Button>
            </Box>
          </>
        ) : null}
      </Box>
    </Box>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75 }}>
      <Typography sx={{ fontSize: 13, color: '#78716C', fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: 15, color: '#1C1917', fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}
