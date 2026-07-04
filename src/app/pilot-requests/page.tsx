'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/Toast';
import { zikkitColors as c } from '@/styles/theme';

interface PilotRequest {
  id: string;
  name: string;
  bizName: string;
  phone: string;
  email: string;
  bizType: string;
  note: string;
  status: string;
  inviteCode?: string;
  createdAt: string;
}

type Filter = 'all' | 'new' | 'approved' | 'rejected';

// Only the Zikkit owner can view pilot requests. These are leads for the whole
// platform — never visible to tenant business owners who log in.
const OWNER_EMAILS = ['ohanaliel@gmail.com'];

export default function PilotRequestsPage() {
  const router = useRouter();
  const { firebaseUser, loading } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<PilotRequest[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('new');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    try {
      const email = firebaseUser?.email || '';
      const res = await fetch(`/api/pilot-requests?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      setRequests(data.requests || []);
    } catch { /* ignore */ } finally { setDataLoading(false); }
  }, [firebaseUser?.email]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      const email = firebaseUser?.email || '';
      const res = await fetch('/api/pilot-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, email }),
      });
      const data = await res.json();
      if (data.success) {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status, inviteCode: data.inviteCode || r.inviteCode } : r)));
        showToast(status === 'approved' ? `אושר! קוד הזמנה: ${data.inviteCode}` : status === 'rejected' ? 'הבקשה נדחתה' : 'עודכן', 'success');
      } else showToast(data.error || 'שגיאה', 'error');
    } catch (e) { showToast((e as Error).message, 'error'); }
    finally { setBusyId(null); }
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  // Owner only — gate by email, not just role. Tenant business owners are NOT
  // staff but still must never see platform-wide pilot leads.
  const isOwner = OWNER_EMAILS.includes((firebaseUser?.email || '').toLowerCase());
  if (!isOwner) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg, p: 3, textAlign: 'center' }}>
        <Box sx={{ fontSize: 40, mb: 2, opacity: 0.4 }}>🔒</Box>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: c.text, mb: 1 }}>גישה למנהל המערכת בלבד</Typography>
        <Typography sx={{ fontSize: 14, color: c.text3, maxWidth: 280 }}>העמוד הזה זמין רק לצוות Zikkit.</Typography>
        <Button onClick={() => router.push('/dashboard')} variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 700, mt: 3 }}>חזרה לדאשבורד</Button>
      </Box>
    );
  }

  const counts = {
    all: requests.length,
    new: requests.filter((r) => r.status === 'new').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  };
  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  const statusChip = (s: string) => {
    const map: Record<string, [string, string]> = {
      new: ['חדש', c.accent], approved: ['אושר', c.green], rejected: ['נדחה', c.hot],
    };
    const [label, col] = map[s] || ['—', c.text3];
    return <Box sx={{ fontSize: 11, fontWeight: 800, color: '#fff', bgcolor: col, borderRadius: 99, px: 1.25, py: 0.25 }}>{label}</Box>;
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>בקשות פיילוט</Typography>
        <Button onClick={load} sx={{ color: c.text3, fontWeight: 600, minWidth: 'auto' }}>↻</Button>
      </Box>

      <Box sx={{ maxWidth: 680, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 3, bgcolor: c.surface3, p: 0.5, borderRadius: 99, width: 'fit-content' }}>
          {([['new', 'חדשות'], ['approved', 'אושרו'], ['rejected', 'נדחו'], ['all', 'הכל']] as [Filter, string][]).map(([f, label]) => (
            <Button key={f} onClick={() => setFilter(f)} sx={{ borderRadius: 99, fontWeight: 600, fontSize: 13, px: 2, py: 0.5, minWidth: 'auto', bgcolor: filter === f ? c.surface1 : 'transparent', color: filter === f ? c.text : c.text3, '&:hover': { bgcolor: filter === f ? c.surface1 : 'transparent' } }}>
              {label} {counts[f] > 0 && <Box component="span" sx={{ ml: 0.5, fontSize: 11, opacity: 0.7 }}>{counts[f]}</Box>}
            </Button>
          ))}
        </Box>

        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box sx={{ fontSize: 40, mb: 1.5, opacity: 0.5 }}>📨</Box>
            <Typography sx={{ color: c.text3 }}>{filter === 'new' ? 'אין בקשות חדשות' : 'אין בקשות להצגה'}</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {filtered.map((r) => (
              <Box key={r.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                  <Box>
                    <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>{r.name}</Typography>
                    <Typography sx={{ fontSize: 13.5, color: c.text2 }}>{r.bizName || '—'}{r.bizType ? ` · ${r.bizType}` : ''}</Typography>
                  </Box>
                  {statusChip(r.status)}
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: r.note ? 1.5 : 2, mt: 1.5 }}>
                  <Button href={`tel:${r.phone}`} size="small" variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12.5 }}>📞 {r.phone}</Button>
                  <Button href={`https://wa.me/972${r.phone.replace(/^0/, '')}`} target="_blank" size="small" variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12.5, color: c.green, borderColor: c.border2 }}>💬 וואטסאפ</Button>
                  {r.email && <Button href={`mailto:${r.email}`} size="small" variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12.5 }}>✉️ {r.email}</Button>}
                </Box>

                {r.note && <Box sx={{ bgcolor: c.surface2, borderRadius: 1.5, p: 1.5, mb: 2 }}><Typography sx={{ fontSize: 13, color: c.text2, lineHeight: 1.5 }}>{r.note}</Typography></Box>}

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1.5, borderTop: `1px solid ${c.border2}` }}>
                  <Typography sx={{ fontSize: 11.5, color: c.text3 }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('he-IL') : ''}</Typography>
                  {r.status === 'new' ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button onClick={() => setStatus(r.id, 'rejected')} disabled={busyId === r.id} size="small" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 13, color: c.hot, '&:hover': { bgcolor: c.hotDim } }}>דחה</Button>
                      <Button onClick={() => setStatus(r.id, 'approved')} disabled={busyId === r.id} variant="contained" size="small" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 13, bgcolor: c.green, '&:hover': { bgcolor: '#268A5A' } }}>
                        {busyId === r.id ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : '✓ אשר'}
                      </Button>
                    </Box>
                  ) : (
                    <Button onClick={() => setStatus(r.id, 'new')} disabled={busyId === r.id} size="small" sx={{ borderRadius: 1.5, fontWeight: 600, fontSize: 12.5, color: c.text3 }}>החזר לחדש</Button>
                  )}
                </Box>
                {/* Invite code for approved requests */}
                {r.status === 'approved' && r.inviteCode && (
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${c.border2}`, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Box sx={{ bgcolor: c.accentDim, borderRadius: 1.5, px: 1.5, py: 0.75, fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: c.accent, letterSpacing: '0.05em' }}>{r.inviteCode}</Box>
                    <Button onClick={() => { navigator.clipboard?.writeText(r.inviteCode || ''); showToast('הקוד הועתק', 'success'); }} size="small" sx={{ fontWeight: 700, fontSize: 12, minWidth: 'auto' }}>📋 העתק</Button>
                    <Button
                      href={`https://wa.me/972${(r.phone || '').replace(/\D/g, '').replace(/^0/, '').replace(/^972/, '')}?text=${encodeURIComponent(`שלום ${r.name?.split(' ')[0] || ''}! 🎉 אושרת לפיילוט של Zikkit!\n\nהקוד שלך: ${r.inviteCode}\n\nהיכנס ל: ${typeof window !== 'undefined' ? window.location.origin : ''}/login?register=1\nהזן את הקוד, בחר סיסמה — והעסק שלך מוכן! 💜`)}`}
                      target="_blank" size="small" variant="contained"
                      sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12, bgcolor: '#25D366', '&:hover': { bgcolor: '#1EA952' } }}
                    >💬 שלח קוד</Button>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* Note about approval */}
        <Box sx={{ mt: 3, p: 2, bgcolor: c.surface2, borderRadius: 1.5 }}>
          <Typography sx={{ fontSize: 12, color: c.text3, lineHeight: 1.6 }}>
            💡 אישור בקשה מסמן אותה כ&quot;אושר&quot; — צרו קשר עם הלקוח ופתחו לו חשבון. ניהול חשבונות מתבצע ב-Firebase Console.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
