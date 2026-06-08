'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog, TextField, Chip, Slider, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getServices, addService, updateService, deleteService, loadBiz, type Service } from '@/lib/bizdata';
import { zikkitColors as c } from '@/styles/theme';

interface Draft {
  name: string; category: string; price: number; duration: number; description: string; whatToAsk: string;
}
const emptyDraft: Draft = { name: '', category: '', price: 0, duration: 30, description: '', whatToAsk: '' };

export default function ServicesPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try { setServices(await getServices(bizId)); } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setDraft(emptyDraft); setEditId(null); setOpen(true); };
  const openEdit = (s: Service) => {
    setDraft({ name: s.name, category: s.category, price: s.price, duration: s.duration, description: s.description, whatToAsk: s.whatToAsk || '' });
    setEditId(s.id); setOpen(true);
  };

  const save = async () => {
    if (!bizId || !draft.name) return;
    setSaving(true);
    try {
      if (editId) await updateService(bizId, editId, draft);
      else await addService(bizId, draft);
      setOpen(false); await load();
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => { if (bizId) { await deleteService(bizId, id); await load(); } };

  // AI: suggest a full price list from the business name
  const suggestWithAI = async () => {
    if (!bizId) return;
    setAiLoading(true);
    try {
      const biz = await loadBiz(bizId);
      const bizName = (biz.cfg as Record<string, unknown>)?.biz_name as string || '';
      const res = await fetch('/api/dana/suggest-appointments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: bizName }),
      });
      const data = await res.json();
      if (data.services && Array.isArray(data.services)) {
        const existing = await getServices(bizId);
        const newOnes: Service[] = data.services.map((s: Record<string, unknown>) => ({
          id: 'svc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          name: (s.name as string) || '',
          category: (data.industry as string) || '',
          price: parseInt(String(s.price || 0)) || 0,
          duration: (s.duration as number) || 30,
          description: '',
          whatToAsk: (s.whatToAsk as string) || '',
          active: true,
        }));
        const { saveServices } = await import('@/lib/bizdata');
        await saveServices(bizId, [...existing, ...newOnes]);
        await load();
      } else {
        alert(data.error || 'ה-AI לא הצליח. ודא שיש credit ב-Anthropic.');
      }
    } catch {
      alert('שגיאה בזיהוי AI');
    } finally { setAiLoading(false); }
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  // Group by category
  const categories = Array.from(new Set(services.map((s) => s.category || 'כללי')));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.surface1 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 800, color: c.text }}>מחירון ושירותים</Typography>
        <Button onClick={openNew} variant="contained" sx={{ borderRadius: 99, fontWeight: 700 }}>+ שירות</Button>
      </Box>

      <Box sx={{ maxWidth: 700, mx: 'auto', p: 3 }}>
        <Box sx={{ bgcolor: c.accentDim, borderRadius: 3, p: 2, mb: 3 }}>
          <Typography sx={{ fontSize: 13, color: c.text2, lineHeight: 1.6 }}>
            🤖 דנה משתמשת במחירון הזה כדי לדעת אילו שירותים יש, כמה זמן כל אחד לוקח, וכמה הוא עולה. ככל שתפרט יותר — דנה תעבוד טוב יותר.
          </Typography>
        </Box>

        {services.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{ fontSize: 48, mb: 2 }}>📋</Box>
            <Typography sx={{ color: c.text2, mb: 1, fontWeight: 700 }}>עדיין אין שירותים במחירון</Typography>
            <Typography sx={{ color: c.text3, fontSize: 14, mb: 3 }}>הוסף ידנית או תן ל-AI להציע לפי סוג העסק</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
              <Button onClick={openNew} variant="contained" sx={{ borderRadius: 3, fontWeight: 700 }}>+ הוסף ידני</Button>
              <Button onClick={suggestWithAI} disabled={aiLoading} variant="outlined" sx={{ borderRadius: 3, fontWeight: 700, borderColor: c.accent, color: c.accent }}>
                {aiLoading ? <CircularProgress size={16} sx={{ color: c.accent }} /> : '✨ הצע עם AI'}
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            <Button onClick={suggestWithAI} disabled={aiLoading} variant="outlined" sx={{ borderRadius: 3, fontWeight: 700, borderColor: c.accent, color: c.accent, mb: 3, bgcolor: c.accentDim }}>
              {aiLoading ? <><CircularProgress size={16} sx={{ color: c.accent, mr: 1 }} />מזהה...</> : '✨ הוסף עוד שירותים עם AI'}
            </Button>

            {categories.map((cat) => (
              <Box key={cat} sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cat}</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {services.filter((s) => (s.category || 'כללי') === cat).map((s) => (
                    <Box key={s.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{s.name}</Typography>
                        {s.description && <Typography sx={{ fontSize: 12, color: c.text3 }}>{s.description}</Typography>}
                        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
                          <Chip label={`${s.duration} דק'`} size="small" sx={{ bgcolor: c.surface3, color: c.text2, fontSize: 10 }} />
                          {s.whatToAsk && <Chip label="🤖 הוראות לדנה" size="small" sx={{ bgcolor: c.accentDim, color: c.accent, fontSize: 10 }} />}
                        </Box>
                      </Box>
                      <Typography sx={{ fontSize: 20, fontWeight: 800, color: c.accent }}>₪{s.price}</Typography>
                      <Button onClick={() => openEdit(s)} size="small" sx={{ minWidth: 'auto', color: c.text2 }}>✎</Button>
                      <Button onClick={() => remove(s.id)} size="small" sx={{ minWidth: 'auto', color: c.hot }}>✕</Button>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </>
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { borderRadius: 4, p: 3, maxWidth: 440, width: '100%' } }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2, color: c.text }}>{editId ? 'עריכת שירות' : 'שירות חדש'}</Typography>
        <TextField fullWidth label="שם השירות" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="קטגוריה (למשל: תספורות, צבע)" value={draft.category} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField label="מחיר ₪" type="number" value={draft.price} onChange={(e) => setDraft((p) => ({ ...p, price: Number(e.target.value) }))} sx={{ flex: 1 }} />
          <TextField select label="משך" value={draft.duration} onChange={(e) => setDraft((p) => ({ ...p, duration: Number(e.target.value) }))} sx={{ flex: 1 }}>
            {[15, 30, 45, 60, 90, 120, 150, 180].map((d) => <MenuItem key={d} value={d}>{d} דק'</MenuItem>)}
          </TextField>
        </Box>
        <TextField fullWidth label="תיאור (אופציונלי)" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} sx={{ mb: 2 }} multiline rows={2} />
        <TextField fullWidth label="מה דנה צריכה לשאול?" placeholder="למשל: גבר/אישה, אורך שיער, אם הייתה כבר" value={draft.whatToAsk} onChange={(e) => setDraft((p) => ({ ...p, whatToAsk: e.target.value }))} sx={{ mb: 3 }} multiline rows={2} helperText="🤖 דנה תשאל את זה לפני קביעת התור" />
        <Button onClick={save} variant="contained" fullWidth disabled={!draft.name || saving} sx={{ borderRadius: 3, fontWeight: 800, py: 1.5 }}>
          {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : editId ? 'שמור' : 'הוסף למחירון'}
        </Button>
      </Dialog>
    </Box>
  );
}
