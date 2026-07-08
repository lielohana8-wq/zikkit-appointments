'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog, TextField, MenuItem, Switch } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getPromos, addPromo, updatePromo, deletePromo, getLoyalty, saveLoyalty, type Promo, type LoyaltySettings } from '@/lib/bizdata';
import { useToast } from '@/components/Toast';
import { zikkitColors as c } from '@/styles/theme';

export default function PromosPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const { showToast } = useToast();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySettings | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ code: '', description: '', discountType: 'percent' as 'percent' | 'fixed', discountValue: 10, expiresAt: '', maxUsage: 0 });

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try { setPromos(await getPromos(bizId)); setLoyalty(await getLoyalty(bizId)); } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!bizId || !draft.code) return;
    setSaving(true);
    try { await addPromo(bizId, draft); setOpen(false); setDraft({ code: '', description: '', discountType: 'percent', discountValue: 10, expiresAt: '', maxUsage: 0 }); await load(); showToast('הקופון נוצר', 'success'); }
    catch (e) { showToast('שגיאה: ' + (e as Error).message, 'error'); }
    finally { setSaving(false); }
  };

  const saveLoyaltySettings = async (next: LoyaltySettings) => {
    if (!bizId) return;
    setLoyalty(next);
    await saveLoyalty(bizId, next);
  };

  if (loading || dataLoading || !loyalty) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>מבצעים ונאמנות</Typography>
        <Button onClick={() => setOpen(true)} variant="contained" sx={{ borderRadius: 99, fontWeight: 700, px: 2.5 }}>+ קופון</Button>
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 680, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {/* Loyalty program */}
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>תוכנית נאמנות</Typography>
        <Box sx={{ bgcolor: loyalty.enabled ? `linear-gradient(135deg, ${c.accent}, ${c.accentDeep})` : c.surface1, background: loyalty.enabled ? `linear-gradient(135deg, ${c.accent}, ${c.accentDeep})` : c.surface1, border: `1px solid ${loyalty.enabled ? 'transparent' : c.border}`, borderRadius: 2, p: 3, mb: 4, color: loyalty.enabled ? '#fff' : c.text }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: loyalty.enabled ? 2.5 : 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ fontSize: 26 }}>🎁</Box>
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 800 }}>כרטיסיית נאמנות</Typography>
                <Typography sx={{ fontSize: 12.5, opacity: loyalty.enabled ? 0.85 : 1, color: loyalty.enabled ? '#fff' : c.text3 }}>תגמל לקוחות חוזרים</Typography>
              </Box>
            </Box>
            <Switch checked={loyalty.enabled} onChange={(e) => saveLoyaltySettings({ ...loyalty, enabled: e.target.checked })} sx={loyalty.enabled ? { '& .MuiSwitch-track': { bgcolor: 'rgba(255,255,255,0.3) !important' } } : {}} />
          </Box>
          {loyalty.enabled && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 1.5, p: 2, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 14 }}>כל <strong style={{ fontSize: 22 }}>{loyalty.visitsForReward}</strong> ביקורים → {loyalty.rewardDescription}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField type="number" label="ביקורים להטבה" value={loyalty.visitsForReward} onChange={(e) => saveLoyaltySettings({ ...loyalty, visitsForReward: Number(e.target.value) })} size="small" sx={{ flex: 1, bgcolor: '#fff', borderRadius: 2 }} />
                <TextField label="ההטבה" value={loyalty.rewardDescription} onChange={(e) => saveLoyaltySettings({ ...loyalty, rewardDescription: e.target.value })} size="small" sx={{ flex: 2, bgcolor: '#fff', borderRadius: 2 }} />
              </Box>
            </Box>
          )}
        </Box>

        {/* Coupons */}
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text3, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>קופונים</Typography>
        {promos.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <Box sx={{ fontSize: 36, mb: 1, opacity: 0.5 }}>🎟️</Box>
            <Typography sx={{ color: c.text3, fontSize: 14, mb: 2 }}>אין קופונים עדיין</Typography>
            <Button onClick={() => setOpen(true)} variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 600 }}>+ צור קופון ראשון</Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {promos.map((p) => {
              const expired = p.expiresAt && p.expiresAt < new Date().toISOString().split('T')[0];
              return (
                <Box key={p.id} sx={{ bgcolor: c.surface1, border: `1px dashed ${p.active && !expired ? c.accent : c.border2}`, borderRadius: 2, p: 2.5, opacity: p.active && !expired ? 1 : 0.6 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ bgcolor: c.accentDim, color: c.accent, borderRadius: 2.5, px: 2, py: 1.25, fontWeight: 800, fontSize: 16, letterSpacing: '0.05em', fontFamily: 'monospace' }}>{p.code}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 18, fontWeight: 800, color: c.text }}>{p.discountType === 'percent' ? `${p.discountValue}% הנחה` : `₪${p.discountValue} הנחה`}</Typography>
                      <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{p.description || 'ללא תיאור'}{expired ? ' · פג תוקף' : p.expiresAt ? ` · עד ${p.expiresAt}` : ''}</Typography>
                    </Box>
                    <Switch checked={p.active} onChange={async () => { if (bizId) { await updatePromo(bizId, p.id, { active: !p.active }); await load(); } }} size="small" />
                    <Button onClick={async () => { if (bizId) { await deletePromo(bizId, p.id); await load(); } }} size="small" sx={{ minWidth: 'auto', color: c.text3, '&:hover': { color: c.hot } }}>✕</Button>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      <Dialog scroll="body" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { borderRadius: 2, p: 3.5, maxWidth: 400, width: '100%' } }}>
        <Typography sx={{ fontSize: 21, fontWeight: 800, mb: 2.5, color: c.text }}>קופון חדש</Typography>
        <TextField fullWidth label="קוד קופון" value={draft.code} onChange={(e) => setDraft((p) => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="WELCOME10" sx={{ mb: 2 }} />
        <TextField fullWidth label="תיאור" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} placeholder="הנחת לקוח חדש" sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <TextField select label="סוג" value={draft.discountType} onChange={(e) => setDraft((p) => ({ ...p, discountType: e.target.value as 'percent' | 'fixed' }))} sx={{ flex: 1 }}>
            <MenuItem value="percent">אחוז %</MenuItem>
            <MenuItem value="fixed">סכום ₪</MenuItem>
          </TextField>
          <TextField type="number" label={draft.discountType === 'percent' ? 'אחוז' : 'סכום'} value={draft.discountValue} onChange={(e) => setDraft((p) => ({ ...p, discountValue: Number(e.target.value) }))} sx={{ flex: 1 }} />
        </Box>
        <TextField fullWidth type="date" label="תוקף (אופציונלי)" value={draft.expiresAt} onChange={(e) => setDraft((p) => ({ ...p, expiresAt: e.target.value }))} InputLabelProps={{ shrink: true }} sx={{ mb: 3 }} />
        <Button onClick={save} variant="contained" fullWidth disabled={!draft.code || saving} sx={{ borderRadius: 1.5, fontWeight: 700, py: 1.5 }}>
          {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'צור קופון'}
        </Button>
      </Dialog>
    </Box>
  );
}
