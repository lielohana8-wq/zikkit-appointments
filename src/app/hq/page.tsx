'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress, TextField } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/Toast';
import { zikkitColors as c } from '@/styles/theme';

// Owner allowlist (client-side gate; server enforces the real check).
const HQ_OWNERS = ['ohanaliel@gmail.com'];

type Tab = 'overview' | 'businesses' | 'leads' | 'revenue' | 'system';

interface Stats {
  totalBusinesses: number; active7: number; active30: number; payingCount: number;
  mrr: number; totalBookings: number; planBreakdown: Record<string, number>;
  growthByMonth: Record<string, number>; recentPayments: Array<{ biz: string; type: string; paidAt: string }>;
}
interface Biz {
  bookings7?: number; upcoming?: number; cancelledCount?: number; revenueMonth?: number;
  customersCount?: number; teamCount?: number; servicesCount?: number; smsOk?: number; smsFail?: number;
  galleryCount?: number; hasLogo?: boolean; hasBanner?: boolean; otpOn?: boolean; peakOn?: boolean; theme?: string;
  id: string; name: string; ownerEmail: string; createdAt: string; plan: string;
  subStatus: string; bookingsCount: number; bookingEnabled: boolean; suspended: boolean;
  lastActivity: string; daysSinceActive: number | null; danaOn: boolean;
}
interface SystemSvc { key: string; label: string; configured: boolean; critical: boolean; note: string; }

