'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, TextField, Dialog } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getCustomers, upsertCustomer, getBookings, type Customer } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

export default function CustomersPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      let custs = await getCustomers(bizId);
      // Backfill from bookings if customers list is empty
      if (custs.length === 0) {
        const bookings = await getBookings(bizId);
        const byPhone = new Map<string, Customer>();
        bookings.forEach((b) => {
          if (!b.customerPhone) return;
          const existing = byPhone.get(b.customerPhone);
          if (existing) { existing.visits++; }
          else byPhone.set(b.customerPhone, { id: b.customerPhone, name: b.customerName, phone: b.customerPhone, visits: 1, lastVisit: b.date, totalSpent: 0, createdAt: b.createdAt });
        });
        custs = Array.from(byPhone.values());
      }
      setCustomers(custs.sort((a, b) => (b.visits || 0) - (a.visits || 0)));
    } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!bizId || !form.name || !form.phone) return;
    await upsertCustomer(bizId, form);
    setAddOpen(false);
    setForm({ name: '', phone: '', email: '' });
    await load();
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const filtered = customers.filter((cu) => cu.name?.includes(search) || cu.phone?.includes(search));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.surface1 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 800, color: c.text }}>לקוחות</Typography>
        <Button onClick={() => setAddOpen(true)} variant="contained" sx={{ borderRadius: 99, fontWeight: 700 }}>+ לקוח</Button>
      </Box>

      <Box sx={{ maxWidth: 700, mx: 'auto', p: 3 }}>
        <TextField fullWidth placeholder="🔍 חיפוש לפי שם או טלפון" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 3 }} />
        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: 48, mb: 2 }}>👥</Box>
            <Typography sx={{ color: c.text3 }}>{search ? 'לא נמצאו לקוחות' : 'עדיין אין לקוחות'}</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {filtered.map((cu) => (
              <Box key={cu.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: c.accentDim, color: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>{cu.name?.[0] || '?'}</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{cu.name}</Typography>
                  <Typography sx={{ fontSize: 13, color: c.text2 }}>{cu.phone}</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 18, fontWeight: 800, color: c.accent }}>{cu.visits}</Typography>
                  <Typography sx={{ fontSize: 10, color: c.text3 }}>ביקורים</Typography>
                </Box>
                {cu.phone && <Button href={`tel:${cu.phone}`} size="small" sx={{ minWidth: 'auto', color: c.accent }}>📞</Button>}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} PaperProps={{ sx: { borderRadius: 4, p: 3, maxWidth: 400, width: '100%' } }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2, color: c.text }}>לקוח חדש</Typography>
        <TextField fullWidth label="שם" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="טלפון" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="אימייל (אופציונלי)" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} sx={{ mb: 3 }} />
        <Button onClick={add} variant="contained" fullWidth disabled={!form.name || !form.phone} sx={{ borderRadius: 3, fontWeight: 800, py: 1.5 }}>הוסף</Button>
      </Dialog>
    </Box>
  );
}
