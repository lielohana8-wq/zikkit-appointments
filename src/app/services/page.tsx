'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog, TextField, Chip, Slider, MenuItem } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getServices, addService, updateService, deleteService, loadBiz, type Service } from '@/lib/bizdata';
import { useToast } from '@/components/Toast';
import { zikkitColors as c } from '@/styles/theme';

interface Draft {
  name: string; category: string; price: number; priceFrom: boolean; duration: number; description: string; whatToAsk: string;
}
const emptyDraft: Draft = { name: '', category: '', price: 0, priceFrom: false, duration: 30, description: '', whatToAsk: '' };

export default function ServicesPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading, user, staffName } = useAuth();
  const isStaff = user?.role === 'staff';
  const [allowedServices, setAllowedServices] = useState<Set<string> | null>(null);
  const { showToast } = useToast();
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
    try {
      setServices(await getServices(bizId));
      if (isStaff && staffName) {
        const { getTeam } = await import('@/lib/bizdata');
        const team = await getTeam(bizId);
        const me = team.find((m) => m.name === staffName);
        setAllowedServices(new Set(me?.services || []));
        setMyPrices((me as unknown as { prices?: Record<string, number> })?.prices || {});
      }
    } finally { setDataLoading(false); }
  }, [bizId, isStaff, staffName]);

  useEffect(() => { load(); }, [load]);
  const [myPrices, setMyPrices] = useState<Record<string, number>>({});

  const openNew = () => { setDraft(emptyDraft); setEditId(null); setOpen(true); };
  const openEdit = (s: Service) => {
    setDraft({ name: s.name, category: s.category, price: isStaff && myPrices[s.name] !== undefined ? myPrices[s.name] : s.price, priceFrom: s.priceFrom || false, duration: s.duration, description: s.description, whatToAsk: s.whatToAsk || '' });
    setEditId(s.id); setOpen(true);
  };

  const save = async () => {
    if (!bizId || !draft.name) return;
    setSaving(true);
    try {
      if (isStaff && staffName && editId) {
        // A team member's price is PERSONAL — it never touches the business price list
        const { loadBiz, patchBiz } = await import('@/lib/bizdata');
        const biz = await loadBiz(bizId);
        const teamWrap = ((biz as Record<string, unknown>).team as { members?: Array<Record<string, unknown>> }) || {};
        const members = (teamWrap.members || []).map((m) => (m.name === staffName ? { ...m, prices: { ...((m.prices as Record<string, number>) || {}), [draft.name]: Number(draft.price) || 0 } } : m));
        await patchBiz(bizId, { team: { ...teamWrap, members } });
      } else if (editId) await updateService(bizId, editId, draft);
      else await addService(bizId, draft);
      setOpen(false); await load();
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => { if (isStaff) return; if (bizId) { await deleteService(bizId, id); await load(); } };

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
        showToast(data.error || 'ה-AI לא הצליח. ודא שיש credit ב-Anthropic.', 'error');
      }
    } catch {
      showToast('שגיאה בזיהוי AI', 'error');
    } finally { setAiLoading(false); }
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  // Group by category
  // Staff members see and edit only the services assigned to them
  const visibleServices = isStaff && allowedServices !== null ? services.filter((sv) => allowedServices.has(sv.name)) : services;
  const categories = Array.from(new Set(visibleServices.map((s) => s.category || 'כללי')));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>מחירון ושירותים</Typography>
        {!isStaff && <Button onClick={openNew} variant="contained" sx={{ borderRadius: 99, fontWeight: 700 }}>+ שירות</Button>}
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 680, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2, mb: 3, display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Box sx={{ fontSize: 22 }}>🤖</Box>
          <Typography sx={{ fontSize: 12.5, color: c.text2, lineHeight: 1.5 }}>
            דנה והיומן משתמשים במחירון הזה כדי לדעת אילו שירותים יש, כמה זמן וכמה הם עולים.
          </Typography>
        </Box>

        {services.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{ fontSize: 40, mb: 1.5, opacity: 0.5 }}>📋</Box>
            <Typography sx={{ color: c.text2, mb: 0.5, fontWeight: 700 }}>עדיין אין שירותים</Typography>
            <Typography sx={{ color: c.text3, fontSize: 13.5, mb: 3 }}>הוסף ידנית או תן ל-AI להציע לפי סוג העסק</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
              <Button onClick={openNew} variant="contained" sx={{ borderRadius: 1.5, fontWeight: 700 }}>+ הוסף ידני</Button>
              <Button onClick={suggestWithAI} disabled={aiLoading} variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 700 }}>
                {aiLoading ? <CircularProgress size={16} sx={{ color: c.accent }} /> : '✨ הצע עם AI'}
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            <Button onClick={suggestWithAI} disabled={aiLoading} fullWidth variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 700, mb: 3, py: 1.25, borderStyle: 'dashed' }}>
              {aiLoading ? <><CircularProgress size={16} sx={{ color: c.accent, mr: 1 }} />מזהה...</> : '✨ הוסף עוד שירותים עם AI'}
            </Button>

            {categories.map((cat) => (
              <Box key={cat} sx={{ mb: 3.5 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat}</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {visibleServices.filter((s) => (s.category || 'כללי') === cat).map((s) => (
                    <Box key={s.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.25, display: 'flex', alignItems: 'center', gap: 2, transition: 'all 0.2s', '&:hover': { boxShadow: c.shadowMd } }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 15.5, fontWeight: 700, color: c.text }}>{s.name}</Typography>
                        {s.description && <Typography sx={{ fontSize: 12.5, color: c.text3, mt: 0.25 }}>{s.description}</Typography>}
                        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75 }}>
                          <Box sx={{ fontSize: 10.5, fontWeight: 600, bgcolor: c.surface3, color: c.text2, borderRadius: 99, px: 1, py: 0.2 }}>🕐 {s.duration} דק'</Box>
                          {s.whatToAsk && <Box sx={{ fontSize: 10.5, fontWeight: 600, bgcolor: c.accentDim, color: c.accent, borderRadius: 99, px: 1, py: 0.2 }}>🤖 הוראות</Box>}
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 21, fontWeight: 800, color: c.accent, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.priceFrom ? <span style={{ fontSize: 12, fontWeight: 700 }}>{'החל מ־'}</span> : null}₪{isStaff && myPrices[s.name] !== undefined ? myPrices[s.name] : s.price}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                        <Button onClick={() => openEdit(s)} size="small" sx={{ minWidth: 32, color: c.text3, '&:hover': { color: c.accent } }}>✎</Button>
                        <Button onClick={() => remove(s.id)} size="small" sx={{ minWidth: 32, color: c.text3, '&:hover': { color: c.hot } }}>✕</Button>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </>
        )}
      </Box>

      <Dialog scroll="body" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { borderRadius: 2, p: 3.5, maxWidth: 440, width: '100%' } }}>
        <Typography sx={{ fontSize: 21, fontWeight: 800, mb: 2.5, color: c.text }}>{editId ? 'עריכת שירות' : 'שירות חדש'}</Typography>
        <TextField fullWidth label="שם השירות" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="קטגוריה (למשל: תספורות, צבע)" value={draft.category} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField label="מחיר ₪" type="number" value={draft.price} onChange={(e) => setDraft((p) => ({ ...p, price: Number(e.target.value) }))} sx={{ flex: 1 }} />
          <TextField select label="משך" value={draft.duration} onChange={(e) => setDraft((p) => ({ ...p, duration: Number(e.target.value) }))} sx={{ flex: 1 }}>
            {[15, 30, 45, 60, 90, 120, 150, 180].map((d) => <MenuItem key={d} value={d}>{d} דק'</MenuItem>)}
          </TextField>
        </Box>
        <Box onClick={() => setDraft((p) => ({ ...p, priceFrom: !p.priceFrom }))} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.25, mb: 2, mt: -0.5 }}>
          <Box sx={{ width: 20, height: 20, borderRadius: 1, border: `2px solid ${draft.priceFrom ? c.accent : c.border2}`, bgcolor: draft.priceFrom ? c.accent : 'transparent', color: '#fff', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>{draft.priceFrom ? '✓' : ''}</Box>
          <Typography sx={{ fontSize: 13.5, color: c.text2, fontWeight: 600 }}>{'מחיר משתנה — יוצג ללקוחות כ"החל מ־₪' + (draft.price || 0) + '"'}</Typography>
        </Box>
        <TextField fullWidth label="תיאור (אופציונלי)" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} sx={{ mb: 2 }} multiline rows={2} />
        <TextField fullWidth label="מה דנה צריכה לשאול?" placeholder="למשל: גבר/אישה, אורך שיער" value={draft.whatToAsk} onChange={(e) => setDraft((p) => ({ ...p, whatToAsk: e.target.value }))} sx={{ mb: 3 }} multiline rows={2} helperText="🤖 דנה תשאל את זה לפני קביעת התור" />
        <Button onClick={save} variant="contained" fullWidth disabled={!draft.name || saving} sx={{ borderRadius: 1.5, fontWeight: 700, py: 1.5 }}>
          {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : editId ? 'שמור' : 'הוסף למחירון'}
        </Button>
      </Dialog>
    </Box>
  );
}
