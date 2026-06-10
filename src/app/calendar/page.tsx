'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Chip, Dialog, TextField, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBookings, addBooking, deleteBooking, loadBiz, type Booking, type TeamMember } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function CalendarPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading, user, staffName } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Array<{ name: string; duration: number; price?: string }>>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', service: '', duration: 30, time: '10:00', notes: '', staff: '' });

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const biz = await loadBiz(bizId);
      let bks = (biz.appointments?.bookings || []).filter((b) => b.status !== 'cancelled');
      // Staff members see only their own appointments
      if (user?.role === 'staff' && staffName) {
        bks = bks.filter((b) => b.staff === staffName);
      }
      setBookings(bks);
      const danaSvcs = (biz.dana?.services as Array<{ name: string; duration: number; price?: string }>) || [];
      setServices(danaSvcs);
      setTeam(((biz as Record<string, unknown>).team as { members?: TeamMember[] })?.members || []);
    } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!bizId || !form.customerName) return;
    setSaving(true);
    const staffAssign = user?.role === 'staff' && staffName ? staffName : form.staff;
    // Optimistic: show the booking immediately
    const optimistic: Booking = {
      id: 'temp_' + Date.now(), source: 'manual', customerName: form.customerName,
      customerPhone: form.customerPhone, service: form.service, duration: form.duration,
      date: selectedDate, time: form.time, staff: staffAssign, notes: form.notes,
      status: 'confirmed', createdAt: new Date().toISOString(),
    };
    setBookings((prev) => [optimistic, ...prev]);
    setAddOpen(false);
    setForm({ customerName: '', customerPhone: '', service: '', duration: 30, time: '10:00', notes: '', staff: '' });
    try {
      await addBooking(bizId, { customerName: optimistic.customerName, customerPhone: optimistic.customerPhone, service: optimistic.service, duration: optimistic.duration, staff: staffAssign, notes: optimistic.notes, date: selectedDate, time: optimistic.time, source: 'manual' });
      await load(); // reconcile with server (replaces temp with real)
    } catch (e) {
      setBookings((prev) => prev.filter((bk) => bk.id !== optimistic.id)); // rollback
      alert('שגיאה בשמירה: ' + (e as Error).message);
    } finally { setSaving(false); }
  };

  const cancel = async (id: string) => {
    if (!bizId) return;
    await deleteBooking(bizId, id);
    await load();
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]; });
  const dayBookings = bookings.filter((b) => b.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const dayRevenue = dayBookings.reduce((sum, b) => sum + (b.price || 0), 0);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 20 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>יומן תורים</Typography>
        <Button onClick={() => setAddOpen(true)} variant="contained" sx={{ borderRadius: 99, fontWeight: 700, px: 2.5 }}>+ תור</Button>
      </Box>

      {/* Day strip */}
      <Box sx={{ display: 'flex', gap: 1, px: { xs: 2, sm: 3 }, py: 2, overflowX: 'auto', bgcolor: c.surface1, borderBottom: `1px solid ${c.border}`, '&::-webkit-scrollbar': { height: 0 } }}>
        {days.map((d, i) => {
          const dateObj = new Date(d);
          const count = bookings.filter((b) => b.date === d).length;
          const active = d === selectedDate;
          return (
            <Box key={d} onClick={() => setSelectedDate(d)} sx={{ cursor: 'pointer', minWidth: 62, textAlign: 'center', py: 1.5, px: 1, borderRadius: 3.5, bgcolor: active ? c.accent : c.surface2, color: active ? '#fff' : c.text2, boxShadow: active ? c.shadowAccent : 'none', transition: 'all 0.2s', flexShrink: 0, '&:hover': { bgcolor: active ? c.accent : c.surface3 } }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, opacity: active ? 0.85 : 1 }}>{i === 0 ? 'היום' : i === 1 ? 'מחר' : HEBREW_DAYS[dateObj.getDay()]}</Typography>
              <Typography sx={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>{dateObj.getDate()}</Typography>
              <Typography sx={{ fontSize: 9, opacity: 0.6 }}>{dateObj.getMonth() + 1}</Typography>
              {count > 0 && <Box sx={{ fontSize: 9.5, mt: 0.5, fontWeight: 700, bgcolor: active ? 'rgba(255,255,255,0.25)' : c.accentDim, color: active ? '#fff' : c.accent, borderRadius: 99, py: 0.1 }}>{count}</Box>}
            </Box>
          );
        })}
      </Box>

      <Box sx={{ maxWidth: 680, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {dayBookings.length > 0 && (
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Box sx={{ flex: 1, bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2.25, boxShadow: c.shadowSm }}>
              <Typography sx={{ fontSize: 26, fontWeight: 800, color: c.text, letterSpacing: '-0.02em' }}>{dayBookings.length}</Typography>
              <Typography sx={{ fontSize: 12.5, color: c.text3, fontWeight: 500 }}>תורים היום</Typography>
            </Box>
            <Box sx={{ flex: 1, bgcolor: c.accent, borderRadius: 4, p: 2.25, boxShadow: c.shadowSm }}>
              <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>₪{dayRevenue.toLocaleString()}</Typography>
              <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>הכנסה צפויה</Typography>
            </Box>
          </Box>
        )}

        {dayBookings.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: 40, mb: 1.5, opacity: 0.5 }}>📅</Box>
            <Typography sx={{ color: c.text3, mb: 2.5 }}>אין תורים ביום זה</Typography>
            <Button onClick={() => setAddOpen(true)} variant="outlined" sx={{ borderRadius: 3, fontWeight: 600 }}>+ הוסף תור</Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {dayBookings.map((b) => (
              <Box key={b.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2, display: 'flex', alignItems: 'center', gap: 2, boxShadow: c.shadowSm, transition: 'all 0.2s', '&:hover': { boxShadow: c.shadowMd } }}>
                <Box sx={{ textAlign: 'center', minWidth: 54, bgcolor: c.accentDim, borderRadius: 3, py: 1 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.accent, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{b.time}</Typography>
                  <Typography sx={{ fontSize: 9.5, color: c.accent, opacity: 0.7 }}>{b.duration} דק'</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{b.customerName}</Typography>
                  <Typography sx={{ fontSize: 13, color: c.text3 }}>{b.service || 'טיפול'}{b.staff ? ` · ${b.staff}` : ''}{b.customerPhone ? ` · ${b.customerPhone}` : ''}</Typography>
                </Box>
                {b.source === 'dana' && <Chip label="דנה" size="small" sx={{ bgcolor: c.accentDim, color: c.accent, fontWeight: 700, fontSize: 10 }} />}
                {b.source === 'online' && <Chip label="אונליין" size="small" sx={{ bgcolor: c.greenDim, color: c.green, fontWeight: 700, fontSize: 10 }} />}
                {b.price ? <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>₪{b.price}</Typography> : null}
                <Button onClick={() => cancel(b.id)} size="small" sx={{ color: c.text3, minWidth: 'auto', fontSize: 12, '&:hover': { color: c.hot } }}>ביטול</Button>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Dialog scroll="body" open={addOpen} onClose={() => setAddOpen(false)} PaperProps={{ sx: { borderRadius: 5, p: 3.5, maxWidth: 420, width: '100%' } }}>
        <Typography sx={{ fontSize: 21, fontWeight: 800, mb: 0.5, color: c.text }}>תור חדש</Typography>
        <Typography sx={{ fontSize: 13, color: c.text3, mb: 2.5 }}>{selectedDate}</Typography>
        <TextField fullWidth label="שם הלקוח" value={form.customerName} onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="טלפון" value={form.customerPhone} onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))} sx={{ mb: 2 }} />
        {services.length > 0 ? (
          <TextField select fullWidth label="טיפול" value={form.service} onChange={(e) => {
            const svc = services.find((s) => s.name === e.target.value);
            setForm((p) => ({ ...p, service: e.target.value, duration: svc?.duration || p.duration }));
          }} sx={{ mb: 2 }}>
            {services.map((s) => <MenuItem key={s.name} value={s.name}>{s.name} · {s.duration} דק'{s.price ? ` · ₪${s.price}` : ''}</MenuItem>)}
          </TextField>
        ) : (
          <TextField fullWidth label="טיפול" value={form.service} onChange={(e) => setForm((p) => ({ ...p, service: e.target.value }))} sx={{ mb: 2 }} />
        )}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField label="שעה" type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} sx={{ flex: 1 }} InputLabelProps={{ shrink: true }} />
          <TextField select label="משך" value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: Number(e.target.value) }))} sx={{ flex: 1 }}>
            {[15, 30, 45, 60, 90, 120, 180].map((d) => <MenuItem key={d} value={d}>{d} דק'</MenuItem>)}
          </TextField>
        </Box>
        {team.length > 0 && (
          <TextField select fullWidth label="חבר צוות" value={form.staff} onChange={(e) => setForm((p) => ({ ...p, staff: e.target.value }))} sx={{ mb: 2 }}>
            <MenuItem value="">ללא שיוך</MenuItem>
            {team.map((m) => <MenuItem key={m.id} value={m.name}>{m.name}{m.role ? ` · ${m.role}` : ''}</MenuItem>)}
          </TextField>
        )}
        <TextField fullWidth label="הערות" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} sx={{ mb: 3 }} multiline rows={2} />
        <Button onClick={submit} variant="contained" fullWidth disabled={!form.customerName || saving} sx={{ borderRadius: 3, fontWeight: 700, py: 1.5 }}>
          {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'קבע תור'}
        </Button>
      </Dialog>
    </Box>
  );
}
