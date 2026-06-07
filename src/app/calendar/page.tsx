'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Chip, Dialog, TextField, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { zikkitColors as c } from '@/styles/theme';

interface Booking {
  id: string; customerName: string; customerPhone: string; service: string;
  duration: number; date: string; time: string; status: string; station?: number; notes?: string; source?: string;
}

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function CalendarPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [addOpen, setAddOpen] = useState(false);
  const [newBooking, setNewBooking] = useState({ customerName: '', customerPhone: '', service: '', duration: 30, time: '10:00' });

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const res = await fetch(`/api/appointments?bizId=${bizId}`);
      const data = await res.json();
      if (data.success) setBookings(data.bookings.filter((b: Booking) => b.status !== 'cancelled'));
    } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  const addBooking = async () => {
    if (!bizId || !newBooking.customerName) return;
    await fetch('/api/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bizId, action: 'create', booking: { ...newBooking, date: selectedDate, source: 'manual' } }),
    });
    setAddOpen(false);
    setNewBooking({ customerName: '', customerPhone: '', service: '', duration: 30, time: '10:00' });
    load();
  };

  const cancelBooking = async (id: string) => {
    if (!bizId) return;
    await fetch('/api/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bizId, action: 'cancel', booking: { id } }),
    });
    load();
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  // Build next 7 days
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const dayBookings = bookings.filter((b) => b.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.surface1 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 800, color: c.text }}>יומן תורים</Typography>
        <Button onClick={() => setAddOpen(true)} variant="contained" sx={{ borderRadius: 99, fontWeight: 700 }}>+ תור</Button>
      </Box>

      {/* Day selector */}
      <Box sx={{ display: 'flex', gap: 1, p: 2, overflowX: 'auto', bgcolor: c.surface1, borderBottom: `1px solid ${c.border}` }}>
        {days.map((d, i) => {
          const dateObj = new Date(d);
          const count = bookings.filter((b) => b.date === d).length;
          const active = d === selectedDate;
          return (
            <Box key={d} onClick={() => setSelectedDate(d)} sx={{ cursor: 'pointer', minWidth: 70, textAlign: 'center', py: 1.5, px: 1, borderRadius: 3, bgcolor: active ? c.accent : c.surface2, color: active ? '#fff' : c.text2, border: `1px solid ${active ? c.accent : c.border}` }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600 }}>{i === 0 ? 'היום' : i === 1 ? 'מחר' : HEBREW_DAYS[dateObj.getDay()]}</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{dateObj.getDate()}</Typography>
              {count > 0 && <Box sx={{ fontSize: 10, mt: 0.5, bgcolor: active ? 'rgba(255,255,255,0.25)' : c.accentDim, color: active ? '#fff' : c.accent, borderRadius: 99, px: 0.5 }}>{count}</Box>}
            </Box>
          );
        })}
      </Box>

      {/* Bookings list */}
      <Box sx={{ maxWidth: 700, mx: 'auto', p: 3 }}>
        {dayBookings.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: 48, mb: 2 }}>📅</Box>
            <Typography sx={{ color: c.text3 }}>אין תורים ביום זה</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {dayBookings.map((b) => (
              <Box key={b.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.accent}`, borderRadius: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ textAlign: 'center', minWidth: 56 }}>
                  <Typography sx={{ fontSize: 18, fontWeight: 800, color: c.accent }}>{b.time}</Typography>
                  <Typography sx={{ fontSize: 10, color: c.text3 }}>{b.duration} דק'</Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{b.customerName}</Typography>
                  <Typography sx={{ fontSize: 13, color: c.text2 }}>{b.service}{b.station ? ` · עמדה ${b.station}` : ''}</Typography>
                </Box>
                {b.source === 'dana' && <Chip label="דנה" size="small" sx={{ bgcolor: c.accentDim, color: c.accent, fontWeight: 700, fontSize: 10 }} />}
                <Button onClick={() => cancelBooking(b.id)} size="small" sx={{ color: c.hot, minWidth: 'auto' }}>ביטול</Button>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Add dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} PaperProps={{ sx: { borderRadius: 4, p: 3, maxWidth: 400, width: '100%' } }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2, color: c.text }}>תור חדש · {selectedDate}</Typography>
        <TextField fullWidth label="שם הלקוח" value={newBooking.customerName} onChange={(e) => setNewBooking((p) => ({ ...p, customerName: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="טלפון" value={newBooking.customerPhone} onChange={(e) => setNewBooking((p) => ({ ...p, customerPhone: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="טיפול" value={newBooking.service} onChange={(e) => setNewBooking((p) => ({ ...p, service: e.target.value }))} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField label="שעה" type="time" value={newBooking.time} onChange={(e) => setNewBooking((p) => ({ ...p, time: e.target.value }))} sx={{ flex: 1 }} InputLabelProps={{ shrink: true }} />
          <TextField select label="משך" value={newBooking.duration} onChange={(e) => setNewBooking((p) => ({ ...p, duration: Number(e.target.value) }))} sx={{ flex: 1 }}>
            {[15, 30, 45, 60, 90, 120].map((d) => <MenuItem key={d} value={d}>{d} דק'</MenuItem>)}
          </TextField>
        </Box>
        <Button onClick={addBooking} variant="contained" fullWidth disabled={!newBooking.customerName} sx={{ borderRadius: 3, fontWeight: 800, py: 1.5 }}>קבע תור</Button>
      </Dialog>
    </Box>
  );
}
