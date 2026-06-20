'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Box, Typography, Button, CircularProgress } from '@mui/material';

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
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

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

  // Fetch real free slots whenever the chosen date changes (reschedule mode)
  const loadSlots = useCallback(async (date: string) => {
    if (!date) { setSlots([]); return; }
    setSlotsLoading(true); setNewTime('');
    try {
      const r = await fetch(`/api/manage-booking?bizId=${bizId}&token=${token}&slotsDate=${date}`);
      const d = await r.json();
      setSlots(d.slots || []);
    } catch { setSlots([]); } finally { setSlotsLoading(false); }
  }, [bizId, token]);

  useEffect(() => { if (mode === 'reschedule' && newDate) loadSlots(newDate); }, [mode, newDate, loadSlots]);

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
      else if (d.error === 'slot_taken') { setError('השעה הזו כבר תפוסה. בחר שעה אחרת.'); loadSlots(newDate); }
      else setError('לא הצלחנו לעדכן. נסה שוב.');
    } catch { setError('שגיאה.'); } finally { setBusy(false); }
  };

  // Next 14 days as quick date chips
  const dateChips = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });
  const dayName = (iso: string) => ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][new Date(iso + 'T00:00:00').getDay()];

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#F5F3FF,#FAFAFA)' }}><CircularProgress sx={{ color: accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(160deg,#F5F3FF 0%,#FAFAFA 40%)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }} dir="rtl">
      <Box sx={{ maxWidth: 440, width: '100%', bgcolor: '#fff', borderRadius: 5, overflow: 'hidden', boxShadow: '0 20px 60px rgba(124,58,237,0.12)', border: '1px solid #F0EDFA' }}>
        {error && !booking ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 3 }}>
            <Box sx={{ fontSize: 44, mb: 2 }}>😕</Box>
            <Typography sx={{ fontSize: 16, color: '#444', fontWeight: 600 }}>{error}</Typography>
          </Box>
        ) : mode === 'done' ? (
          <Box sx={{ textAlign: 'center', py: 6, px: 4 }}>
            <Box sx={{ width: 84, height: 84, borderRadius: '50%', bgcolor: accent, color: '#fff', fontSize: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3, boxShadow: '0 10px 30px rgba(124,58,237,0.35)' }}>✓</Box>
            <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#1C1917', mb: 1, letterSpacing: '-0.02em' }}>בוצע!</Typography>
            <Typography sx={{ fontSize: 15, color: '#57534E', lineHeight: 1.55 }}>{doneMsg}</Typography>
          </Box>
        ) : booking && mode === 'view' ? (
          <>
            {/* Header band */}
            <Box sx={{ background: `linear-gradient(135deg, ${accent}, #5B21B6)`, color: '#fff', p: 3.5, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)' }} />
              <Typography sx={{ fontSize: 12, fontWeight: 800, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.12em', position: 'relative' }}>{bizName}</Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', mt: 0.5, position: 'relative' }}>התור שלך</Typography>
              {booking.status === 'cancelled' && <Box sx={{ display: 'inline-block', mt: 1.5, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 99, px: 2, py: 0.5, fontSize: 13, fontWeight: 700, position: 'relative' }}>בוטל</Box>}
            </Box>

            <Box sx={{ p: 3.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box sx={{ textAlign: 'center', bgcolor: `${accent}0F`, borderRadius: 3, px: 2.5, py: 1.5, minWidth: 92 }}>
                  <Typography sx={{ fontSize: 30, fontWeight: 900, color: accent, lineHeight: 1, letterSpacing: '-0.03em' }}>{booking.time}</Typography>
                  <Typography sx={{ fontSize: 12, color: accent, fontWeight: 700, mt: 0.5 }}>{booking.date}</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#1C1917' }}>{booking.service}</Typography>
                  <Typography sx={{ fontSize: 13.5, color: '#78716C' }}>{booking.duration} דקות{booking.staff ? ` · עם ${booking.staff}` : ''}</Typography>
                </Box>
              </Box>

              {booking.status !== 'cancelled' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  <Button onClick={() => { setMode('reschedule'); setNewDate(booking.date); }} variant="contained" sx={{ borderRadius: 3, fontWeight: 800, py: 1.5, fontSize: 16, bgcolor: accent, boxShadow: `0 8px 24px ${accent}40`, '&:hover': { bgcolor: '#6D28D9' } }}>📅 שנה מועד</Button>
                  <Button onClick={cancel} disabled={busy} sx={{ borderRadius: 3, fontWeight: 700, py: 1.25, color: '#E5484D', '&:hover': { bgcolor: '#FEF2F2' } }}>{busy ? <CircularProgress size={20} /> : 'בטל תור'}</Button>
                </Box>
              )}
            </Box>
          </>
        ) : booking && mode === 'reschedule' ? (
          <Box sx={{ p: 3.5 }}>
            <Button onClick={() => { setMode('view'); setError(''); }} sx={{ color: '#A8A29E', mb: 1, fontWeight: 600, minWidth: 'auto', p: 0 }}>‹ חזרה</Button>
            <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#1C1917', mb: 2.5, letterSpacing: '-0.02em' }}>בחרו מועד חדש</Typography>

            {/* Date chips */}
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#78716C', mb: 1 }}>יום</Typography>
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1.5, mb: 2.5, '&::-webkit-scrollbar': { height: 0 } }}>
              {dateChips.map((d) => {
                const sel = d === newDate;
                const dd = new Date(d + 'T00:00:00');
                return (
                  <Box key={d} onClick={() => setNewDate(d)} sx={{ cursor: 'pointer', flexShrink: 0, textAlign: 'center', minWidth: 56, py: 1, borderRadius: 2.5, border: `1.5px solid ${sel ? accent : '#E7E5E4'}`, bgcolor: sel ? accent : '#fff', color: sel ? '#fff' : '#1C1917', transition: 'all 0.15s' }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, opacity: 0.8 }}>{dayName(d)}</Typography>
                    <Typography sx={{ fontSize: 17, fontWeight: 800 }}>{dd.getDate()}</Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Real free slots */}
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#78716C', mb: 1 }}>שעות פנויות</Typography>
            {slotsLoading ? (
              <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: accent }} /></Box>
            ) : slots.length === 0 ? (
              <Typography sx={{ textAlign: 'center', color: '#A8A29E', py: 3, fontSize: 14 }}>אין שעות פנויות ביום זה 😔<br />נסו יום אחר</Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 1 }}>
                {slots.map((t) => {
                  const sel = t === newTime;
                  return (
                    <Box key={t} onClick={() => setNewTime(t)} sx={{ cursor: 'pointer', textAlign: 'center', py: 1.25, borderRadius: 2, border: `1.5px solid ${sel ? accent : '#E7E5E4'}`, bgcolor: sel ? accent : '#fff', color: sel ? '#fff' : '#1C1917', fontWeight: 700, fontSize: 14.5, transition: 'all 0.12s' }}>{t}</Box>
                  );
                })}
              </Box>
            )}

            {error && <Typography sx={{ fontSize: 13, color: '#E5484D', mt: 1.5, fontWeight: 600, textAlign: 'center' }}>{error}</Typography>}

            <Button onClick={reschedule} disabled={busy || !newDate || !newTime} fullWidth variant="contained" sx={{ mt: 2.5, borderRadius: 3, fontWeight: 800, py: 1.5, fontSize: 16, bgcolor: accent, boxShadow: `0 8px 24px ${accent}40`, '&:hover': { bgcolor: '#6D28D9' }, '&.Mui-disabled': { bgcolor: '#E7E5E4' } }}>{busy ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'אשרו שינוי'}</Button>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
