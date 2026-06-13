'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog, TextField, MenuItem, Switch } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getExpenses, addExpense, deleteExpense, getBookings, getServices, computeProfit, EXPENSE_CATEGORIES, type Expense, type Booking, type Service } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

type Range = 'month' | 'quarter' | 'year' | 'all';

export default function ExpensesPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [range, setRange] = useState<Range>('month');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ description: '', amount: 0, category: EXPENSE_CATEGORIES[0], date: new Date().toISOString().split('T')[0], recurring: false });

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      setExpenses(await getExpenses(bizId));
      setBookings(await getBookings(bizId));
      setServices(await getServices(bizId));
    } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!bizId || !draft.description || !draft.amount) return;
    setSaving(true);
    try { await addExpense(bizId, draft); setOpen(false); setDraft({ description: '', amount: 0, category: EXPENSE_CATEGORIES[0], date: new Date().toISOString().split('T')[0], recurring: false }); await load(); }
    finally { setSaving(false); }
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const today = new Date();
  let from = new Date();
  if (range === 'month') from.setDate(today.getDate() - 30);
  else if (range === 'quarter') from.setDate(today.getDate() - 90);
  else if (range === 'year') from.setFullYear(today.getFullYear() - 1);
  else from = new Date('2020-01-01');
  const fromStr = from.toISOString().split('T')[0];
  const toStr = today.toISOString().split('T')[0];

  const p = computeProfit(bookings, expenses, fromStr, toStr, services);
  const rangeExpenses = expenses.filter((e) => e.date >= fromStr && e.date <= toStr);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>הוצאות ורווחיות</Typography>
        <Button onClick={() => setOpen(true)} variant="contained" sx={{ borderRadius: 99, fontWeight: 700, px: 2.5 }}>+ הוצאה</Button>
      </Box>

      <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {/* Range */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 3, bgcolor: c.surface3, p: 0.5, borderRadius: 99, width: 'fit-content', mx: 'auto' }}>
          {([['month', 'חודש'], ['quarter', 'רבעון'], ['year', 'שנה'], ['all', 'הכל']] as [Range, string][]).map(([r, label]) => (
            <Button key={r} onClick={() => setRange(r)} sx={{ borderRadius: 99, fontWeight: 600, fontSize: 13.5, px: 2.5, py: 0.6, minWidth: 60, bgcolor: range === r ? c.surface1 : 'transparent', color: range === r ? c.text : c.text3, boxShadow: range === r ? c.shadowSm : 'none', '&:hover': { bgcolor: range === r ? c.surface1 : 'transparent' } }}>{label}</Button>
          ))}
        </Box>

        {/* Profit hero */}
        <Box sx={{ background: p.profit >= 0 ? `linear-gradient(135deg, ${c.green}, #1F7A4D)` : `linear-gradient(135deg, ${c.hot}, #B91C1C)`, borderRadius: 6, p: { xs: 3, sm: 4 }, color: '#fff', mb: 2.5, boxShadow: c.shadowLg }}>
          <Typography sx={{ fontSize: 14, opacity: 0.85, fontWeight: 500 }}>רווח נקי</Typography>
          <Typography sx={{ fontSize: { xs: 40, sm: 50 }, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>₪{p.profit.toLocaleString()}</Typography>
          <Typography sx={{ fontSize: 13, opacity: 0.85, mt: 0.5 }}>שולי רווח {p.margin}%</Typography>
        </Box>

        {/* Revenue vs expenses */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2.5, boxShadow: c.shadowSm }}>
            <Typography sx={{ fontSize: 12.5, color: c.text3, fontWeight: 600 }}>📈 הכנסות</Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 800, color: c.green, letterSpacing: '-0.02em' }}>₪{p.revenue.toLocaleString()}</Typography>
          </Box>
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2.5, boxShadow: c.shadowSm }}>
            <Typography sx={{ fontSize: 12.5, color: c.text3, fontWeight: 600 }}>📉 הוצאות</Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 800, color: c.hot, letterSpacing: '-0.02em' }}>₪{p.expenses.toLocaleString()}</Typography>
          </Box>
        </Box>

        {/* By category */}
        {p.byCategory.length > 0 && (
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 5, p: 3, mb: 3, boxShadow: c.shadowSm }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text, mb: 2.5 }}>הוצאות לפי קטגוריה</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {p.byCategory.map((cat) => (
                <Box key={cat.category}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text }}>{cat.category}</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>₪{cat.amount.toLocaleString()}</Typography>
                  </Box>
                  <Box sx={{ height: 7, bgcolor: c.surface3, borderRadius: 99, overflow: 'hidden' }}>
                    <Box sx={{ width: `${p.expenses ? (cat.amount / p.expenses) * 100 : 0}%`, height: '100%', background: `linear-gradient(to right, ${c.hot}, #F87171)`, borderRadius: 99 }} />
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Expense list */}
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>הוצאות אחרונות</Typography>
        {rangeExpenses.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <Box sx={{ fontSize: 36, mb: 1, opacity: 0.5 }}>💸</Box>
            <Typography sx={{ color: c.text3, fontSize: 14 }}>אין הוצאות בתקופה זו</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {rangeExpenses.map((e) => (
              <Box key={e.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 2, display: 'flex', alignItems: 'center', gap: 2, boxShadow: c.shadowSm }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: c.text }}>{e.description}{e.recurring && ' 🔄'}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{e.category} · {e.date}</Typography>
                </Box>
                <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.hot }}>-₪{e.amount.toLocaleString()}</Typography>
                <Button onClick={async () => { if (bizId) { await deleteExpense(bizId, e.id); await load(); } }} size="small" sx={{ minWidth: 'auto', color: c.text3, '&:hover': { color: c.hot } }}>✕</Button>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Dialog scroll="body" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { borderRadius: 5, p: 3.5, maxWidth: 400, width: '100%' } }}>
        <Typography sx={{ fontSize: 21, fontWeight: 800, mb: 2.5, color: c.text }}>הוצאה חדשה</Typography>
        <TextField fullWidth label="תיאור" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <TextField label="סכום ₪" type="number" value={draft.amount || ''} onChange={(e) => setDraft((p) => ({ ...p, amount: Number(e.target.value) }))} sx={{ flex: 1 }} />
          <TextField label="תאריך" type="date" value={draft.date} onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))} sx={{ flex: 1 }} InputLabelProps={{ shrink: true }} />
        </Box>
        <TextField select fullWidth label="קטגוריה" value={draft.category} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))} sx={{ mb: 2 }}>
          {EXPENSE_CATEGORIES.map((cat) => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
        </TextField>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, bgcolor: c.surface2, borderRadius: 3, px: 2, py: 1 }}>
          <Typography sx={{ fontSize: 14, color: c.text2 }}>הוצאה חודשית קבועה 🔄</Typography>
          <Switch checked={draft.recurring} onChange={(e) => setDraft((p) => ({ ...p, recurring: e.target.checked }))} />
        </Box>
        <Button onClick={save} variant="contained" fullWidth disabled={!draft.description || !draft.amount || saving} sx={{ borderRadius: 3, fontWeight: 700, py: 1.5 }}>
          {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'הוסף הוצאה'}
        </Button>
      </Dialog>
    </Box>
  );
}
