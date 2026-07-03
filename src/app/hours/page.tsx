'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Switch, TextField } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getHours, setHours, type BizHours } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function HoursPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [hours, setHoursState] = useState<BizHours | null>(null);
  const [newBlockDate, setNewBlockDate] = useState('');

  const addBlockedDate = () => {
    if (!newBlockDate || !hours) return;
    const existing = hours.blockedDates || [];
    if (!existing.includes(newBlockDate)) {
      setHoursState({ ...hours, blockedDates: [...existing, newBlockDate] });
    }
    setNewBlockDate('');
  };

  const removeBlockedDate = (d: string) => {
    if (!hours) return;
    setHoursState({ ...hours, blockedDates: (hours.blockedDates || []).filter((x) => x !== d) });
  };
  const [dataLoading, setDataLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try { setHoursState(await getHours(bizId)); } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  const update = (day: number, field: 'open' | 'start' | 'end', value: boolean | string) => {
    setHoursState((prev) => prev ? { days: { ...prev.days, [day]: { ...prev.days[day], [field]: value } } } : prev);
  };

  const save = async () => {
    if (!bizId || !hours) return;
    setSaving(true);
    try { await setHours(bizId, hours); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    finally { setSaving(false); }
  };

  if (loading || dataLoading || !hours) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>שעות פעילות</Typography>
        <Box sx={{ width: 80 }} />
      </Box>

      <Box sx={{ maxWidth: 560, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        <Typography sx={{ fontSize: 14, color: c.text2, mb: 3 }}>
          דנה תקבע תורים רק בשעות הפעילות. ימים סגורים לא יוצעו ללקוחות.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {DAYS.map((dayName, i) => {
            const d = hours.days[i];
            return (
              <Box key={i} sx={{ bgcolor: c.surface1, border: `1px solid ${d.open ? c.border : c.border}`, borderRadius: 2, p: 2, display: 'flex', alignItems: 'center', gap: 1.5, opacity: d.open ? 1 : 0.7, transition: 'all 0.2s' }}>
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text, minWidth: 52 }}>{dayName}</Typography>
                <Switch checked={d.open} onChange={(e) => update(i, 'open', e.target.checked)} />
                {d.open ? (
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 1 }}>
                    <TextField type="time" value={d.start} onChange={(e) => update(i, 'start', e.target.value)} size="small" sx={{ flex: 1 }} />
                    <Typography sx={{ color: c.text3 }}>—</Typography>
                    <TextField type="time" value={d.end} onChange={(e) => update(i, 'end', e.target.value)} size="small" sx={{ flex: 1 }} />
                  </Box>
                ) : (
                  <Typography sx={{ fontSize: 14, color: c.text3, flex: 1, fontWeight: 500 }}>סגור</Typography>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Blocked dates — holidays / vacation */}
        <Box sx={{ mt: 4 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text, mb: 0.5 }}>🚫 ימים חסומים</Typography>
          <Typography sx={{ fontSize: 13, color: c.text3, mb: 2 }}>חופשות, חגים או ימים שבהם אינך עובד. לקוחות לא יוכלו לקבוע תור בתאריכים האלה.</Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField type="date" value={newBlockDate} onChange={(e) => setNewBlockDate(e.target.value)} size="small" sx={{ flex: 1 }} InputLabelProps={{ shrink: true }} />
            <Button onClick={addBlockedDate} variant="outlined" disabled={!newBlockDate} sx={{ borderRadius: 1.5, fontWeight: 700, whiteSpace: 'nowrap' }}>+ חסום</Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {(hours.blockedDates || []).slice().sort().map((d) => (
              <Box key={d} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, bgcolor: c.hotDim, color: c.hot, borderRadius: 99, px: 1.75, py: 0.6, fontSize: 13, fontWeight: 600 }}>
                {new Date(d + 'T00:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                <Box onClick={() => removeBlockedDate(d)} sx={{ cursor: 'pointer', fontWeight: 800, ml: 0.25 }}>✕</Box>
              </Box>
            ))}
            {(hours.blockedDates || []).length === 0 && <Typography sx={{ fontSize: 13, color: c.text3 }}>אין ימים חסומים</Typography>}
          </Box>
        </Box>

        <Button onClick={save} variant="contained" fullWidth disabled={saving} sx={{ mt: 3, py: 1.75, borderRadius: 1.5, fontWeight: 800 }}>
          {saved ? '✓ נשמר!' : saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'שמור שעות'}
        </Button>
      </Box>
    </Box>
  );
}
