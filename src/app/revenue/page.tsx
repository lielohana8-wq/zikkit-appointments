'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBookings, getCustomers, getHours, loadBiz, type Booking, type Customer } from '@/lib/bizdata';
import { findGaps, matchForGap, findChurning, computeRadar, avgTicket, type Gap, type ChurningCustomer } from '@/lib/revenue-engine';
import { waLink } from '@/lib/messaging';
import { zikkitColors as c } from '@/styles/theme';

type Tab = 'radar' | 'gaps' | 'winback';

export default function RevenuePage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('radar');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [hours, setHours] = useState<Record<number, { open: boolean; start: string; end: string }> | null>(null);
  const [bizName, setBizName] = useState('');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const [bks, custs, hrs, biz] = await Promise.all([
        getBookings(bizId), getCustomers(bizId), getHours(bizId), loadBiz(bizId),
      ]);
      setBookings(bks);
      setCustomers(custs);
      setHours((hrs?.days as never) || null);
      setBizName(((biz.cfg as Record<string, unknown>)?.biz_name as string) || 'העסק');
    } catch { /* ignore */ } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const ticket = avgTicket(bookings);
  const radar = computeRadar(bookings, customers, hours, ticket);
  const gaps = findGaps(bookings, hours, { days: 3, minGapMin: 30 });
  const churning = findChurning(customers, bookings);

  const dayLabel = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    const today = new Date().toISOString().split('T')[0];
    const tmw = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    if (iso === today) return 'היום';
    if (iso === tmw) return 'מחר';
    return ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][d.getDay()] + "' " + d.getDate() + '/' + (d.getMonth() + 1);
  };

  const tabs: [Tab, string, string][] = [
    ['radar', '📊', 'ראדאר'],
    ['gaps', '🔮', 'מילוי חורים'],
    ['winback', '🎯', 'החזרת לקוחות'],
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      {/* Header */}
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 20 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ fontSize: 18 }}>⚡</Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text }}>מנוע ההכנסות</Typography>
        </Box>
        <Button onClick={load} sx={{ color: c.text3, fontWeight: 600, minWidth: 'auto' }}>↻</Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: `1px solid ${c.border2}`, px: { xs: 1, sm: 4 }, display: 'flex', gap: 0.5, bgcolor: c.surface1, position: 'sticky', top: 57, zIndex: 19 }}>
        {tabs.map(([t, icon, label]) => (
          <Box key={t} onClick={() => setTab(t)} sx={{ cursor: 'pointer', px: 2, py: 1.5, fontSize: 14, fontWeight: 700, color: tab === t ? c.accent : c.text3, borderBottom: `2px solid ${tab === t ? c.accent : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <span>{icon}</span>{label}
          </Box>
        ))}
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 800, mx: 'auto', px: { xs: 2, sm: 4 }, py: 3 }}>

        {/* ===== RADAR ===== */}
        {tab === 'radar' && (
          <>
            {/* Hero: money on the table */}
            <Box sx={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accentDeep})`, borderRadius: 4, p: { xs: 3, sm: 4 }, mb: 3, color: '#fff', position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', top: -30, left: -20, width: 140, height: 140, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)' }} />
              <Typography sx={{ fontSize: 13, fontWeight: 700, opacity: 0.85, position: 'relative' }}>פוטנציאל הכנסה החודש</Typography>
              <Typography sx={{ fontSize: { xs: 44, sm: 56 }, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, position: 'relative', my: 0.5 }}>₪{(radar.potentialFromGaps + radar.churningValue).toLocaleString()}</Typography>
              <Typography sx={{ fontSize: 13.5, opacity: 0.9, position: 'relative' }}>כסף שמחכה שתאסוף אותו — מחורים ביומן ולקוחות שאפשר להחזיר</Typography>
            </Box>

            {/* Breakdown */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 3 }}>
              <Box className="zk-card" sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.5 }}>
                <Typography sx={{ fontSize: 30, fontWeight: 900, color: c.hot, letterSpacing: '-0.03em' }}>₪{radar.lostToNoShows.toLocaleString()}</Typography>
                <Typography sx={{ fontSize: 13, color: c.text2, fontWeight: 600, mt: 0.5 }}>הפסדת מ-{radar.noShowCount} ביטולים (30 יום)</Typography>
                <Typography sx={{ fontSize: 12, color: c.text3, mt: 1 }}>💡 הפעל מקדמות בדף ההזמנות כדי לעצור את זה</Typography>
              </Box>
              <Box className="zk-card" sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.5 }}>
                <Typography sx={{ fontSize: 30, fontWeight: 900, color: c.accent, letterSpacing: '-0.03em' }}>{radar.emptySlotHours} שעות</Typography>
                <Typography sx={{ fontSize: 13, color: c.text2, fontWeight: 600, mt: 0.5 }}>זמן מת ב-3 הימים הקרובים</Typography>
                <Typography sx={{ fontSize: 12, color: c.text3, mt: 1 }}>≈ ₪{radar.potentialFromGaps.toLocaleString()} · לך ל&quot;מילוי חורים&quot;</Typography>
              </Box>
            </Box>

            {/* Action nudges */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {radar.emptySlotHours > 0 && (
                <Box onClick={() => setTab('gaps')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, bgcolor: c.accentDim, borderRadius: 2.5, p: 2 }}>
                  <Box sx={{ fontSize: 24 }}>🔮</Box>
                  <Box sx={{ flex: 1 }}><Typography sx={{ fontSize: 14.5, fontWeight: 800, color: c.text }}>מלא {gaps.length} חורים ביומן</Typography><Typography sx={{ fontSize: 12.5, color: c.text3 }}>שלח הצעה ללקוחות שמתאימים — בוואטסאפ</Typography></Box>
                  <Box sx={{ color: c.accent, fontWeight: 800 }}>‹</Box>
                </Box>
              )}
              {churning.length > 0 && (
                <Box onClick={() => setTab('winback')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, bgcolor: c.accentDim, borderRadius: 2.5, p: 2 }}>
                  <Box sx={{ fontSize: 24 }}>🎯</Box>
                  <Box sx={{ flex: 1 }}><Typography sx={{ fontSize: 14.5, fontWeight: 800, color: c.text }}>החזר {churning.length} לקוחות שנעלמו</Typography><Typography sx={{ fontSize: 12.5, color: c.text3 }}>שווי משוער ₪{radar.churningValue.toLocaleString()}</Typography></Box>
                  <Box sx={{ color: c.accent, fontWeight: 800 }}>‹</Box>
                </Box>
              )}
            </Box>
          </>
        )}

        {/* ===== SMART GAPS ===== */}
        {tab === 'gaps' && (
          <>
            <Typography sx={{ fontSize: 14, color: c.text2, mb: 2, lineHeight: 1.6 }}>חורים ביומן ב-3 הימים הקרובים. לחץ &quot;הצע ללקוח&quot; כדי לשלוח הצעה מוכנה בוואטסאפ ללקוח שמתאים ו&quot;בשל&quot; לתור.</Typography>
            {gaps.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Box sx={{ fontSize: 40, mb: 1.5 }}>🎉</Box>
                <Typography sx={{ fontWeight: 700, color: c.text }}>היומן שלך מלא!</Typography>
                <Typography sx={{ fontSize: 13, color: c.text3 }}>אין חורים משמעותיים ב-3 הימים הקרובים</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {gaps.map((g, i) => {
                  const matches = matchForGap(customers, bookings, 3);
                  return (
                    <Box key={i} className="zk-card" sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: matches.length ? 1.75 : 0 }}>
                        <Box sx={{ textAlign: 'center', bgcolor: c.accentDim, borderRadius: 2, px: 1.75, py: 0.75, minWidth: 68 }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: c.accent }}>{dayLabel(g.date)}</Typography>
                          <Typography sx={{ fontSize: 15, fontWeight: 900, color: c.accent, letterSpacing: '-0.02em' }}>{g.start}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text }}>{g.start}–{g.end}</Typography>
                          <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{g.minutes} דקות פנויות · ≈ ₪{Math.round((g.minutes / 45) * ticket)}</Typography>
                        </Box>
                      </Box>
                      {matches.length > 0 && (
                        <Box sx={{ borderTop: `1px solid ${c.border2}`, pt: 1.5 }}>
                          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: c.text3, mb: 1 }}>לקוחות שבשלים לתור:</Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                            {matches.map((cust) => {
                              const msg = `שלום ${cust.name}! 😊 התפנה תור ב${bizName} ${dayLabel(g.date)} בשעה ${g.start}. רוצה שאשמור לך אותו?`;
                              return (
                                <Box key={cust.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: c.text }}>{cust.name}</Typography>
                                  <Button href={waLink(cust.phone, msg)} target="_blank" size="small" variant="contained" sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12, bgcolor: '#25D366', '&:hover': { bgcolor: '#1EA952' } }}>💬 הצע</Button>
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </>
        )}

        {/* ===== WIN-BACK ===== */}
        {tab === 'winback' && (
          <>
            <Typography sx={{ fontSize: 14, color: c.text2, mb: 2, lineHeight: 1.6 }}>לקוחות שהיו קבועים ונעלמו — עברו את הקצב הרגיל שלהם. שלח להם הודעת &quot;התגעגענו&quot; מוכנה בוואטסאפ.</Typography>
            {churning.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Box sx={{ fontSize: 40, mb: 1.5 }}>💚</Box>
                <Typography sx={{ fontWeight: 700, color: c.text }}>הלקוחות שלך נאמנים!</Typography>
                <Typography sx={{ fontSize: 13, color: c.text3 }}>אף לקוח קבוע לא נעלם כרגע</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {churning.map((ch: ChurningCustomer) => {
                  const msg = `שלום ${ch.customer.name}! מזמן לא התראינו ב${bizName} 😊 מתגעגעים! רוצה לקבוע תור? מחכה לך הפתעה קטנה 💜`;
                  return (
                    <Box key={ch.customer.id} className="zk-card" sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.25 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontSize: 15.5, fontWeight: 800, color: c.text }}>{ch.customer.name}</Typography>
                            {ch.visits >= 5 && <Box sx={{ fontSize: 10, fontWeight: 800, color: '#fff', bgcolor: c.amber, borderRadius: 99, px: 0.9, py: 0.15 }}>VIP</Box>}
                          </Box>
                          <Typography sx={{ fontSize: 12.5, color: c.text3 }}>לא הגיע {ch.daysSince} ימים · בד&quot;כ כל {ch.avgGap} ימים · {ch.visits} ביקורים</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.75 }}>
                          <Button href={`tel:${ch.customer.phone}`} size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12, minWidth: 'auto' }}>📞</Button>
                          <Button href={waLink(ch.customer.phone, msg)} target="_blank" size="small" variant="contained" sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12, bgcolor: '#25D366', '&:hover': { bgcolor: '#1EA952' } }}>💬 החזר</Button>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
