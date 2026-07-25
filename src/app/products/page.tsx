'use client';

/** Products the business sells — shown as a shelf on its booking app. */

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog, TextField, Switch } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { loadBiz, patchBiz } from '@/lib/bizdata';
import { useToast } from '@/components/Toast';
import { zikkitColors as c } from '@/styles/theme';

interface Product { id: string; name: string; price: number; photo: string; description: string; active: boolean }

function downscale(file: File, max: number, q: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL('image/jpeg', q));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function ProductsPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<Product[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: '', price: 0, photo: '', description: '', active: true });

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const biz = await loadBiz(bizId);
      setItems((((biz as Record<string, unknown>).products as Record<string, unknown>)?.items as Product[]) || []);
    } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const persist = async (next: Product[]) => {
    if (!bizId) return;
    setItems(next);
    await patchBiz(bizId, { products: { items: next } });
  };

  const save = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      const next = editId
        ? items.map((p) => (p.id === editId ? { ...p, ...draft } : p))
        : [{ id: 'prd_' + Date.now(), ...draft }, ...items];
      await persist(next);
      setOpen(false);
      showToast('נשמר!', 'success');
    } catch (e) { showToast((e as Error).message || 'שגיאה', 'error'); } finally { setSaving(false); }
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const dataUrl = await downscale(f, 600, 0.7);
    setDraft((p) => ({ ...p, photo: dataUrl }));
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.canvas }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.canvas }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 20, bgcolor: c.chrome, backdropFilter: 'blur(20px)' }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: c.text }}>🛍️ מוצרים</Typography>
        <Button onClick={() => { setDraft({ name: '', price: 0, photo: '', description: '', active: true }); setEditId(null); setOpen(true); }} variant="contained" sx={{ borderRadius: 99, fontWeight: 500 }}>+ מוצר</Button>
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2, sm: 4 }, py: 3 }}>
        <Typography sx={{ fontSize: 13.5, color: c.text3, mb: 2.5 }}>המוצרים מוצגים במדף באפליקציית ההזמנות שלך — לקוחות מזמינים בוואטסאפ בלחיצה.</Typography>
        {items.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: 40, mb: 1.5 }}>🛍️</Box>
            <Typography sx={{ fontWeight: 500, color: c.text, mb: 0.5 }}>עוד אין מוצרים</Typography>
            <Typography sx={{ fontSize: 13, color: c.text3 }}>ווקס, שמפו, לק, מוצרי טיפוח — כל מה שאתם מוכרים בעסק</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
            {items.map((p) => (
              <Box key={p.id} onClick={() => { setDraft({ name: p.name, price: p.price, photo: p.photo, description: p.description, active: p.active !== false }); setEditId(p.id); setOpen(true); }} sx={{ cursor: 'pointer', bgcolor: c.card, border: `1px solid ${c.border2}`, borderRadius: 4, overflow: 'hidden', opacity: p.active === false ? 0.5 : 1, transition: 'all 0.15s', '&:hover': { borderColor: c.accent } }}>
                {p.photo ? <Box component="img" src={p.photo} sx={{ width: '100%', height: 120, objectFit: 'cover' }} /> : <Box sx={{ height: 120, bgcolor: c.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🛍️</Box>}
                <Box sx={{ p: 1.5 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text }}>{p.name}</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.accent }}>₪{p.price}</Typography>
                  {p.active === false && <Typography sx={{ fontSize: 11, color: c.text3 }}>מוסתר</Typography>}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth PaperProps={{ sx: { bgcolor: c.card, borderRadius: 4, maxWidth: 420, m: 2, p: 3 } }}>
        <Typography sx={{ fontSize: 19, fontWeight: 600, color: c.text, mb: 2 }}>{editId ? 'עריכת מוצר' : 'מוצר חדש'}</Typography>
        <Box component="label" sx={{ display: 'block', cursor: 'pointer', mb: 2 }}>
          {draft.photo ? <Box component="img" src={draft.photo} sx={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 4 }} /> : (
            <Box sx={{ height: 110, border: `2px dashed ${c.border2}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ fontSize: 26 }}>📷</Box>
              <Typography sx={{ fontSize: 12.5, color: c.text3 }}>הוסף תמונה</Typography>
            </Box>
          )}
          <input type="file" accept="image/*" hidden onChange={handlePhoto} />
        </Box>
        <TextField fullWidth label="שם המוצר" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="מחיר (₪)" type="number" value={draft.price || ''} onChange={(e) => setDraft((p) => ({ ...p, price: Number(e.target.value) || 0 }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="תיאור (אופציונלי)" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} sx={{ mb: 1.5 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ fontSize: 14, color: c.text }}>מוצג באפליקציה</Typography>
          <Switch checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={save} disabled={!draft.name.trim() || saving} fullWidth variant="contained" sx={{ borderRadius: 4, fontWeight: 600, py: 1.25 }}>{saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'שמור'}</Button>
          {editId && <Button onClick={async () => { await persist(items.filter((p) => p.id !== editId)); setOpen(false); }} sx={{ borderRadius: 4, fontWeight: 500, color: c.hot, whiteSpace: 'nowrap' }}>מחק</Button>}
        </Box>
      </Dialog>
    </Box>
  );
}
