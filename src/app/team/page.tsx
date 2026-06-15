'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, Dialog, TextField, Chip, Slider, Switch } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getTeam, addTeamMember, updateTeamMember, deleteTeamMember, loadBiz, setStations, type TeamMember } from '@/lib/bizdata';
import { useToast } from '@/components/Toast';
import { createStaffAccount } from '@/lib/staff';
import { zikkitColors as c } from '@/styles/theme';

const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const COLORS = ['#9333EA', '#EC4899', '#06B6D4', '#F59E0B', '#10B981', '#6366F1', '#EF4444', '#8B5CF6'];

interface Draft {
  name: string; role: string; photo: string; description: string;
  services: string[]; station: number | null; color: string;
  loginEmail: string; loginPassword: string; createLogin: boolean;
}

const emptyDraft: Draft = { name: '', role: '', photo: '', description: '', services: [], station: null, color: COLORS[0], loginEmail: '', loginPassword: '', createLogin: false };

export default function TeamPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const { showToast } = useToast();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [stations, setStationsState] = useState(1);
  const [dataLoading, setDataLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const biz = await loadBiz(bizId);
      setTeam(((biz as Record<string, unknown>).team as { members?: TeamMember[] })?.members || []);
      const svcs = (biz.dana?.services as Array<{ name: string }>) || [];
      setAvailableServices(svcs.map((s) => s.name));
      setStationsState(biz.appointments?.stations || 1);
    } finally { setDataLoading(false); }
  }, [bizId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setDraft(emptyDraft); setEditId(null); setOpen(true); };
  const openEdit = (m: TeamMember) => {
    setDraft({ name: m.name, role: m.role, photo: m.photo, description: m.description, services: m.services, station: m.station, color: m.color, loginEmail: m.loginEmail || '', loginPassword: '', createLogin: false });
    setEditId(m.id); setOpen(true);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 300;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx?.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        setDraft((p) => ({ ...p, photo: canvas.toDataURL('image/jpeg', 0.75) }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!bizId || !draft.name) return;
    setSaving(true);
    try {
      const { createLogin, loginPassword, ...memberData } = draft;
      let memberId = editId;
      if (editId) {
        await updateTeamMember(bizId, editId, memberData);
      } else {
        // Create the team member first to get an id
        memberId = await addTeamMember(bizId, memberData);
      }
      // If owner asked to create a login for this member
      if (createLogin && draft.loginEmail && loginPassword) {
        if (loginPassword.length < 6) {
          showToast('הסיסמה חייבת להיות לפחות 6 תווים', 'error');
          setSaving(false);
          return;
        }
        // Find the member id (just created or being edited)
        const members = await getTeam(bizId);
        const member = memberId
          ? members.find((m) => m.id === memberId)
          : members.find((m) => m.name === draft.name && m.loginEmail === draft.loginEmail);
        if (member) {
          const result = await createStaffAccount({
            ownerBizId: bizId,
            staffId: member.id,
            staffName: member.name,
            email: draft.loginEmail,
            password: loginPassword,
          });
          if (!result.success) {
            showToast('חבר הצוות נשמר, אבל יצירת ההתחברות נכשלה:\n' + result.error, 'error');
          } else {
            await updateTeamMember(bizId, member.id, { loginEmail: draft.loginEmail, staffUid: result.uid });
            showToast('חשבון נוצר! חבר הצוות יכול להתחבר עם: ' + draft.loginEmail, 'success');
          }
        } else {
          showToast('שגיאה: לא נמצא חבר הצוות אחרי השמירה. נסה שוב.', 'error');
        }
      }
      setOpen(false); await load();
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!bizId) return;
    await deleteTeamMember(bizId, id);
    await load();
  };

  const updateStationCount = async (n: number) => {
    setStationsState(n);
    if (bizId) await setStations(bizId, n);
  };

  const toggleService = (svc: string) => {
    setDraft((p) => ({ ...p, services: p.services.includes(svc) ? p.services.filter((s) => s !== svc) : [...p.services, svc] }));
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>צוות ועמדות</Typography>
        <Button onClick={openNew} variant="contained" sx={{ borderRadius: 99, fontWeight: 700 }}>+ חבר צוות</Button>
      </Box>

      <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {/* Stations count */}
        <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 4, boxShadow: c.shadowSm, p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>💺 מספר עמדות / כיסאות</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: c.accent }}>{stations}</Typography>
          </Box>
          <Slider value={stations} onChange={(_, v) => updateStationCount(v as number)} min={1} max={15} step={1} marks sx={{ color: c.accent }} />
          <Typography sx={{ fontSize: 12, color: c.text3 }}>דנה תקבע עד {stations} תורים במקביל</Typography>
        </Box>

        {/* Team members */}
        <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text, mb: 2 }}>חברי הצוות ({team.length})</Typography>
        {team.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Box sx={{ fontSize: 48, mb: 2 }}>🧑‍🤝‍🧑</Box>
            <Typography sx={{ color: c.text2, mb: 1, fontWeight: 700 }}>עדיין אין חברי צוות</Typography>
            <Typography sx={{ color: c.text3, fontSize: 14, mb: 3 }}>הוסף ספרים, מטפלות, או כל חבר צוות</Typography>
            <Button onClick={openNew} variant="contained" sx={{ borderRadius: 3, fontWeight: 700 }}>הוסף את הראשון</Button>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {team.map((m) => (
              <Box key={m.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 4, p: 2.5, boxShadow: c.shadowSm, transition: 'all 0.2s', '&:hover': { boxShadow: c.shadowMd, transform: 'translateY(-2px)' } }}>
                <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                  {m.photo ? (
                    <Box component="img" src={m.photo} sx={{ width: 58, height: 58, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${m.color}` }} />
                  ) : (
                    <Box sx={{ width: 58, height: 58, borderRadius: '50%', background: `linear-gradient(135deg, ${m.color}, ${m.color}bb)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800 }}>{m.name[0]}</Box>
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text }}>{m.name}</Typography>
                    <Typography sx={{ fontSize: 13, color: c.text3 }}>{m.role}</Typography>
                    {m.station && <Box sx={{ display: 'inline-block', mt: 0.5, fontSize: 10, fontWeight: 600, bgcolor: c.accentDim, color: c.accent, borderRadius: 99, px: 1, py: 0.2 }}>עמדה {m.station}</Box>}
                  </Box>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: m.color, flexShrink: 0 }} />
                </Box>
                {m.description && <Typography sx={{ fontSize: 12, color: c.text3, mb: 1, lineHeight: 1.5 }}>{m.description}</Typography>}
                {m.services.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                    {m.services.slice(0, 4).map((s) => <Chip key={s} label={s} size="small" sx={{ bgcolor: c.surface3, color: c.text2, fontSize: 10 }} />)}
                    {m.services.length > 4 && <Chip label={`+${m.services.length - 4}`} size="small" sx={{ bgcolor: c.surface3, fontSize: 10 }} />}
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button onClick={() => openEdit(m)} size="small" sx={{ flex: 1, borderRadius: 2, bgcolor: c.surface2, color: c.text, fontWeight: 600 }}>ערוך</Button>
                  <Button onClick={() => remove(m.id)} size="small" sx={{ color: c.hot, minWidth: 'auto' }}>✕</Button>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Add/Edit dialog */}
      <Dialog scroll="body" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { borderRadius: 5, p: 3.5, maxWidth: 440, width: '100%' } }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2, color: c.text }}>{editId ? 'עריכת חבר צוות' : 'חבר צוות חדש'}</Typography>

        {/* Photo */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box component="label" sx={{ cursor: 'pointer', position: 'relative' }}>
            {draft.photo ? (
              <Box component="img" src={draft.photo} sx={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: c.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📷</Box>
            )}
            <Box sx={{ position: 'absolute', bottom: 0, right: 0, bgcolor: c.accent, color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>+</Box>
            <input type="file" accept="image/*" hidden onChange={handlePhoto} />
          </Box>
        </Box>

        <TextField fullWidth label="שם" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="תפקיד (למשל: ספר בכיר)" value={draft.role} onChange={(e) => setDraft((p) => ({ ...p, role: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="תיאור קצר" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} sx={{ mb: 2 }} multiline rows={2} />

        {/* Station */}
        <TextField fullWidth label="עמדה משויכת" type="number" value={draft.station ?? ''} onChange={(e) => setDraft((p) => ({ ...p, station: e.target.value ? Number(e.target.value) : null }))} sx={{ mb: 2 }} inputProps={{ min: 1, max: stations }} helperText={`1-${stations}`} />

        {/* Color */}
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.text2, mb: 1 }}>צבע ביומן</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {COLORS.map((col) => (
            <Box key={col} onClick={() => setDraft((p) => ({ ...p, color: col }))} sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: col, cursor: 'pointer', border: draft.color === col ? `3px solid ${c.text}` : '3px solid transparent' }} />
          ))}
        </Box>

        {/* Services */}
        {availableServices.length > 0 && (
          <>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.text2, mb: 1 }}>שירותים שנותן</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 3 }}>
              {availableServices.map((svc) => (
                <Chip key={svc} label={svc} onClick={() => toggleService(svc)} sx={{ cursor: 'pointer', bgcolor: draft.services.includes(svc) ? c.accent : c.surface3, color: draft.services.includes(svc) ? '#fff' : c.text2, fontWeight: 600 }} />
              ))}
            </Box>
          </>
        )}

        {/* Staff login credentials */}
        <Box sx={{ bgcolor: c.surface2, borderRadius: 3, p: 2, mb: 3, mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: draft.createLogin ? 1.5 : 0 }}>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>🔑 התחברות לחבר הצוות</Typography>
              <Typography sx={{ fontSize: 12, color: c.text3 }}>{draft.loginEmail && editId ? `מחובר: ${draft.loginEmail}` : 'תן לו גישה לתורים שלו'}</Typography>
            </Box>
            <Switch checked={draft.createLogin} onChange={(e) => setDraft((p) => ({ ...p, createLogin: e.target.checked }))} />
          </Box>
          {draft.createLogin && (
            <>
              <TextField fullWidth label="אימייל להתחברות" type="email" value={draft.loginEmail} onChange={(e) => setDraft((p) => ({ ...p, loginEmail: e.target.value }))} sx={{ mb: 1.5, mt: 1 }} size="small" />
              <TextField fullWidth label="סיסמה (לפחות 6 תווים)" type="text" value={draft.loginPassword} onChange={(e) => setDraft((p) => ({ ...p, loginPassword: e.target.value }))} size="small" helperText="חבר הצוות יתחבר עם הפרטים האלה ויראה רק את התורים שלו" />
            </>
          )}
        </Box>

        <Button onClick={save} variant="contained" fullWidth disabled={!draft.name || saving} sx={{ borderRadius: 3, fontWeight: 800, py: 1.5 }}>
          {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : editId ? 'שמור שינויים' : 'הוסף לצוות'}
        </Button>
      </Dialog>
    </Box>
  );
}
