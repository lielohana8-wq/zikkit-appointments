'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog, TextField, MenuItem, Autocomplete } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBookings, addBooking, updateBooking, loadBiz, getCustomers, type Booking, type TeamMember, type Customer } from '@/lib/bizdata';
import { getFirestoreDb, doc, BIZ_COLLECTION } from '@/lib/firebase';
import { onSnapshot } from 'firebase/firestore';
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [addOpen, setAddOpen] = useState(false);
  const [resize, setResize] = useState<{ id: string; startY: number; orig: number; dur: number } | null>(null);
  const [staffFilter, setStaffFilter] = useState<string | null>(null);
  const [move, setMove] = useState<{ id: string; startY: number; orig: number; min: number; started: boolean } | null>(null);
  const justResized = useRef(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', service: '', duration: 30, time: '10:00', notes: '', staff: '', repeat: 'none', repeatCount: 4, isBlock: false });
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
      try { setCustomers(await getCustomers(bizId)); } catch { /* ignore */ }
    } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  // Realtime: the barbershop screen updates itself — a cancelled booking
  // disappears within a second, a new one pops in. No manual refresh.
  useEffect(() => {
    if (!bizId) return;
    let first = true;
    const unsub = onSnapshot(doc(getFirestoreDb(), BIZ_COLLECTION, bizId), () => {
      if (first) { first = false; return; } // initial snapshot — load() already ran
      load();
    });
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { unsub(); window.removeEventListener('focus', onFocus); };
  }, [bizId, load]);
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('add') === '1') {
      setAddOpen(true);
      window.history.replaceState({}, '', '/calendar');
    }
  }, []);

  const submit = async () => {
    if (!bizId || (!form.customerName && !form.isBlock)) return;
    setSaving(true);
    const staffAssign = user?.role === 'staff' && staffName ? staffName : form.staff;

    // Guard: a barber holds ONE appointment at a time — also for manual bookings
    if (!form.isBlock) {
      const t2m = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
      const ns = t2m(form.time); const ne = ns + Number(form.duration || 30);
      const clashes = bookings.filter((b) => {
        if (b.date !== selectedDate || b.status === 'cancelled') return false;
        if (staffAssign && b.staff !== staffAssign) return false;
        const bs = t2m(b.time); const be = bs + (b.duration || 30);
        return ns < be && ne > bs;
      }).length;
      const cap = staffAssign ? 1 : Math.max(team.length, 1);
      if (clashes >= cap) {
        setSaving(false);
        showToast(staffAssign ? `השעה תפוסה אצל ${staffAssign} — בחר/י שעה אחרת` : 'הצוות מלא בשעה הזו — בחר/י שעה אחרת', 'error');
        return;
      }
    }

    // Optimistic: show the booking immediately
    const optimistic: Booking = {
      id: 'temp_' + Date.now(), source: 'manual',
      customerName: form.isBlock ? '🚫 חסימה' : form.customerName,
      customerPhone: form.isBlock ? '' : form.customerPhone,
      service: form.isBlock ? (form.notes || 'לא זמינה') : form.service,
      duration: form.duration,
      date: selectedDate, time: form.time, staff: staffAssign, notes: form.notes,
      status: form.isBlock ? 'blocked' : 'confirmed', createdAt: new Date().toISOString(),
    };
    setBookings((prev) => [optimistic, ...prev]);
    setAddOpen(false);
    const repeat = form.repeat;
    const repeatCount = form.repeatCount;
    setForm({ customerName: '', customerPhone: '', service: '', duration: 30, time: '10:00', notes: '', staff: '', repeat: 'none', repeatCount: 4, isBlock: false });
    try {
      const base = { customerName: optimistic.customerName, customerPhone: optimistic.customerPhone, service: optimistic.service, duration: optimistic.duration, staff: staffAssign, notes: optimistic.notes, time: optimistic.time, source: 'manual' as const, status: optimistic.status };
      if (repeat === 'none') {
        await addBooking(bizId, { ...base, date: selectedDate });
      // SMS confirmations for manual bookings (customer + assigned member) — fire & forget
      if (!form.isBlock) {
        try {
          const idToken = await firebaseUser?.getIdToken();
          if (idToken) fetch('/api/notify-booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bizId, idToken, booking: { customerName: optimistic.customerName, customerPhone: optimistic.customerPhone, service: optimistic.service, date: selectedDate, time: form.time, staff: staffAssign } }) }).catch(() => {});
        } catch { /* never block booking on SMS */ }
      }
      } else {
        // Create a series: weekly or every 2 weeks or monthly
        const stepDays = repeat === 'weekly' ? 7 : repeat === 'biweekly' ? 14 : 30;
        const start = new Date(selectedDate + 'T00:00:00');
        for (let i = 0; i < repeatCount; i++) {
          const d = new Date(start);
          if (repeat === 'monthly') d.setMonth(d.getMonth() + i);
          else d.setDate(d.getDate() + stepDays * i);
          const dateStr = d.toISOString().split('T')[0];
          await addBooking(bizId, { ...base, date: dateStr });
        }
        showToast(`נוצרו ${repeatCount} תורים חוזרים`, 'success');
      }
      await load(); // reconcile with server (replaces temp with real)
    } catch (e) {
      setBookings((prev) => prev.filter((bk) => bk.id !== optimistic.id)); // rollback
      showToast('שגיאה בשמירה: ' + (e as Error).message, 'error');
    } finally { setSaving(false); }
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
        <Box className="zk-page" sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 1.5, sm: 3 }, py: 3 }}>
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
                      <Box key={b.id} onClick={() => openEdit(b)} sx={{ cursor: 'pointer', bgcolor: b.status === 'blocked' ? c.surface2 : c.surface1, opacity: b.status === 'blocked' ? 0.75 : 1, border: b.status === 'blocked' ? `1px dashed ${c.border}` : `1px solid ${c.border2}`, borderRight: `3px solid ${b.status === 'blocked' ? c.text3 : staffColor(b.staff)}`, borderRadius: 1.5, p: 0.75, transition: 'all 0.15s', '&:hover': { bgcolor: c.surface2 } }}>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: b.status === 'blocked' ? c.text3 : staffColor(b.staff) }}>{b.time}</Typography>
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
        {/* Day header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 24, fontWeight: 900, color: c.text, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {(() => { const d = new Date(selectedDate + 'T00:00:00'); return `יום ${HEBREW_DAYS[d.getDay()]}`; })()}
            </Typography>
            <Typography sx={{ fontSize: 13, color: c.text3, fontWeight: 600, mt: 0.5 }}>
              {(() => { const d = new Date(selectedDate + 'T00:00:00'); return `${d.getDate()}.${d.getMonth() + 1}`; })()} · {dayBookings.filter((b) => b.status !== 'cancelled' && b.status !== 'blocked').length} תורים
            </Typography>
          </Box>
          {dayBookings.length > 0 && (
            <Box sx={{ textAlign: 'left', bgcolor: c.accentDim, borderRadius: 2, px: 1.75, py: 0.9 }}>
              <Typography sx={{ fontSize: 18, fontWeight: 900, color: c.accent, letterSpacing: '-0.02em', lineHeight: 1 }}>₪{dayRevenue.toLocaleString()}</Typography>
              <Typography sx={{ fontSize: 10.5, color: c.accent, fontWeight: 700, opacity: 0.8 }}>צפי הכנסה</Typography>
            </Box>
          )}
        </Box>

        {/* Staff filter — tap a barber to see only their column */}
        {team.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.75, mb: 2, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
            <Box onClick={() => setStaffFilter(null)} sx={{ cursor: 'pointer', flexShrink: 0, px: 1.5, py: 0.6, borderRadius: 99, fontSize: 12.5, fontWeight: 800, border: `1.5px solid ${!staffFilter ? c.accent : c.border2}`, color: !staffFilter ? c.accent : c.text3, bgcolor: !staffFilter ? c.accentDim : 'transparent', transition: 'all 0.15s' }}>הכל</Box>
            {team.map((m) => (
              <Box key={m.id} onClick={() => setStaffFilter(staffFilter === m.name ? null : m.name)} sx={{ cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.6, borderRadius: 99, fontSize: 12.5, fontWeight: 800, border: `1.5px solid ${staffFilter === m.name ? m.color : c.border2}`, color: staffFilter === m.name ? m.color : c.text3, bgcolor: staffFilter === m.name ? `${m.color}15` : 'transparent', transition: 'all 0.15s' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: m.color }} />{m.name}
              </Box>
            ))}
          </Box>
        )}

        {/* ===== Real day grid: 08:00-21:00, tap an empty hour to add, jobs stretch by duration ===== */}
        {(() => {
          const START = 8 * 60, END = 21 * 60, HOUR_PX = 64;
          const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
          const gridBks = dayBookings.filter((b) => b.status !== 'cancelled' && (!staffFilter || b.staff === staffFilter));
          // Overlap lanes: greedy assignment so concurrent bookings sit side-by-side
          const sorted = [...gridBks].sort((a, b) => toMin(a.time) - toMin(b.time));
          const laneEnd: number[] = [];
          const lanes = new Map<string, number>();
          let maxLane = 0;
          for (const b of sorted) {
            const st = toMin(b.time); const en = st + (b.duration || 30);
            let lane = laneEnd.findIndex((e) => e <= st);
            if (lane === -1) { lane = laneEnd.length; laneEnd.push(en); } else laneEnd[lane] = en;
            lanes.set(b.id, lane); maxLane = Math.max(maxLane, lane + 1);
          }
          const laneCount = Math.min(Math.max(maxLane, 1), 3);
          const now = new Date();
          const isToday = selectedDate === now.toISOString().split('T')[0];
          const nowMin = now.getHours() * 60 + now.getMinutes();
          const gridClick = (e: React.MouseEvent<HTMLDivElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mins = START + Math.round(((e.clientY - rect.top) / HOUR_PX) * 60 / 30) * 30;
            const clamped = Math.max(START, Math.min(END - 30, mins));
            const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
            const mm = String(clamped % 60).padStart(2, '0');
            setForm((p) => ({ ...p, time: `${hh}:${mm}` }));
            setAddOpen(true);
          };
          return (
            <Box sx={{ display: 'flex', gap: 1, direction: 'rtl' }}>
              {/* hour labels */}
              <Box sx={{ width: 44, flexShrink: 0 }}>
                {Array.from({ length: (END - START) / 60 }, (_, i) => (
                  <Box key={i} sx={{ height: HOUR_PX, position: 'relative' }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: c.text3, position: 'absolute', top: -7, left: 4, letterSpacing: '-0.01em' }}>{String(8 + i).padStart(2, '0')}:00</Typography>
                  </Box>
                ))}
              </Box>
              {/* grid */}
              <Box onClick={(e) => { if (justResized.current) { justResized.current = false; return; } gridClick(e); }}
                onPointerMove={(e) => {
                  if (move) {
                    const b = gridBks.find((x) => x.id === move.id); if (!b) return;
                    const deltaMin = ((e.clientY - move.startY) / HOUR_PX) * 60;
                    const started = move.started || Math.abs(e.clientY - move.startY) > 6;
                    const dur = b.duration || 30;
                    let min = Math.round((move.orig + deltaMin) / 15) * 15;
                    min = Math.max(START, Math.min(min, END - dur));
                    if (min !== move.min || started !== move.started) setMove({ ...move, min, started });
                    return;
                  }
                  if (!resize) return;
                  const b = gridBks.find((x) => x.id === resize.id); if (!b) return;
                  const deltaMin = ((e.clientY - resize.startY) / HOUR_PX) * 60;
                  let dur = Math.round((resize.orig + deltaMin) / 15) * 15;
                  // clamp: at least 15min, and don't run into the next booking of the same barber (or day end)
                  const myStart = toMin(b.time);
                  const nexts = gridBks.filter((x) => x.id !== b.id && (!b.staff || x.staff === b.staff) && toMin(x.time) >= myStart + 15).map((x) => toMin(x.time));
                  const limit = Math.min(nexts.length ? Math.min(...nexts) : END, END) - myStart;
                  dur = Math.max(15, Math.min(dur, limit));
                  if (dur !== resize.dur) setResize({ ...resize, dur });
                }}
                onPointerUp={async () => {
                  if (move) {
                    const m = move; setMove(null);
                    if (m.started && bizId) {
                      justResized.current = true;
                      const b = gridBks.find((x) => x.id === m.id);
                      if (b && m.min !== m.orig) {
                        const dur = b.duration || 30;
                        const conflict = gridBks.some((x) => {
                          if (x.id === b.id) return false;
                          if (b.staff && x.staff !== b.staff) return false;
                          const xs = toMin(x.time); const xe = xs + (x.duration || 30);
                          return m.min < xe && m.min + dur > xs;
                        });
                        if (conflict) { showToast('מתנגש עם תור קיים — לא הוזז', 'error'); }
                        else {
                          const newTime = `${String(Math.floor(m.min / 60)).padStart(2, '0')}:${String(m.min % 60).padStart(2, '0')}`;
                          setBookings((prev) => prev.map((x) => (x.id === m.id ? { ...x, time: newTime } : x)));
                          try { await updateBooking(bizId, m.id, { time: newTime }); } catch { load(); }
                        }
                      }
                    }
                    if (resize) setResize(null);
                    return;
                  }
                  if (!resize) return;
                  const { id, orig, dur } = resize; setResize(null);
                  if (dur !== orig && bizId) {
                    justResized.current = true;
                    setBookings((prev) => prev.map((x) => (x.id === id ? { ...x, duration: dur } : x)));
                    try { await updateBooking(bizId, id, { duration: dur }); } catch { load(); }
                  }
                }}
                sx={{ position: 'relative', flex: 1, height: ((END - START) / 60) * HOUR_PX, bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, overflow: 'hidden', cursor: 'copy', touchAction: resize ? 'none' : 'auto' }}>
                {Array.from({ length: (END - START) / 60 }, (_, i) => (
                  <Box key={i} sx={{ position: 'absolute', top: i * HOUR_PX, left: 0, right: 0, borderTop: i === 0 ? 'none' : `1px solid ${c.border}`, height: HOUR_PX }}>
                    <Box sx={{ position: 'absolute', top: HOUR_PX / 2, left: 0, right: 0, borderTop: `1px dashed ${c.border}`, opacity: 0.3 }} />
                  </Box>
                ))}
                {isToday && nowMin >= START && nowMin <= END && (
                  <Box sx={{ position: 'absolute', top: ((nowMin - START) / 60) * HOUR_PX, left: 0, right: 0, zIndex: 3, pointerEvents: 'none' }}>
                    <Box sx={{ borderTop: `2px solid ${c.hot}` }} />
                    <Box sx={{ position: 'absolute', right: -4, top: -4, width: 8, height: 8, borderRadius: '50%', bgcolor: c.hot }} />
                  </Box>
                )}
                {gridBks.length === 0 && (
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <Typography sx={{ fontSize: 13.5, color: c.text3, fontWeight: 600 }}>{staffFilter ? `אין תורים ל${staffFilter} ביום זה` : 'לחץ על שעה כדי לקבוע תור ✨'}</Typography>
                  </Box>
                )}
                {gridBks.map((b) => {
                  const st = Math.max(move?.id === b.id && move.started ? move.min : toMin(b.time), START);
                  const liveDur = resize?.id === b.id ? resize.dur : (b.duration || 30);
                  const liveTime = move?.id === b.id && move.started ? `${String(Math.floor(st / 60)).padStart(2, '0')}:${String(st % 60).padStart(2, '0')}` : b.time;
                  const h = Math.max((liveDur / 60) * HOUR_PX - 3, 26);
                  const lane = Math.min(lanes.get(b.id) || 0, laneCount - 1);
                  const blocked = b.status === 'blocked';
                  const col = staffColor(b.staff);
                  return (
                    <Box key={b.id}
                      onClick={(e) => { e.stopPropagation(); if (justResized.current) { justResized.current = false; return; } openEdit(b); }}
                      sx={{ position: 'absolute', top: ((st - START) / 60) * HOUR_PX + 1, right: `calc(${(lane * 100) / laneCount}% + 3px)`, width: `calc(${100 / laneCount}% - 6px)`, height: h, zIndex: move?.id === b.id ? 5 : 2, cursor: move?.id === b.id && move.started ? 'grabbing' : 'pointer', overflow: 'hidden', touchAction: 'none',
                        bgcolor: blocked ? c.surface3 : `${col}14`, opacity: blocked ? 0.8 : 1, boxShadow: blocked ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                        border: blocked ? `1.5px dashed ${c.border}` : b.status === 'pending' ? '1.5px solid #F59E0B' : `1.5px solid ${col}55`, borderRight: `3px solid ${blocked ? c.text3 : col}`, borderRadius: 1.5, px: 1, py: 0.4,
                        transition: 'box-shadow 0.15s', '&:hover': { boxShadow: c.shadowMd, zIndex: 4 } }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: blocked ? c.text3 : b.status === 'pending' ? '#B45309' : col, lineHeight: 1.3 }}>{b.status === 'pending' ? '⏳ ' : ''}{liveTime} · {liveDur} דק'{resize?.id === b.id ? ' ↕' : ''}{move?.id === b.id && move.started ? ' ✥' : ''}</Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.customerName}</Typography>
                      {h > 48 && <Typography sx={{ fontSize: 10.5, color: c.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.service || (blocked ? '' : 'טיפול')}{!blocked && b.source === 'dana' ? ' · 🎙️ דנה' : ''}{!blocked && b.source === 'online' ? ' · 🔗' : ''}</Typography>}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })()}
        <Typography sx={{ fontSize: 12, color: c.text3, textAlign: 'center', mt: 1.5 }}>💡 לחיצה על שעה ריקה = תור חדש בשעה הזו · לחיצה על תור = עריכה</Typography>
      </Box>
      )}

      <Dialog scroll="body" open={addOpen} onClose={() => setAddOpen(false)} PaperProps={{ sx: { borderRadius: 2, p: 3.5, maxWidth: 420, width: '100%' } }}>
        <Typography sx={{ fontSize: 21, fontWeight: 800, mb: 0.5, color: c.text }}>{form.isBlock ? '🚫 חסימת זמן' : 'תור חדש'}</Typography>
        <Typography sx={{ fontSize: 13, color: c.text3, mb: 1.5 }}>{selectedDate}</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
          {[{ v: false, l: '📅 תור' }, { v: true, l: '🚫 חסימה' }].map((m) => (
            <Box key={String(m.v)} onClick={() => setForm((p) => ({ ...p, isBlock: m.v }))} sx={{ cursor: 'pointer', flex: 1, textAlign: 'center', py: 0.9, borderRadius: 2, fontSize: 13.5, fontWeight: 700, border: `1.5px solid ${form.isBlock === m.v ? c.accent : c.border2}`, color: form.isBlock === m.v ? c.accent : c.text3, bgcolor: form.isBlock === m.v ? c.accentDim : 'transparent', transition: 'all 0.15s' }}>{m.l}</Box>
          ))}
        </Box>
        {form.isBlock && <Typography sx={{ fontSize: 12.5, color: c.text3, mb: 2, mt: -1 }}>הזמן ייחסם ביומן — לקוחות לא יוכלו לקבוע בו בדף ההזמנות</Typography>}
        {!form.isBlock && <Autocomplete
          freeSolo
          options={customers}
          getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.name}
          value={form.customerName}
          onInputChange={(_, val) => setForm((p) => ({ ...p, customerName: val }))}
          onChange={(_, val) => {
            if (val && typeof val !== 'string') {
              setForm((p) => ({ ...p, customerName: val.name, customerPhone: val.phone || '' }));
            }
          }}
          renderOption={(props, opt) => (
            <Box component="li" {...props} key={opt.id}>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{opt.name}</Typography>
                <Typography sx={{ fontSize: 12, color: c.text3 }}>{opt.phone}{opt.visits ? ` · ${opt.visits} ביקורים` : ''}</Typography>
              </Box>
            </Box>
          )}
          renderInput={(params) => <TextField {...params} label="שם הלקוח" placeholder="חפש או הקלד חדש" />}
          sx={{ mb: 2 }}
        />}
        {!form.isBlock && <TextField fullWidth label="טלפון" value={form.customerPhone} onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))} sx={{ mb: 2 }} />}
        {!form.isBlock && (services.length > 0 ? (
          <TextField select fullWidth label="טיפול" value={form.service} onChange={(e) => {
            const svc = services.find((s) => s.name === e.target.value);
            setForm((p) => ({ ...p, service: e.target.value, duration: svc?.duration || p.duration }));
          }} sx={{ mb: 2 }}>
            {services.map((s) => <MenuItem key={s.name} value={s.name}>{s.name} · {s.duration} דק'{s.price ? ` · ₪${s.price}` : ''}</MenuItem>)}
          </TextField>
        ) : (
          <TextField fullWidth label="טיפול" value={form.service} onChange={(e) => setForm((p) => ({ ...p, service: e.target.value }))} sx={{ mb: 2 }} />
        ))}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField label="שעה" type="time" value={form.time} onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))} sx={{ flex: 1 }} InputLabelProps={{ shrink: true }} />
          <TextField select label="משך" value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: Number(e.target.value) }))} sx={{ flex: 1 }}>
            {(form.isBlock ? [30, 60, 90, 120, 180, 240, 300, 360, 480] : [15, 30, 45, 60, 90, 120, 180]).map((d) => <MenuItem key={d} value={d}>{d} דק'</MenuItem>)}
          </TextField>
        </Box>
        {team.length > 0 && (
          <TextField select fullWidth label="חבר צוות" value={form.staff} onChange={(e) => setForm((p) => ({ ...p, staff: e.target.value }))} sx={{ mb: 2 }}>
            <MenuItem value="">ללא שיוך</MenuItem>
            {team.map((m) => <MenuItem key={m.id} value={m.name}>{m.name}{m.role ? ` · ${m.role}` : ''}</MenuItem>)}
          </TextField>
        )}
        <TextField fullWidth label={form.isBlock ? "סיבה (הפסקה / סידורים / אישי)" : "הערות"} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} sx={{ mb: 2 }} multiline rows={2} />

        {/* Recurring */}
        <TextField select fullWidth label="חזרה" value={form.repeat} onChange={(e) => setForm((p) => ({ ...p, repeat: e.target.value }))} sx={{ mb: form.repeat !== 'none' ? 2 : 3 }} SelectProps={{ native: true }}>
          <option value="none">{form.isBlock ? "חד-פעמי" : "תור חד-פעמי"}</option>
          <option value="weekly">כל שבוע</option>
          <option value="biweekly">כל שבועיים</option>
          <option value="monthly">כל חודש</option>
        </TextField>
        {form.repeat !== 'none' && (
          <TextField select fullWidth label="כמה פעמים" value={form.repeatCount} onChange={(e) => setForm((p) => ({ ...p, repeatCount: Number(e.target.value) }))} sx={{ mb: 3 }} SelectProps={{ native: true }}>
            {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n} תורים</option>)}
          </TextField>
        )}
        <Button onClick={submit} variant="contained" fullWidth disabled={(!form.customerName && !form.isBlock) || saving} sx={{ borderRadius: 1.5, fontWeight: 700, py: 1.5 }}>
          {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : form.isBlock ? '🚫 חסום את הזמן' : 'קבע תור'}
        </Button>
      </Dialog>

      {/* Reschedule / edit dialog */}
      <BookingDetailDialog booking={editBooking} bizId={bizId} onClose={() => setEditBooking(null)} onChanged={load} />
    </Box>
  );
}
