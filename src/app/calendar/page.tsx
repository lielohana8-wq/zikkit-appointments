'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Chip, Dialog, TextField, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBookings, addBooking, deleteBooking, updateBooking, loadBiz, type Booking, type TeamMember } from '@/lib/bizdata';
import { BookingDetailDialog } from '@/components/BookingDetailDialog';
import { useToast } from '@/components/Toast';
import { PageSkeleton } from '@/components/Skeleton';
import { zikkitColors as c } from '@/styles/theme';

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function CalendarPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading, user, staffName } = useAuth();
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Array<{ name: string; duration: number; price?: string }>>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', service: '', duration: 30, time: '10:00', notes: '', staff: '' });
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [reschedule, setReschedule] = useState({ date: '', time: '', staff: '' });

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
      showToast('שגיאה בשמירה: ' + (e as Error).message, 'error');
    } finally { setSaving(false); }
  };

  const cancel = async (id: string) => {
    if (!bizId) return;
    await deleteBooking(bizId, id);
    await load();
  };

  const openEdit = (b: Booking) => {
    setEditBooking(b);
    setReschedule({ date: b.date, time: b.time, staff: b.staff || '' });
  };

  const saveReschedule = async () => {
    if (!bizId || !editBooking) return;
    setSaving(true);
    try {
      await updateBooking(bizId, editBooking.id, { date: reschedule.date, time: reschedule.time, staff: reschedule.staff || null });
      setEditBooking(null);
      await load();
    } finally { setSaving(false); }
  };

  if (loading || dataLoading) return <PageSkeleton rows={6} />;

  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]; });
  const dayBookings = bookings.filter((b) => b.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const dayRevenue = dayBookings.reduce((sum, b) => sum + (b.price || 0), 0);
  // Staff color lookup
  const staffColor = (name?: string | null) => team.find((m) => m.name === name)?.color || c.accent;
  // Week view: 7 days starting from selectedDate's week (Sunday)
  const weekStart = (() => { const d = new Date(selectedDate); d.setDate(d.getDate() - d.getDay()); return d; })();
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]; });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 20 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>יומן תורים</Typography>
        <Button onClick={() => setAddOpen(true)} variant="contained" sx={{ borderRadius: 99, fontWeight: 700, px: 2.5 }}>+ תור</Button>
      </Box>

      {/* View toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, py: 1.5, bgcolor: c.surface1, borderBottom: `1px solid ${c.border}` }}>
        <Box sx={{ display: 'flex', gap: 0.5, bgcolor: c.surface3, p: 0.4, borderRadius: 99 }}>
          {([['day', 'יום'], ['week', 'שבוע']] as [typeof viewMode, string][]).map(([v, label]) => (
            <Button key={v} onClick={() => setViewMode(v)} sx={{ borderRadius: 99, fontWeight: 600, fontSize: 13.5, px: 3, py: 0.5, minWidth: 70, bgcolor: viewMode === v ? c.surface1 : 'transparent', color: viewMode === v ? c.text : c.text3, boxShadow: viewMode === v ? c.shadowSm : 'none', '&:hover': { bgcolor: viewMode === v ? c.surface1 : 'transparent' } }}>{label}</Button>
          ))}
        </Box>
      </Box>

      {/* Day strip */}
      {viewMode === 'day' && (
      <Box sx={{ display: 'flex', gap: 1, px: { xs: 2, sm: 3 }, py: 2, overflowX: 'auto', bgcolor: c.surface1, borderBottom: `1px solid ${c.border}`, '&::-webkit-scrollbar': { height: 0 } }}>
        {days.map((d, i) => {
          const dateObj = new Date(d);
          const count = bookings.filter((b) => b.date === d).length;
          const active = d === selectedDate;
          return (
            <Box key={d} onClick={() => setSelectedDate(d)} sx={{ cursor: 'pointer', minWidth: 62, textAlign: 'center', py: 1.5, px: 1, borderRadius: 1.5, bgcolor: active ? c.accent : c.surface2, color: active ? '#fff' : c.text2, boxShadow: active ? c.shadowAccent : 'none', transition: 'all 0.2s', flexShrink: 0, '&:hover': { bgcolor: active ? c.accent : c.surface3 } }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, opacity: active ? 0.85 : 1 }}>{i === 0 ? 'היום' : i === 1 ? 'מחר' : HEBREW_DAYS[dateObj.getDay()]}</Typography>
              <Typography sx={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>{dateObj.getDate()}</Typography>
              <Typography sx={{ fontSize: 9, opacity: 0.6 }}>{dateObj.getMonth() + 1}</Typography>
              {count > 0 && <Box sx={{ fontSize: 9.5, mt: 0.5, fontWeight: 700, bgcolor: active ? 'rgba(255,255,255,0.25)' : c.accentDim, color: active ? '#fff' : c.accent, borderRadius: 99, py: 0.1 }}>{count}</Box>}
            </Box>
          );
        })}
      </Box>
      )}

      {/* Week view */}
      {viewMode === 'week' && (
        <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 1.5, sm: 3 }, py: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
            {weekDays.map((d) => {
              const dateObj = new Date(d);
              const dayBks = bookings.filter((b) => b.date === d).sort((a, b) => a.time.localeCompare(b.time));
              const isToday = d === new Date().toISOString().split('T')[0];
              return (
                <Box key={d} sx={{ minHeight: 200 }}>
                  <Box onClick={() => { setSelectedDate(d); setViewMode('day'); }} sx={{ cursor: 'pointer', textAlign: 'center', py: 1, borderRadius: 2.5, mb: 1, bgcolor: isToday ? c.accent : c.surface2, color: isToday ? '#fff' : c.text2 }}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 600 }}>{HEBREW_DAYS[dateObj.getDay()]}</Typography>
                    <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1 }}>{dateObj.getDate()}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {dayBks.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 2, color: c.text3, fontSize: 10 }}>—</Box>
                    ) : dayBks.map((b) => (
                      <Box key={b.id} onClick={() => openEdit(b)} sx={{ cursor: 'pointer', bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRight: `3px solid ${staffColor(b.staff)}`, borderRadius: 1.5, p: 0.75, transition: 'all 0.15s', '&:hover': { bgcolor: c.surface2 } }}>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: staffColor(b.staff) }}>{b.time}</Typography>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: c.text, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.customerName}</Typography>
                        <Typography sx={{ fontSize: 9, color: c.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.service || 'טיפול'}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
          {/* Staff legend */}
          {team.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 3, justifyContent: 'center' }}>
              {team.map((m) => (
                <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: m.color }} />
                  <Typography sx={{ fontSize: 12, color: c.text2, fontWeight: 600 }}>{m.name}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {viewMode === 'day' && (
      <Box sx={{ maxWidth: 680, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {dayBookings.length > 0 && (
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Box sx={{ flex: 1, bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.25 }}>
              <Typography sx={{ fontSize: 26, fontWeight: 800, color: c.text, letterSpacing: '-0.02em' }}>{dayBookings.length}</Typography>
              <Typography sx={{ fontSize: 12.5, color: c.text3, fontWeight: 500 }}>תורים היום</Typography>
            </Box>
            <Box sx={{ flex: 1, bgcolor: c.accent, borderRadius: 2, p: 2.25 }}>
              <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>₪{dayRevenue.toLocaleString()}</Typography>
              <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>הכנסה צפויה</Typography>
            </Box>
          </Box>
        )}

        {dayBookings.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: 40, mb: 1.5, opacity: 0.5 }}>📅</Box>
            <Typography sx={{ color: c.text3, mb: 2.5 }}>אין תורים ביום זה</Typography>
            <Button onClick={() => setAddOpen(true)} variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 600 }}>+ הוסף תור</Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {dayBookings.map((b) => (
              <Box key={b.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRight: b.staff ? `3px solid ${staffColor(b.staff)}` : `1px solid ${c.border}`, borderRadius: 2, p: 2, display: 'flex', alignItems: 'center', gap: 2, transition: 'all 0.2s', '&:hover': { boxShadow: c.shadowMd } }}>
                <Box sx={{ textAlign: 'center', minWidth: 54, bgcolor: b.staff ? `${staffColor(b.staff)}1A` : c.accentDim, borderRadius: 1.5, py: 1 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: b.staff ? staffColor(b.staff) : c.accent, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{b.time}</Typography>
                  <Typography sx={{ fontSize: 9.5, color: b.staff ? staffColor(b.staff) : c.accent, opacity: 0.7 }}>{b.duration} דק'</Typography>
                </Box>
                <Box onClick={() => openEdit(b)} sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
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
      )}

      <Dialog scroll="body" open={addOpen} onClose={() => setAddOpen(false)} PaperProps={{ sx: { borderRadius: 2, p: 3.5, maxWidth: 420, width: '100%' } }}>
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
        <Button onClick={submit} variant="contained" fullWidth disabled={!form.customerName || saving} sx={{ borderRadius: 1.5, fontWeight: 700, py: 1.5 }}>
          {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'קבע תור'}
        </Button>
      </Dialog>

      {/* Reschedule / edit dialog */}
      <BookingDetailDialog booking={editBooking} bizId={bizId} onClose={() => setEditBooking(null)} onChanged={load} />
    </Box>
  );
}
