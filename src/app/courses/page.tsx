'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Chip, Dialog, TextField, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getProducts, addProduct, deleteProduct } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

interface Product {
  id: string; type: string; name: string; description: string; price: number;
  contentUrl?: string; sessions?: number; active: boolean; sales: number;
}

const TYPES = [
  { id: 'course', label: '🎓 קורס דיגיטלי', hint: 'תוכן וידאו / PDF' },
  { id: 'package', label: '🎟️ כרטיסייה', hint: 'מספר טיפולים מראש' },
  { id: 'physical', label: '🧴 מוצר', hint: 'מוצר פיזי למכירה' },
];

export default function CoursesPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ type: 'course' | 'package' | 'physical'; name: string; description: string; price: number; contentUrl: string; sessions: number }>({ type: 'course', name: '', description: '', price: 0, contentUrl: '', sessions: 5 });

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const items = await getProducts(bizId);
      setProducts(items);
    } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!bizId || !draft.name) return;
    await addProduct(bizId, draft);
    setOpen(false);
    setDraft({ type: 'course', name: '', description: '', price: 0, contentUrl: '', sessions: 5 });
    load();
  };

  const remove = async (id: string) => {
    if (!bizId) return;
    await deleteProduct(bizId, id);
    load();
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>קורסים ומוצרים</Typography>
        <Button onClick={() => setOpen(true)} variant="contained" sx={{ borderRadius: 99, fontWeight: 700 }}>+ הוסף</Button>
      </Box>

      <Box sx={{ maxWidth: 700, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {products.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: 48, mb: 2 }}>🎓</Box>
            <Typography sx={{ color: c.text2, mb: 1, fontWeight: 700 }}>אין עדיין קורסים או מוצרים</Typography>
            <Typography sx={{ color: c.text3, fontSize: 14, mb: 3 }}>מכרו קורסים דיגיטליים, כרטיסיות ומוצרים ללקוחות שלכם</Typography>
            <Button onClick={() => setOpen(true)} variant="contained" sx={{ borderRadius: 3, fontWeight: 700 }}>צור את הראשון</Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {products.map((p) => (
              <Box key={p.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, boxShadow: c.shadowSm, p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ fontSize: 32 }}>{TYPES.find((t) => t.id === p.type)?.label.split(' ')[0] || '📦'}</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: c.text }}>{p.name}</Typography>
                  <Typography sx={{ fontSize: 13, color: c.text2 }}>{p.description}</Typography>
                  {p.sales > 0 && <Chip label={`${p.sales} מכירות`} size="small" sx={{ mt: 0.5, bgcolor: c.accentDim, color: c.accent, fontSize: 10 }} />}
                </Box>
                <Typography sx={{ fontSize: 20, fontWeight: 800, color: c.accent }}>₪{p.price}</Typography>
                <Button onClick={() => remove(p.id)} size="small" sx={{ color: c.hot, minWidth: 'auto' }}>✕</Button>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { borderRadius: 5, p: 3.5, maxWidth: 420, width: '100%', maxHeight: '90vh', overflowY: 'auto' } }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2, color: c.text }}>פריט חדש</Typography>
        <TextField select fullWidth label="סוג" value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value as 'course' | 'package' | 'physical' }))} sx={{ mb: 2 }}>
          {TYPES.map((t) => <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>)}
        </TextField>
        <TextField fullWidth label="שם" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="תיאור" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} sx={{ mb: 2 }} multiline rows={2} />
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField label="מחיר ₪" type="number" value={draft.price} onChange={(e) => setDraft((p) => ({ ...p, price: Number(e.target.value) }))} sx={{ flex: 1 }} />
          {draft.type === 'package' && <TextField label="מספר טיפולים" type="number" value={draft.sessions} onChange={(e) => setDraft((p) => ({ ...p, sessions: Number(e.target.value) }))} sx={{ flex: 1 }} />}
        </Box>
        {draft.type === 'course' && <TextField fullWidth label="קישור לתוכן (וידאו/PDF)" value={draft.contentUrl} onChange={(e) => setDraft((p) => ({ ...p, contentUrl: e.target.value }))} sx={{ mb: 2 }} />}
        <Button onClick={create} variant="contained" fullWidth disabled={!draft.name} sx={{ borderRadius: 3, fontWeight: 800, py: 1.5 }}>צור</Button>
      </Dialog>
    </Box>
  );
}
