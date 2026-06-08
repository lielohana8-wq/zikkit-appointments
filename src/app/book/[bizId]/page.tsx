'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, TextField } from '@mui/material';
import { useParams } from 'next/navigation';

interface Service { id: string; name: string; duration: number; price?: string | number; description?: string; category?: string; }
interface Branding { logo: string; banner: string; brandColor: string; headerStyle?: string; welcomeText: string; thankYouMessage?: string; cancellationNote?: string; address?: string; phone?: string; instagram?: string; whatsapp?: string; showPrices: boolean; showDuration?: boolean; requireEmail?: boolean; }
interface BizInfo {
  enabled: boolean;
  reason?: string;
  error?: string;
  businessName: string;
  services: Service[];
  stations: number;
  hours: Record<number, { open: boolean; start: string; end: string }> | null;
  bookings: Array<{ date: string; time: string; duration: number }>;
  branding: Branding;
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEBREW_DAYS_SHORT = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const HEBREW_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

// Lighten/darken a hex color
function shade(hex: string, percent: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + percent));
  const b = Math.min(255, Math.max(0, (n & 0xff) + percent));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

export default function PublicBookingPage() {
  const params = useParams();
  const bizId = params.bizId as string;
  const [info, setInfo] = useState<BizInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<'service' | 'slot' | 'details' | 'done'>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!bizId) return;
    fetch(`/api/public-booking?bizId=${bizId}`)
      .then((r) => r.json())
      .then((d) => setInfo(d))
      .finally(() => setLoading(false));
  }, [bizId]);

  const accent = info?.branding?.brandColor || '#9333EA';
  const accentLight = shade(accent, 60);
  const accentDark = shade(accent, -30);

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

  if (loading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8F7F5' }}><CircularProgress sx={{ color: accent }} /></Box>;

  if (!info || !info.enabled) {
    const reasonText: Record<string, string> = {
      no_service_account: 'תקלת הגדרה בשרת. (פנה לבעל העסק)',
      firestore_error: 'תקלה זמנית. נסה שוב מאוחר יותר.',
      biz_not_found: 'העסק לא נמצא.',
      disabled_by_owner: 'בעל העסק עדיין לא הפעיל הזמנות מקוונות.',
    };
    const msg = info?.reason ? (reasonText[info.reason] || 'הדף אינו זמין') : 'בעל העסק עדיין לא הפעיל הזמנות מקוונות.';
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8F7F5', p: 3, textAlign: 'center', direction: 'rtl' }}>
        <Box sx={{ fontSize: 56, mb: 2 }}>🔒</Box>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#1C1917', mb: 1 }}>דף ההזמנות אינו זמין</Typography>
        <Typography sx={{ fontSize: 14, color: '#78716C', maxWidth: 360 }}>{msg}</Typography>
      </Box>
    );
  }

  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]; });
  const fontStack = "'Heebo', 'Assistant', -apple-system, sans-serif";

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8F7F5', direction: 'rtl', fontFamily: fontStack, pb: 8 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800;900&display=swap');`}</style>

      {/* Hero header */}
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        {info.branding.banner ? (
          <Box sx={{ height: 220, background: `url(${info.branding.banner}) center/cover`, position: 'relative' }}>
            <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.15))` }} />
          </Box>
        ) : (
          <Box sx={{ height: 180, background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`, position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)' }} />
            <Box sx={{ position: 'absolute', bottom: -60, left: -20, width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
          </Box>
        )}

        {/* Logo + name card overlapping hero */}
        <Box sx={{ maxWidth: 520, mx: 'auto', px: 2, mt: -8, position: 'relative', zIndex: 2 }}>
          <Box sx={{ bgcolor: '#fff', borderRadius: 5, p: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', textAlign: 'center' }}>
            {info.branding.logo ? (
              <Box component="img" src={info.branding.logo} sx={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', mt: -8, mb: 1.5, border: '4px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', mx: 'auto', display: 'block' }} />
            ) : (
              <Box sx={{ width: 88, height: 88, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, fontWeight: 800, mt: -8, mb: 1.5, border: '4px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', mx: 'auto' }}>{info.businessName[0]}</Box>
            )}
            <Typography sx={{ fontSize: 26, fontWeight: 900, color: '#1C1917', fontFamily: fontStack }}>{info.businessName}</Typography>
            {info.branding.welcomeText && <Typography sx={{ fontSize: 14.5, color: '#78716C', mt: 0.5, lineHeight: 1.5 }}>{info.branding.welcomeText}</Typography>}
            {/* Quick contact chips */}
            {(info.branding.phone || info.branding.address) && (
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 2, flexWrap: 'wrap' }}>
                {info.branding.address && <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#F5F3F0', borderRadius: 99, px: 1.5, py: 0.5, fontSize: 12, color: '#57534E' }}>📍 {info.branding.address}</Box>}
                {info.branding.phone && <Box component="a" href={`tel:${info.branding.phone}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#F5F3F0', borderRadius: 99, px: 1.5, py: 0.5, fontSize: 12, color: '#57534E', textDecoration: 'none' }}>📞 {info.branding.phone}</Box>}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 520, mx: 'auto', px: 2, mt: 3 }}>
        {/* Progress steps */}
        {stage !== 'done' && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, mb: 3 }}>
            {[['service', 'שירות'], ['slot', 'מועד'], ['details', 'פרטים']].map(([s, label], i) => {
              const idx = ['service', 'slot', 'details'].indexOf(stage);
              const done = idx > i; const active = idx === i;
              return (
                <Box key={s} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, bgcolor: done || active ? accent : '#E7E5E4', color: done || active ? '#fff' : '#A8A29E', transition: 'all 0.3s' }}>{done ? '✓' : i + 1}</Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 600, color: active ? accent : '#A8A29E' }}>{label}</Typography>
                  </Box>
                  {i < 2 && <Box sx={{ width: 32, height: 2, bgcolor: done ? accent : '#E7E5E4', mx: 0.5, mb: 2.5, transition: 'all 0.3s' }} />}
                </Box>
              );
            })}
          </Box>
        )}

        {/* STAGE 1: Service */}
        {stage === 'service' && (
          <Box sx={{ animation: 'fadeIn 0.4s' }}>
            <Typography sx={{ fontSize: 19, fontWeight: 800, color: '#1C1917', mb: 2 }}>איזה שירות תרצו?</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {info.services.length === 0 && <Typography sx={{ textAlign: 'center', color: '#A8A29E', py: 4 }}>אין שירותים זמינים כרגע</Typography>}
              {info.services.map((s) => (
                <Box key={s.id} onClick={() => { setSelectedService(s); setStage('slot'); }}
                  sx={{ cursor: 'pointer', bgcolor: '#fff', borderRadius: 4, p: 2.25, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '2px solid transparent', transition: 'all 0.2s', '&:hover': { borderColor: accent, transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${accent}22` } }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>✂️</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#1C1917' }}>{s.name}</Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25 }}>
                      {info.branding.showDuration !== false && <Typography sx={{ fontSize: 12.5, color: '#A8A29E' }}>🕐 {s.duration} דק'</Typography>}
                    </Box>
                  </Box>
                  {info.branding.showPrices && s.price ? <Box sx={{ textAlign: 'center' }}><Typography sx={{ fontSize: 18, fontWeight: 800, color: accent, lineHeight: 1 }}>₪{s.price}</Typography></Box> : null}
                  <Box sx={{ color: accent, fontSize: 22, fontWeight: 300 }}>‹</Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* STAGE 2: Slot */}
        {stage === 'slot' && selectedService && (
          <Box sx={{ animation: 'fadeIn 0.4s' }}>
            <Button onClick={() => setStage('service')} sx={{ color: '#A8A29E', mb: 1, fontWeight: 600, minWidth: 'auto', p: 0 }}>‹ חזרה לשירותים</Button>
            <Box sx={{ bgcolor: `${accent}10`, borderRadius: 3, px: 2, py: 1.25, mb: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: accentDark }}>✂️ {selectedService.name}</Typography>
              <Typography sx={{ fontSize: 12, color: '#78716C' }}>· {selectedService.duration} דק'</Typography>
            </Box>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#1C1917', mb: 1.5 }}>בחרו יום</Typography>
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 1.5, mb: 1, '&::-webkit-scrollbar': { height: 0 } }}>
              {days.map((d, i) => {
                const dateObj = new Date(d);
                const has = freeSlots(d).length > 0;
                const active = d === selectedDate;
                return (
                  <Box key={d} onClick={() => has && (setSelectedDate(d), setSelectedTime(''))}
                    sx={{ cursor: has ? 'pointer' : 'default', opacity: has ? 1 : 0.35, minWidth: 58, textAlign: 'center', py: 1.5, borderRadius: 3, bgcolor: active ? accent : '#fff', color: active ? '#fff' : '#1C1917', boxShadow: active ? `0 4px 14px ${accent}44` : '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 600, opacity: 0.7 }}>{i === 0 ? 'היום' : i === 1 ? 'מחר' : HEBREW_DAYS_SHORT[dateObj.getDay()]}</Typography>
                    <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{dateObj.getDate()}</Typography>
                    <Typography sx={{ fontSize: 9.5, opacity: 0.6 }}>{HEBREW_MONTHS[dateObj.getMonth()].slice(0, 3)}</Typography>
                  </Box>
                );
              })}
            </Box>
            {selectedDate && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#1C1917', mb: 1.5 }}>שעות פנויות</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                  {freeSlots(selectedDate).map((t) => (
                    <Box key={t} onClick={() => { setSelectedTime(t); setStage('details'); }}
                      sx={{ cursor: 'pointer', textAlign: 'center', py: 1.5, borderRadius: 2.5, bgcolor: '#fff', border: `1.5px solid #E7E5E4`, fontWeight: 700, fontSize: 15, color: '#1C1917', transition: 'all 0.15s', '&:hover': { borderColor: accent, bgcolor: accent, color: '#fff', transform: 'scale(1.05)' } }}>{t}</Box>
                  ))}
                  {freeSlots(selectedDate).length === 0 && <Typography sx={{ gridColumn: '1/-1', textAlign: 'center', color: '#A8A29E', py: 3 }}>אין תורים פנויים ביום זה 😔</Typography>}
                </Box>
              </Box>
            )}
            {!selectedDate && <Typography sx={{ textAlign: 'center', color: '#A8A29E', fontSize: 13, mt: 2 }}>👆 בחרו יום כדי לראות שעות פנויות</Typography>}
          </Box>
        )}

        {/* STAGE 3: Details */}
        {stage === 'details' && selectedService && (
          <Box sx={{ animation: 'fadeIn 0.4s' }}>
            <Button onClick={() => setStage('slot')} sx={{ color: '#A8A29E', mb: 1, fontWeight: 600, minWidth: 'auto', p: 0 }}>‹ חזרה למועד</Button>
            <Typography sx={{ fontSize: 19, fontWeight: 800, color: '#1C1917', mb: 2 }}>כמעט סיימנו!</Typography>
            <Box sx={{ bgcolor: '#fff', borderRadius: 4, p: 2.5, mb: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1.5, mb: 1.5, borderBottom: '1px solid #F5F3F0' }}>
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#1C1917' }}>{selectedService.name}</Typography>
                {info.branding.showPrices && selectedService.price ? <Typography sx={{ fontSize: 17, fontWeight: 800, color: accent }}>₪{selectedService.price}</Typography> : null}
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography sx={{ fontSize: 13.5, color: '#57534E' }}>📅 {new Date(selectedDate).getDate()} {HEBREW_MONTHS[new Date(selectedDate).getMonth()]}</Typography>
                <Typography sx={{ fontSize: 13.5, color: '#57534E' }}>🕐 {selectedTime}</Typography>
                <Typography sx={{ fontSize: 13.5, color: '#57534E' }}>⏱️ {selectedService.duration} דק'</Typography>
              </Box>
            </Box>
            <TextField fullWidth placeholder="שם מלא" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} sx={{ mb: 1.75, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#fff' } }} />
            <TextField fullWidth placeholder="מספר טלפון" type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} sx={{ mb: info.branding.requireEmail ? 1.75 : 3, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#fff' } }} />
            {info.branding.requireEmail && <TextField fullWidth placeholder="אימייל" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#fff' } }} />}
            <Button onClick={submit} disabled={!form.name || !form.phone || booking} fullWidth sx={{ py: 1.85, borderRadius: 3, fontWeight: 800, fontSize: 16.5, color: '#fff', background: `linear-gradient(135deg, ${accent}, ${accentDark})`, boxShadow: `0 6px 20px ${accent}55`, '&:hover': { filter: 'brightness(1.05)' }, '&.Mui-disabled': { background: '#D6D3D1', color: '#fff' } }}>
              {booking ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : '✓ אישור התור'}
            </Button>
            {info.branding.cancellationNote && <Typography sx={{ fontSize: 11.5, color: '#A8A29E', textAlign: 'center', mt: 1.5 }}>{info.branding.cancellationNote}</Typography>}
          </Box>
        )}

        {/* DONE */}
        {stage === 'done' && (
          <Box sx={{ textAlign: 'center', py: 5, animation: 'fadeIn 0.5s' }}>
            <Box sx={{ width: 96, height: 96, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, ${accentDark})`, color: '#fff', fontSize: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3, boxShadow: `0 8px 30px ${accent}55`, animation: 'pop 0.5s' }}>✓</Box>
            <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#1C1917', mb: 1 }}>התור נקבע! 🎉</Typography>
            <Box sx={{ bgcolor: '#fff', borderRadius: 4, p: 2.5, mt: 3, mb: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', textAlign: 'right' }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#1C1917', mb: 1 }}>{selectedService?.name}</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography sx={{ fontSize: 14, color: accent, fontWeight: 700 }}>📅 {new Date(selectedDate).getDate()} {HEBREW_MONTHS[new Date(selectedDate).getMonth()]}</Typography>
                <Typography sx={{ fontSize: 14, color: accent, fontWeight: 700 }}>🕐 {selectedTime}</Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: 13.5, color: '#78716C' }}>{info.branding.thankYouMessage || 'שלחנו לך SMS עם האישור. נתראה! 💜'}</Typography>
            {info.branding.cancellationNote && <Typography sx={{ fontSize: 12, color: '#A8A29E', mt: 1.5 }}>{info.branding.cancellationNote}</Typography>}
          </Box>
        )}

        {/* Contact footer */}
        {(info.branding.whatsapp || info.branding.instagram) && stage !== 'done' && (
          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #EEEAE5', display: 'flex', gap: 1.5, justifyContent: 'center' }}>
            {info.branding.whatsapp && <Button href={`https://wa.me/972${info.branding.whatsapp.replace(/^0/, '')}`} target="_blank" sx={{ color: '#25D366', fontWeight: 700, fontSize: 13 }}>💬 וואטסאפ</Button>}
            {info.branding.instagram && <Button href={`https://instagram.com/${info.branding.instagram.replace('@', '')}`} target="_blank" sx={{ color: '#E1306C', fontWeight: 700, fontSize: 13 }}>📷 אינסטגרם</Button>}
          </Box>
        )}
      </Box>

      <Typography sx={{ textAlign: 'center', mt: 5, fontSize: 11.5, color: '#C4BDB4' }}>מופעל ע"י ZikkitAppointments</Typography>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes pop { 0% { transform: scale(0); } 70% { transform: scale(1.1); } 100% { transform: scale(1); } }`}</style>
    </Box>
  );
}
