'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, TextField, Dialog, Switch } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getCustomers, upsertCustomer, updateCustomer, deleteCustomer, getBookings, getCustomerHistory, type Customer, type Booking } from '@/lib/bizdata';
import { PageSkeleton } from '@/components/Skeleton';
import { zikkitColors as c } from '@/styles/theme';

const TAGS = ['VIP', 'קבוע', 'חדש', 'בעייתי', 'ממליץ'];
const HEBREW_MONTHS = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יוני', 'יולי', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];

export default function CustomersPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading, user, staffName } = useAuth();
  const isStaff = user?.role === 'staff' && !!staffName;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'vip' | 'recent'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const bks = await getBookings(bizId);
      setBookings(bks);
      let custs = await getCustomers(bizId);
      if (isStaff) {
        // A team member sees only customers who booked with THEM
        const allBks = await getBookings(bizId);
        const myPhones = new Set(
          allBks.filter((b) => b.staff === staffName && b.customerPhone)
            .map((b) => String(b.customerPhone).replace(/\D/g, '').slice(-9)),
        );
        custs = custs.filter((cu) => myPhones.has(String(cu.phone || '').replace(/\D/g, '').slice(-9)));
      }
      if (custs.length === 0) {
        const byPhone = new Map<string, Customer>();
        bks.forEach((b) => {
          if (!b.customerPhone) return;
          const existing = byPhone.get(b.customerPhone);
          if (existing) { existing.visits++; }
          else byPhone.set(b.customerPhone, { id: b.customerPhone, name: b.customerName, phone: b.customerPhone, visits: 1, lastVisit: b.date, totalSpent: 0, createdAt: b.createdAt });
        });
        custs = Array.from(byPhone.values());
      }
      setCustomers(custs.sort((a, b) => (b.visits || 0) - (a.visits || 0)));
    } finally { setDataLoading(false); }
  }, [bizId, isStaff, staffName]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!bizId || !form.name || !form.phone) return;
    await upsertCustomer(bizId, form);
    setForm({ name: '', phone: '', email: '' });
    setAddOpen(false);
    await load();
  };

  const toggleTag = async (cust: Customer, tag: string) => {
    if (!bizId) return;
    const tags = cust.tags || [];
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    await updateCustomer(bizId, cust.id, { tags: next, vip: next.includes('VIP') });
    const updated = { ...cust, tags: next, vip: next.includes('VIP') };
    setDetail(updated);
    await load();
  };

  const saveNotes = async (cust: Customer, notes: string) => {
    if (!bizId) return;
    await updateCustomer(bizId, cust.id, { notes });
  };

  if (loading || dataLoading) return <PageSkeleton rows={6} />;

  let filtered = customers.filter((cu) => cu.name?.toLowerCase().includes(search.toLowerCase()) || cu.phone?.includes(search));
  if (filter === 'vip') filtered = filtered.filter((cu) => cu.vip);
  else if (filter === 'recent') {
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
    filtered = filtered.filter((cu) => cu.lastVisit && cu.lastVisit >= monthAgo.toISOString().split('T')[0]);
  }

  const detailHistory = detail ? getCustomerHistory(bookings, detail.phone) : null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>לקוחות</Typography>
        <Button onClick={() => setAddOpen(true)} variant="contained" sx={{ borderRadius: 99, fontWeight: 700, px: 2.5 }}>+ לקוח</Button>
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 680, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        <TextField fullWidth placeholder="🔍  חיפוש לפי שם או טלפון" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 99, bgcolor: c.surface1 } }} />

        {/* Filter pills */}
        <Box sx={{ display: 'flex', gap: 0.75, mb: 3 }}>
          {([['all', 'הכל'], ['vip', '⭐ VIP'], ['recent', 'פעילים']] as [typeof filter, string][]).map(([f, label]) => (
            <Button key={f} onClick={() => setFilter(f)} sx={{ borderRadius: 99, fontWeight: 600, fontSize: 13, px: 2, py: 0.5, bgcolor: filter === f ? c.accent : c.surface2, color: filter === f ? '#fff' : c.text2, '&:hover': { bgcolor: filter === f ? c.accent : c.surface3 } }}>{label}</Button>
          ))}
        </Box>

        {customers.length > 0 && <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{filtered.length} לקוחות</Typography>}

        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: 40, mb: 1.5, opacity: 0.5 }}>👥</Box>
            <Typography sx={{ color: c.text3 }}>{search ? 'לא נמצאו לקוחות' : 'עדיין אין לקוחות'}</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {filtered.map((cu) => (
              <Box key={cu.id} onClick={() => setDetail(cu)} sx={{ cursor: 'pointer', bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2, display: 'flex', alignItems: 'center', gap: 2, transition: 'all 0.2s', '&:hover': {  transform: 'translateY(-2px)' } }}>
                <Box sx={{ position: 'relative' }}>
                  <Box sx={{ width: 46, height: 46, borderRadius: '50%', bgcolor: c.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0 }}>{cu.name?.[0] || '?'}</Box>
                  {cu.vip && <Box sx={{ position: 'absolute', top: -3, right: -3, fontSize: 13 }}>⭐</Box>}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{cu.name}</Typography>
                    {(cu.tags || []).filter((t) => t !== 'VIP').slice(0, 1).map((t) => <Box key={t} sx={{ fontSize: 9.5, fontWeight: 600, bgcolor: c.surface3, color: c.text2, borderRadius: 99, px: 0.75 }}>{t}</Box>)}
                  </Box>
                  <Typography sx={{ fontSize: 13, color: c.text3 }}>{cu.phone}</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', bgcolor: c.surface2, borderRadius: 2.5, px: 1.5, py: 0.75 }}>
                  <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.accent, lineHeight: 1 }}>{cu.visits}</Typography>
                  <Typography sx={{ fontSize: 9.5, color: c.text3 }}>ביקורים</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Add dialog */}
      <Dialog scroll="body" open={addOpen} onClose={() => setAddOpen(false)} PaperProps={{ sx: { borderRadius: 2, p: 3.5, maxWidth: 400, width: '100%' } }}>
        <Typography sx={{ fontSize: 21, fontWeight: 800, mb: 2.5, color: c.text }}>לקוח חדש</Typography>
        <TextField fullWidth label="שם" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="טלפון" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="אימייל (אופציונלי)" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} sx={{ mb: 3 }} />
        <Button onClick={add} variant="contained" fullWidth disabled={!form.name || !form.phone} sx={{ borderRadius: 1.5, fontWeight: 700, py: 1.5 }}>הוסף לקוח</Button>
      </Dialog>

      {/* Detail dialog */}
      <Dialog scroll="body" open={!!detail} onClose={() => { setDetail(null); load(); }} PaperProps={{ sx: { borderRadius: 2, maxWidth: 440, width: '100%' } }}>
        {detail && detailHistory && (
          <Box>
            {/* Header */}
            <Box sx={{ bgcolor: c.accent, p: 3, color: '#fff', position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 60, height: 60, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800 }}>{detail.name?.[0]}</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 22, fontWeight: 800 }}>{detail.name} {detail.vip && '⭐'}</Typography>
                  <Typography sx={{ fontSize: 14, opacity: 0.9 }}>{detail.phone}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mt: 2.5 }}>
                <Box><Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{detail.visits}</Typography><Typography sx={{ fontSize: 11, opacity: 0.85 }}>ביקורים</Typography></Box>
                <Box><Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>₪{detailHistory.totalSpent.toLocaleString()}</Typography><Typography sx={{ fontSize: 11, opacity: 0.85 }}>סה״כ הוציא</Typography></Box>
                {detail.lastVisit && <Box><Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{detail.lastVisit.slice(5)}</Typography><Typography sx={{ fontSize: 11, opacity: 0.85 }}>ביקור אחרון</Typography></Box>}
              </Box>
            </Box>

            {/* No-show warning */}
            {detailHistory.noShows >= 2 && (
              <Box sx={{ mx: 3, mt: 2, p: 1.75, bgcolor: c.hotDim, border: `1px solid ${c.hot}`, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ fontSize: 20 }}>⚠️</Box>
                <Typography sx={{ fontSize: 13, color: c.hot, fontWeight: 600 }}>לקוח זה לא הגיע ל-{detailHistory.noShows} תורים. שקול לבקש אישור מראש.</Typography>
              </Box>
            )}

            <Box sx={{ p: 3 }}>
              {/* Tags */}
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text2, mb: 1 }}>תגיות</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
                {TAGS.map((tag) => {
                  const on = (detail.tags || []).includes(tag);
                  return <Box key={tag} onClick={() => toggleTag(detail, tag)} sx={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, borderRadius: 99, px: 1.5, py: 0.5, bgcolor: on ? c.accent : c.surface3, color: on ? '#fff' : c.text2 }}>{tag === 'VIP' ? '⭐ VIP' : tag}</Box>;
                })}
              </Box>

              {/* Quick actions */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
                <Button href={`tel:${detail.phone}`} fullWidth variant="outlined" sx={{ borderRadius: 2.5, fontWeight: 600 }}>📞 התקשר</Button>
                <Button href={`https://wa.me/972${detail.phone.replace(/^0/, '')}`} target="_blank" fullWidth variant="outlined" sx={{ borderRadius: 2.5, fontWeight: 600, color: '#25D366', borderColor: c.border2 }}>💬 וואטסאפ</Button>
              </Box>

              {/* Notes */}
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text2, mb: 1 }}>הערות</Typography>
              <TextField fullWidth multiline rows={2} defaultValue={detail.notes || ''} onBlur={(e) => saveNotes(detail, e.target.value)} placeholder="העדפות, רגישויות, פרטים..." sx={{ mb: 2.5 }} size="small" />

              {/* History */}
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text2, mb: 1 }}>היסטוריית תורים ({detailHistory.history.length})</Typography>
              {detailHistory.history.length === 0 ? (
                <Typography sx={{ fontSize: 13, color: c.text3, py: 2, textAlign: 'center' }}>אין תורים עדיין</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 200, overflowY: 'auto' }}>
                  {detailHistory.history.map((h) => (
                    <Box key={h.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: c.surface2, borderRadius: 2.5, p: 1.25 }}>
                      <Box sx={{ textAlign: 'center', minWidth: 38 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.accent, lineHeight: 1 }}>{new Date(h.date).getDate()}</Typography>
                        <Typography sx={{ fontSize: 9, color: c.text3 }}>{HEBREW_MONTHS[new Date(h.date).getMonth()]}</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: c.text }}>{h.service || 'טיפול'}</Typography>
                        <Typography sx={{ fontSize: 11, color: c.text3 }}>{h.time}{h.staff ? ` · ${h.staff}` : ''}</Typography>
                      </Box>
                      {h.status === 'cancelled' ? <Typography sx={{ fontSize: 11, color: c.hot }}>בוטל</Typography> : h.price ? <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2 }}>₪{h.price}</Typography> : null}
                    </Box>
                  ))}
                </Box>
              )}

              <Button onClick={async () => { if (bizId && confirm('למחוק את הלקוח?')) { await deleteCustomer(bizId, detail.id); setDetail(null); load(); } }} fullWidth sx={{ mt: 2.5, color: c.hot, fontWeight: 600, fontSize: 13 }}>מחק לקוח</Button>
            </Box>
          </Box>
        )}
      </Dialog>
    </Box>
  );
}