export default function HQPage() {
  const router = useRouter();
  const { firebaseUser, loading } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [system, setSystem] = useState<{ services: SystemSvc[]; growEnv: string; ownerEmails: string } | null>(null);
  const [leads, setLeads] = useState<Array<Record<string, string>>>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [planPrices, setPlanPrices] = useState<Record<string, number>>({});
  const [pricesBusy, setPricesBusy] = useState(false);
  useEffect(() => { fetch('/api/platform/plans').then((r) => r.json()).then((d) => setPlanPrices(d.plans || {})).catch(() => {}); }, []);
  const savePrices = async () => {
    setPricesBusy(true);
    try {
      const res = await fetch('/api/platform/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: firebaseUser?.email, plans: planPrices }) });
      const d = await res.json();
      if (d.ok) { setPlanPrices(d.plans); showToast('המחירים עודכנו — חיים באוויר', 'success'); }
      else showToast('שמירה נכשלה', 'error');
    } catch { showToast('שגיאת רשת', 'error'); }
    finally { setPricesBusy(false); }
  };
  const [bizSearch, setBizSearch] = useState('');
  const [bizFilter, setBizFilter] = useState<'all' | 'paying' | 'active' | 'churned'>('all');
  const [busyId, setBusyId] = useState('');

  const email = firebaseUser?.email || '';
  const isOwner = HQ_OWNERS.includes(email.toLowerCase());

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const loadAll = useCallback(async () => {
    if (!email) return;
    const q = `email=${encodeURIComponent(email)}`;
    try {
      const [s, b, sys, ld] = await Promise.all([
        fetch(`/api/hq/stats?${q}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/hq/businesses?${q}`).then((r) => r.json()).catch(() => ({ businesses: [] })),
        fetch(`/api/hq/system?${q}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/pilot-requests?${q}`).then((r) => r.json()).catch(() => ({ requests: [] })),
      ]);
      if (s && !s.error) setStats(s);
      setBusinesses(b.businesses || []);
      if (sys && !sys.error) setSystem(sys);
      setLeads(ld.requests || []);
    } finally { setDataLoading(false); }
  }, [email]);

  useEffect(() => { if (isOwner) loadAll(); else if (!loading) setDataLoading(false); }, [isOwner, loading, loadAll]);

  const bizAction = async (bizId: string, action: string, plan?: string) => {
    setBusyId(bizId);
    try {
      const res = await fetch('/api/hq/businesses', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, bizId, action, plan }),
      });
      const d = await res.json();
      if (d.success) {
        showToast(action === 'suspend' ? 'העסק הושהה' : action === 'activate' ? 'העסק הופעל' : 'התוכנית עודכנה', 'success');
        setBusinesses((prev) => prev.map((b) => b.id === bizId
          ? { ...b, suspended: action === 'suspend' ? true : action === 'activate' ? false : b.suspended, plan: action === 'setPlan' ? (plan || 'base') : b.plan, subStatus: action === 'setPlan' ? 'active' : b.subStatus }
          : b));
      } else showToast(d.error || 'שגיאה', 'error');
    } catch (e) { showToast((e as Error).message, 'error'); } finally { setBusyId(''); }
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  if (!isOwner) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg, p: 3, textAlign: 'center' }}>
        <Box sx={{ fontSize: 44, mb: 2, opacity: 0.4 }}>🔒</Box>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: c.text, mb: 1 }}>HQ — גישה למנהל הפלטפורמה בלבד</Typography>
        <Typography sx={{ fontSize: 14, color: c.text3, maxWidth: 300 }}>האזור הזה שמור לצוות Zikkit.</Typography>
        <Button onClick={() => router.push('/dashboard')} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, mt: 3 }}>חזרה לדאשבורד</Button>
      </Box>
    );
  }

  const filteredBiz = businesses.filter((b) => {
    if (bizSearch && !b.name.includes(bizSearch) && !b.ownerEmail.includes(bizSearch)) return false;
    if (bizFilter === 'paying') return Boolean(b.plan);
    if (bizFilter === 'active') return b.daysSinceActive !== null && b.daysSinceActive <= 30;
    if (bizFilter === 'churned') return b.daysSinceActive !== null && b.daysSinceActive > 30;
    return true;
  });

  const newLeads = leads.filter((l) => l.status === 'new').length;

  const tabs: [Tab, string, string][] = [
    ['overview', '📊', 'סקירה'],
    ['businesses', '🏢', 'עסקים'],
    ['leads', '📨', 'לידים'],
    ['revenue', '💰', 'הכנסות'],
    ['system', '⚙️', 'מערכת'],
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      {/* Header */}
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 20 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ bgcolor: c.text, color: c.bg, fontSize: 12, fontWeight: 900, borderRadius: 1, px: 1, py: 0.4, letterSpacing: '0.05em' }}>HQ</Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text }}>מרכז שליטה</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button onClick={loadAll} sx={{ color: c.text3, fontWeight: 600, minWidth: 'auto' }}>↻</Button>
          <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600, fontSize: 13 }}>יציאה</Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: `1px solid ${c.border2}`, px: { xs: 1, sm: 4 }, display: 'flex', gap: 0.5, overflowX: 'auto', bgcolor: c.surface1, position: 'sticky', top: 57, zIndex: 19 }}>
        {tabs.map(([t, icon, label]) => (
          <Box key={t} onClick={() => setTab(t)} sx={{ cursor: 'pointer', px: 2, py: 1.5, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', color: tab === t ? c.accent : c.text3, borderBottom: `2px solid ${tab === t ? c.accent : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <span>{icon}</span>{label}
            {t === 'leads' && newLeads > 0 && <Box sx={{ bgcolor: c.hot, color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 99, px: 0.75, py: 0.1, ml: 0.25 }}>{newLeads}</Box>}
          </Box>
        ))}
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 2, sm: 4 }, py: 3 }}>

        {/* ===== OVERVIEW ===== */}
        {tab === 'overview' && stats && (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5, mb: 3 }}>
              {[
                { label: 'עסקים', value: stats.totalBusinesses, accent: true },
                { label: 'משלמים', value: stats.payingCount },
                { label: 'MRR', value: `₪${stats.mrr.toLocaleString()}` },
                { label: 'תורים סה"כ', value: stats.totalBookings.toLocaleString() },
                { label: 'פעילים 7 ימים', value: stats.active7 },
                { label: 'פעילים 30 יום', value: stats.active30 },
                { label: 'לידים חדשים', value: newLeads },
                { label: 'ARR צפוי', value: `₪${(stats.mrr * 12).toLocaleString()}` },
              ].map((s, i) => (
                <Box key={i} sx={{ bgcolor: s.accent ? c.accent : c.surface1, border: `1px solid ${s.accent ? c.accent : c.border2}`, borderRadius: 2, p: 2 }}>
                  <Typography sx={{ fontSize: 28, fontWeight: 900, color: s.accent ? '#fff' : c.text, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: s.accent ? 'rgba(255,255,255,0.85)' : c.text3, mt: 0.75, fontWeight: 700 }}>{s.label}</Typography>
                </Box>
              ))}
            </Box>

            {/* Needs attention */}
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text, mb: 1.5 }}>⚠️ צריך תשומת לב</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {businesses.filter((b) => b.daysSinceActive !== null && b.daysSinceActive > 14).slice(0, 5).map((b) => (
                <Box key={b.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: c.surface2, borderRadius: 1.5, px: 2, py: 1.25 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>{b.name}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: c.hot, fontWeight: 600 }}>לא פעיל {b.daysSinceActive} ימים</Typography>
                </Box>
              ))}
              {businesses.filter((b) => b.daysSinceActive !== null && b.daysSinceActive > 14).length === 0 && (
                <Typography sx={{ fontSize: 13, color: c.text3 }}>הכל נראה טוב — אין עסקים שנטשו 👍</Typography>
              )}
            </Box>
          </>
        )}

        {/* ===== BUSINESSES ===== */}
        {tab === 'businesses' && (
          <>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2, mb: 2 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: c.text, mb: 1.25 }}>💳 תמחור מנויים (חי — בלי דיפלוי)</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {([['founder', '⭐ מייסדים'], ['base', 'Base'], ['dana', 'דנה AI']] as const).map(([k, lb]) => (
              <TextField key={k} size="small" type="number" label={`${lb} ₪/חודש`} value={planPrices[k] ?? ''} onChange={(e) => setPlanPrices((pp) => ({ ...pp, [k]: Number(e.target.value) }))} sx={{ width: 150 }} />
            ))}
            <Button onClick={savePrices} disabled={pricesBusy} variant="contained" sx={{ bgcolor: c.accent, fontWeight: 800, borderRadius: 2 }}>{pricesBusy ? '...' : 'שמור מחירים'}</Button>
          </Box>
          <Typography sx={{ fontSize: 11.5, color: c.text3, mt: 1 }}>המחירים נכנסים לתוקף מיידית בעמוד המנויים ובתשלום עצמו</Typography>
        </Box>

              <TextField size="small" placeholder="חיפוש עסק / אימייל" value={bizSearch} onChange={(e) => setBizSearch(e.target.value)} sx={{ flex: 1, minWidth: 180 }} />
              <Box sx={{ display: 'flex', gap: 0.5, bgcolor: c.surface3, p: 0.5, borderRadius: 99 }}>
                {([['all', 'הכל'], ['paying', 'משלמים'], ['active', 'פעילים'], ['churned', 'נטשו']] as [typeof bizFilter, string][]).map(([f, label]) => (
                  <Button key={f} onClick={() => setBizFilter(f)} sx={{ borderRadius: 99, fontWeight: 600, fontSize: 12.5, px: 1.5, py: 0.4, minWidth: 'auto', bgcolor: bizFilter === f ? c.surface1 : 'transparent', color: bizFilter === f ? c.text : c.text3 }}>{label}</Button>
                ))}
              </Box>
            </Box>

            <Typography sx={{ fontSize: 12.5, color: c.text3, mb: 1.5 }}>{filteredBiz.length} עסקים</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filteredBiz.map((b) => (
                <Box key={b.id} sx={{ bgcolor: c.surface1, border: `1px solid ${b.suspended ? c.hot : c.border2}`, borderRadius: 2, p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text }}>{b.name}</Typography>
                        {b.plan && <Box sx={{ fontSize: 10, fontWeight: 800, color: '#fff', bgcolor: b.plan === 'dana' ? c.accent : c.green, borderRadius: 99, px: 0.9, py: 0.15 }}>{b.plan === 'dana' ? 'דנה' : 'Base'}</Box>}
                        {b.suspended && <Box sx={{ fontSize: 10, fontWeight: 800, color: '#fff', bgcolor: c.hot, borderRadius: 99, px: 0.9, py: 0.15 }}>מושהה</Box>}
                        {b.danaOn && <Box sx={{ fontSize: 12 }}>🎙️</Box>}
                      </Box>
                      <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{b.ownerEmail || 'ללא אימייל'} · {b.bookingsCount} תורים · {b.daysSinceActive !== null ? `פעיל לפני ${b.daysSinceActive} ימים` : 'ללא פעילות'}</Typography>
                    </Box>
                  </Box>
                  {/* Pilot picture */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75, mb: 1.25 }}>
                    {([
                      ['📅 שבוע', b.bookings7 ?? 0],
                      ['⏳ קרובים', b.upcoming ?? 0],
                      ['❌ ביטולים', b.cancelledCount ?? 0],
                      ['₪ החודש', b.revenueMonth ?? 0],
                      ['👥 לקוחות', b.customersCount ?? 0],
                      ['✂️ צוות', b.teamCount ?? 0],
                      ['📋 שירותים', b.servicesCount ?? 0],
                      ['🖼 גלריה', b.galleryCount ?? 0],
                    ] as Array<[string, number]>).map(([lb, v]) => (
                      <Box key={lb} sx={{ bgcolor: c.surface2, borderRadius: 1.5, px: 1, py: 0.6, textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 900, color: c.text, lineHeight: 1.1 }}>{v}</Typography>
                        <Typography sx={{ fontSize: 10, color: c.text3 }}>{lb}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.25 }}>
                    <Box sx={{ fontSize: 10.5, fontWeight: 700, borderRadius: 99, px: 1, py: 0.25, bgcolor: (b.smsFail ?? 0) > 0 ? c.hotDim : c.surface2, color: (b.smsFail ?? 0) > 0 ? c.hot : c.text3 }}>📨 SMS: {b.smsOk ?? 0}✓ {b.smsFail ?? 0}✗</Box>
                    <Box sx={{ fontSize: 10.5, fontWeight: 700, borderRadius: 99, px: 1, py: 0.25, bgcolor: c.surface2, color: c.text3 }}>{b.hasLogo ? '🎨 לוגו ✓' : '🎨 חסר לוגו'}</Box>
                    <Box sx={{ fontSize: 10.5, fontWeight: 700, borderRadius: 99, px: 1, py: 0.25, bgcolor: c.surface2, color: c.text3 }}>{b.hasBanner ? '🖼 באנר ✓' : '🖼 חסר באנר'}</Box>
                    {b.otpOn && <Box sx={{ fontSize: 10.5, fontWeight: 700, borderRadius: 99, px: 1, py: 0.25, bgcolor: c.surface2, color: c.text3 }}>🔐 OTP</Box>}
                    {b.peakOn && <Box sx={{ fontSize: 10.5, fontWeight: 700, borderRadius: 99, px: 1, py: 0.25, bgcolor: c.surface2, color: c.text3 }}>💰 שעות שיא</Box>}
                    <Box sx={{ fontSize: 10.5, fontWeight: 700, borderRadius: 99, px: 1, py: 0.25, bgcolor: c.surface2, color: c.text3 }}>🎭 {b.theme || 'dark'}</Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    <Button href={`/book/${b.id}`} target="_blank" size="small" variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12 }}>👁 דף הזמנות</Button>
                    {!b.plan && <Button onClick={() => bizAction(b.id, 'setPlan', 'base')} disabled={busyId === b.id} size="small" variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12, color: c.green, borderColor: c.border2 }}>הענק Base</Button>}
                    {!b.plan && <Button onClick={() => bizAction(b.id, 'setPlan', 'dana')} disabled={busyId === b.id} size="small" variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12, color: c.accent, borderColor: c.border2 }}>הענק דנה</Button>}
                    {b.suspended
                      ? <Button onClick={() => bizAction(b.id, 'activate')} disabled={busyId === b.id} size="small" variant="contained" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12, bgcolor: c.green }}>הפעל</Button>
                      : <Button onClick={() => bizAction(b.id, 'suspend')} disabled={busyId === b.id} size="small" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12, color: c.hot }}>השהה</Button>}
                  </Box>
                </Box>
              ))}
              {filteredBiz.length === 0 && <Typography sx={{ color: c.text3, textAlign: 'center', py: 5 }}>אין עסקים להצגה</Typography>}
            </Box>
          </>
        )}

        {/* ===== LEADS ===== */}
        {tab === 'leads' && (
          <>
            <Typography sx={{ fontSize: 12.5, color: c.text3, mb: 1.5 }}>{leads.length} בקשות · {newLeads} חדשות</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {leads.map((l, i) => (
                <Box key={i} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text }}>{l.name}</Typography>
                    <Box sx={{ fontSize: 10, fontWeight: 800, color: '#fff', bgcolor: l.status === 'new' ? c.accent : l.status === 'approved' ? c.green : c.text3, borderRadius: 99, px: 1, py: 0.2 }}>{l.status === 'new' ? 'חדש' : l.status === 'approved' ? 'אושר' : 'נדחה'}</Box>
                  </Box>
                  <Typography sx={{ fontSize: 13, color: c.text2 }}>{[l.bizName, l.bizType].filter(Boolean).join(' · ')}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
                    <Button href={`tel:${l.phone}`} size="small" variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12 }}>📞 {l.phone}</Button>
                    <Button href={`https://wa.me/972${(l.phone || '').replace(/^0/, '')}`} target="_blank" size="small" variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 12, color: c.green, borderColor: c.border2 }}>💬 וואטסאפ</Button>
                  </Box>
                </Box>
              ))}
              {leads.length === 0 && <Typography sx={{ color: c.text3, textAlign: 'center', py: 5 }}>אין בקשות פיילוט</Typography>}
            </Box>
          </>
        )}

        {/* ===== REVENUE ===== */}
        {tab === 'revenue' && stats && (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mb: 3 }}>
              <Box sx={{ bgcolor: c.accent, borderRadius: 2, p: 2.5 }}>
                <Typography sx={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>₪{stats.mrr.toLocaleString()}</Typography>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', mt: 1, fontWeight: 700 }}>MRR — הכנסה חודשית חוזרת</Typography>
              </Box>
              <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.5 }}>
                <Typography sx={{ fontSize: 36, fontWeight: 900, color: c.text, letterSpacing: '-0.03em', lineHeight: 1 }}>₪{(stats.mrr * 12).toLocaleString()}</Typography>
                <Typography sx={{ fontSize: 12, color: c.text3, mt: 1, fontWeight: 700 }}>ARR — הכנסה שנתית צפויה</Typography>
              </Box>
              <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.5 }}>
                <Typography sx={{ fontSize: 36, fontWeight: 900, color: c.text, letterSpacing: '-0.03em', lineHeight: 1 }}>₪{stats.payingCount > 0 ? Math.round(stats.mrr / stats.payingCount) : 0}</Typography>
                <Typography sx={{ fontSize: 12, color: c.text3, mt: 1, fontWeight: 700 }}>ARPU — הכנסה ממוצעת לעסק</Typography>
              </Box>
            </Box>

            <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text, mb: 1.5 }}>פילוח תוכניות</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
              {[['dana', 'דנה AI · ₪349', c.accent], ['base', 'Base · ₪149', c.green], ['none', 'פיילוט/חינם', c.text3]].map(([k, label, col]) => (
                <Box key={k} sx={{ flex: 1, bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 28, fontWeight: 900, color: col as string, letterSpacing: '-0.03em' }}>{stats.planBreakdown[k as string] || 0}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: c.text3, mt: 0.5, fontWeight: 600 }}>{label}</Typography>
                </Box>
              ))}
            </Box>

            <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text, mb: 1.5 }}>תשלומים אחרונים</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {stats.recentPayments.map((p, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: c.surface2, borderRadius: 1.5, px: 2, py: 1 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: c.text }}>{p.biz}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{p.type} · {p.paidAt ? new Date(p.paidAt).toLocaleDateString('he-IL') : ''}</Typography>
                </Box>
              ))}
              {stats.recentPayments.length === 0 && <Typography sx={{ fontSize: 13, color: c.text3 }}>אין תשלומים עדיין</Typography>}
            </Box>
          </>
        )}

        {/* ===== SYSTEM ===== */}
        {tab === 'system' && system && (
          <>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text, mb: 0.5 }}>בריאות מפתחות ואינטגרציות</Typography>
            <Typography sx={{ fontSize: 12.5, color: c.text3, mb: 2 }}>סביבת Grow: <b>{system.growEnv}</b> · המפתחות מנוהלים ב-Vercel (מסיבות אבטחה לא מוצגים כאן)</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {system.services.map((s) => (
                <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2 }}>
                  <Box sx={{ fontSize: 22 }}>{s.configured ? '✅' : s.critical ? '🔴' : '⚪'}</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: c.text }}>{s.label}{s.critical && !s.configured && <Box component="span" sx={{ color: c.hot, fontSize: 12, mr: 0.5 }}> · קריטי!</Box>}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{s.note}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: s.configured ? c.green : c.text3 }}>{s.configured ? 'מחובר' : 'לא מוגדר'}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 3, p: 2, bgcolor: c.surface2, borderRadius: 2 }}>
              <Typography sx={{ fontSize: 12.5, color: c.text3, lineHeight: 1.6 }}>💡 להוספת/שינוי מפתחות: Vercel → Settings → Environment Variables → Redeploy. מנהלי HQ: {system.ownerEmails}</Typography>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
