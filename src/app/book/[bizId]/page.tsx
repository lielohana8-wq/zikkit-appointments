'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, TextField } from '@mui/material';
import { useParams } from 'next/navigation';

interface Service { id: string; name: string; duration: number; price?: string | number; }
interface Branding { logo: string; banner: string; brandColor: string; welcomeText: string; showPrices: boolean; }
interface BizInfo {
  enabled: boolean;
  businessName: string;
  services: Service[];
  stations: number;
  hours: Record<number, { open: boolean; start: string; end: string }> | null;
  bookings: Array<{ date: string; time: string; duration: number }>;
  branding: Branding;
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function PublicBookingPage() {
  const params = useParams();
  const bizId = params.bizId as string;
  const [info, setInfo] = useState<BizInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<'service' | 'slot' | 'details' | 'done'>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [form, setForm] = useState({ name: '', phone: '' });
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!bizId) return;
    fetch(`/api/public-booking?bizId=${bizId}`)
      .then((r) => r.json())
      .then((d) => setInfo(d))
      .finally(() => setLoading(false));
  }, [bizId]);

  const accent = info?.branding?.brandColor || '#9333EA';

  // Compute free slots for selected service + date
  const freeSlots = useCallback((date: string): string[] => {
    if (!info || !selectedService) return [];
    const dow = new Date(date).getDay();
    const dh = info.hours?.[dow] || { open: dow !== 6, start: '09:00', end: '19:00' };
    if (!dh.open) return [];
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
    const toStr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const dur = selectedService.duration || 30;
    const slots: string[] = [];
    for (let t = toMin(dh.start); t + dur <= toMin(dh.end); t += 15) {
      const overlap = info.bookings.filter((b) => {
        if (b.date !== date) return false;
        const bs = toMin(b.time); const be = bs + (b.duration || 30);
        return t < be && t + dur > bs;
      }).length;
      if (overlap < info.stations) slots.push(toStr(t));
    }
    return slots;
  }, [info, selectedService]);

  const submit = async () => {
    if (!info || !selectedService || !form.name || !form.phone) return;
    setBooking(true);
    try {
      const res = await fetch('/api/public-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bizId,
          booking: {
            customerName: form.name, customerPhone: form.phone,
            service: selectedService.name, duration: selectedService.duration,
            date: selectedDate, time: selectedTime,
            price: typeof selectedService.price === 'string' ? parseInt(selectedService.price) || 0 : selectedService.price || 0,
          },
        }),
      });
      const data = await res.json();
      if (data.success) setStage('done');
      else alert(data.error || 'שגיאה');
    } finally { setBooking(false); }
  };

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#FCFBF9' }}><CircularProgress sx={{ color: accent }} /></Box>;

  if (!info || !info.enabled) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#FCFBF9', p: 3, textAlign: 'center', direction: 'rtl' }}>
        <Box sx={{ fontSize: 56, mb: 2 }}>🔒</Box>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#1C1917', mb: 1 }}>דף ההזמנות אינו זמין</Typography>
        <Typography sx={{ fontSize: 14, color: '#57534E' }}>בעל העסק עדיין לא הפעיל הזמנות מקוונות.</Typography>
      </Box>
    );
  }

  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]; });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#FCFBF9', direction: 'rtl', pb: 6 }}>
      {/* Branded header */}
      <Box sx={{ background: info.branding.banner ? `url(${info.branding.banner}) center/cover` : `linear-gradient(160deg, ${accent}22, #FCFBF9)`, py: info.branding.banner ? 0 : 5, position: 'relative', minHeight: info.branding.banner ? 200 : 'auto' }}>
        {info.branding.banner && <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.35)' }} />}
        <Box sx={{ position: 'relative', textAlign: 'center', py: info.branding.banner ? 5 : 0 }}>
          {info.branding.logo ? (
            <Box component="img" src={info.branding.logo} sx={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', mb: 2, border: '3px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }} />
          ) : (
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, mx: 'auto', mb: 2 }}>{info.businessName[0]}</Box>
          )}
          <Typography sx={{ fontSize: 28, fontWeight: 800, color: info.branding.banner ? '#fff' : '#1C1917' }}>{info.businessName}</Typography>
          {info.branding.welcomeText && <Typography sx={{ fontSize: 15, color: info.branding.banner ? 'rgba(255,255,255,0.9)' : '#57534E', mt: 1, maxWidth: 400, mx: 'auto', px: 2 }}>{info.branding.welcomeText}</Typography>}
        </Box>
      </Box>

      <Box sx={{ maxWidth: 480, mx: 'auto', px: 2, mt: 3 }}>
        {/* Progress */}
        {stage !== 'done' && (
          <Box sx={{ display: 'flex', gap: 1, mb: 3, justifyContent: 'center' }}>
            {['service', 'slot', 'details'].map((s, i) => (
              <Box key={s} sx={{ width: stage === s ? 28 : 8, height: 8, borderRadius: 99, bgcolor: ['service', 'slot', 'details'].indexOf(stage) >= i ? accent : '#E7E1DA', transition: 'all 0.3s' }} />
            ))}
          </Box>
        )}

        {/* STAGE 1: Service */}
        {stage === 'service' && (
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#1C1917', mb: 2, textAlign: 'center' }}>בחר שירות</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {info.services.length === 0 && <Typography sx={{ textAlign: 'center', color: '#A8A29E' }}>אין שירותים זמינים</Typography>}
              {info.services.map((s) => (
                <Box key={s.id} onClick={() => { setSelectedService(s); setStage('slot'); }}
                  sx={{ cursor: 'pointer', bgcolor: '#fff', border: '1px solid #E7E1DA', borderRadius: 3, p: 2.5, display: 'flex', alignItems: 'center', gap: 2, transition: 'all 0.2s', '&:hover': { borderColor: accent, transform: 'translateY(-2px)' } }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#1C1917' }}>{s.name}</Typography>
                    <Typography sx={{ fontSize: 13, color: '#A8A29E' }}>{s.duration} דקות</Typography>
                  </Box>
                  {info.branding.showPrices && s.price ? <Typography sx={{ fontSize: 18, fontWeight: 800, color: accent }}>₪{s.price}</Typography> : null}
                  <Box sx={{ color: accent, fontSize: 20 }}>←</Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* STAGE 2: Slot */}
        {stage === 'slot' && selectedService && (
          <Box>
            <Button onClick={() => setStage('service')} sx={{ color: '#A8A29E', mb: 1 }}>← שירותים</Button>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#1C1917', mb: 2, textAlign: 'center' }}>בחר תאריך ושעה</Typography>
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1, mb: 2 }}>
              {days.map((d, i) => {
                const dateObj = new Date(d);
                const has = freeSlots(d).length > 0;
                const active = d === selectedDate;
                return (
                  <Box key={d} onClick={() => has && (setSelectedDate(d), setSelectedTime(''))} sx={{ cursor: has ? 'pointer' : 'default', opacity: has ? 1 : 0.4, minWidth: 60, textAlign: 'center', py: 1.25, borderRadius: 2.5, bgcolor: active ? accent : '#fff', color: active ? '#fff' : '#1C1917', border: `1px solid ${active ? accent : '#E7E1DA'}` }}>
                    <Typography sx={{ fontSize: 10 }}>{i === 0 ? 'היום' : HEBREW_DAYS[dateObj.getDay()]}</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{dateObj.getDate()}</Typography>
                  </Box>
                );
              })}
            </Box>
            {selectedDate && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                {freeSlots(selectedDate).map((t) => (
                  <Box key={t} onClick={() => { setSelectedTime(t); setStage('details'); }}
                    sx={{ cursor: 'pointer', textAlign: 'center', py: 1.25, borderRadius: 2, bgcolor: '#fff', border: `1px solid #E7E1DA`, fontWeight: 700, fontSize: 14, color: '#1C1917', '&:hover': { borderColor: accent, bgcolor: `${accent}11` } }}>{t}</Box>
                ))}
                {freeSlots(selectedDate).length === 0 && <Typography sx={{ gridColumn: '1/-1', textAlign: 'center', color: '#A8A29E', py: 2 }}>אין תורים פנויים ביום זה</Typography>}
              </Box>
            )}
          </Box>
        )}

        {/* STAGE 3: Details */}
        {stage === 'details' && selectedService && (
          <Box>
            <Button onClick={() => setStage('slot')} sx={{ color: '#A8A29E', mb: 1 }}>← תאריך ושעה</Button>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#1C1917', mb: 1, textAlign: 'center' }}>הפרטים שלך</Typography>
            <Box sx={{ bgcolor: `${accent}11`, borderRadius: 3, p: 2, mb: 3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#1C1917' }}>{selectedService.name}</Typography>
              <Typography sx={{ fontSize: 13, color: '#57534E' }}>{selectedDate} · {selectedTime} · {selectedService.duration} דק'</Typography>
            </Box>
            <TextField fullWidth label="שם מלא" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} sx={{ mb: 2 }} />
            <TextField fullWidth label="טלפון" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} sx={{ mb: 3 }} />
            <Button onClick={submit} disabled={!form.name || !form.phone || booking} fullWidth variant="contained" sx={{ py: 1.75, borderRadius: 3, fontWeight: 800, fontSize: 16, bgcolor: accent, '&:hover': { bgcolor: accent, filter: 'brightness(0.9)' } }}>
              {booking ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'אשר תור'}
            </Button>
          </Box>
        )}

        {/* DONE */}
        {stage === 'done' && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Box sx={{ width: 90, height: 90, borderRadius: '50%', bgcolor: accent, color: '#fff', fontSize: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>✓</Box>
            <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#1C1917', mb: 1 }}>התור נקבע!</Typography>
            <Typography sx={{ fontSize: 15, color: '#57534E', mb: 1 }}>{selectedService?.name}</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: accent }}>{selectedDate} בשעה {selectedTime}</Typography>
            <Typography sx={{ fontSize: 13, color: '#A8A29E', mt: 3 }}>שלחנו לך SMS עם האישור. נתראה!</Typography>
          </Box>
        )}
      </Box>

      <Typography sx={{ textAlign: 'center', mt: 5, fontSize: 12, color: '#C4BDB4' }}>מופעל ע"י ZikkitAppointments</Typography>
    </Box>
  );
}
