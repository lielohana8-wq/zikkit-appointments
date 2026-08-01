'use client';

/**
 * Revenue Engine — v2. Every gap is actionable in 5 seconds:
 * tiered customer matches (never empty), manual picker, editable message
 * with a saved offer, dismiss-as-handled, and honest math.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Typography, Button, CircularProgress, TextField, Dialog, Collapse } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getBookings, getCustomers, getHours, loadBiz, patchBiz, type Booking, type Customer } from '@/lib/bizdata';
import { findGaps, matchForGap, findChurning, computeRadar, avgTicket, type Gap, type ChurningCustomer, type GapMatch } from '@/lib/revenue-engine';
import { waLink } from '@/lib/messaging';
import { zikkitColors as c } from '@/styles/theme';

type Tab = 'radar' | 'gaps' | 'winback';
const gapKey = (g: Gap) => `${g.date}_${g.start}`;

export default function RevenuePage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('radar');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [hours, setHours] = useState<Record<number, { open: boolean; start: string; end: string }> | null>(null);
  const [hoursConfigured, setHoursConfigured] = useState(true);
  const [bizName, setBizName] = useState('העסק');
  const [dataLoading, setDataLoading] = useState(true);

  // Gap controls (R5) + offer (R4) + dismissed (R5)
  const [daysAhead, setDaysAhead] = useState(3);
  const [minGap, setMinGap] = useState(30);
  const [offer, setOffer] = useState('');
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [pickerFor, setPickerFor] = useState<string | null>(null); // gapKey with open picker
  const [pickQuery, setPickQuery] = useState('');

  // Message dialog (R4)
  const [msgDialog, setMsgDialog] = useState<{ phone: string; name: string } | null>(null);
  const [msgText, setMsgText] = useState('');

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
      const cfg = (biz.cfg as Record<string, unknown>) || {};
      setHoursConfigured(!!cfg.hours);
      setBizName((cfg.biz_name as string) || 'העסק');
      const rev = (biz as Record<string, unknown>).revenue as { gapOffer?: string; dismissedGaps?: Record<string, boolean> } | undefined;
      setOffer(rev?.gapOffer || '');
      // prune dismissed keys from the past
      const today = new Date().toISOString().split('T')[0];
      const pruned: Record<string, boolean> = {};
      Object.keys(rev?.dismissedGaps || {}).forEach((k) => { if (k.split('_')[0] >= today) pruned[k] = true; });
      setDismissed(pruned);
    } catch { /* ignore */ } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const persistRevenue = useCallback((next: { gapOffer?: string; dismissedGaps?: Record<string, boolean> }) => {
    if (!bizId) return;
    patchBiz(bizId, { revenue: { gapOffer: next.gapOffer ?? offer, dismissedGaps: next.dismissedGaps ?? dismissed } }).catch(() => {});
  }, [bizId, offer, dismissed]);

  const ticket = useMemo(() => avgTicket(bookings), [bookings]);
  const radar = useMemo(() => computeRadar(bookings, customers, hours, ticket), [bookings, customers, hours, ticket]);
  const allGaps = useMemo(() => findGaps(bookings, hours, { days: daysAhead, minGapMin: minGap }), [bookings, hours, daysAhead, minGap]);
  const gaps = allGaps.filter((g) => !dismissed[gapKey(g)]);
  const churning = useMemo(() => findChurning(customers, bookings), [customers, bookings]);

  const dayLabel = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    const today = new Date().toISOString().split('T')[0];
    const tmw = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    if (iso === today) return 'היום';
    if (iso === tmw) return 'מחר';
    return 'יום ' + ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
  };

  const gapMessage = (g: Gap, name?: string) => {
    const first = (name || '').split(' ')[0];
    const offerPart = offer.trim() ? ` — ו${offer.trim()} למי שתופס עכשיו 🔥` : '';
    return `היי${first ? ' ' + first : ''}! 😊 התפנה תור ב${bizName} ${dayLabel(g.date)} בשעה ${g.start}${offerPart}\nלשריין לך? 💜`;
  };
  const winbackMessage = (name: string) => {
    const offerPart = offer.trim() ? `\nשריינתי לך ${offer.trim()} לביקור הקרוב 🎁` : '\nמחכה לך הפתעה קטנה 🎁';
    return `היי ${name.split(' ')[0]}! מזמן לא התראינו ב${bizName} 😊 התגעגענו!${offerPart}`;
  };

  const openMsg = (phone: string, name: string, text: string) => { setMsgDialog({ phone, name }); setMsgText(text); };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const tabs: [Tab, string, string][] = [
    ['radar', '📊', 'ראדאר'],
    ['gaps', '🔮', 'מילוי חורים'],
    ['winback', '🎯', 'החזרת לקוחות'],
  ];
  const chip = (active: boolean) => ({ cursor: 'pointer', px: 1.5, py: 0.6, borderRadius: 99, fontSize: 12.5, fontWeight: 700, border: `1.5px solid ${active ? c.accent : c.border2}`, color: active ? c.accent : c.text3, bgcolor: active ? c.accentDim : 'transparent', transition: 'all 0.15s' });

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

        {/* Hours not configured warning */}
        {!hoursConfigured && (
          <Box onClick={() => router.push('/hours')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#F59E0B18', border: '1px solid #F59E0B55', borderRadius: 2, px: 2, py: 1.5, mb: 2.5 }}>
            <Box sx={{ fontSize: 18 }}>🕐</Box>
            <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: c.text, flex: 1 }}>שעות הפעילות לא הוגדרו — החורים מחושבים לפי ברירת מחדל. הגדר אותן לדיוק מלא ←</Typography>
          </Box>
        )}

        {/* ===== RADAR ===== */}
        {tab === 'radar' && (
          <>
            <Box sx={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accentDeep})`, borderRadius: 4, p: { xs: 3, sm: 4 }, mb: 3, color: '#fff', position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', top: -30, left: -20, width: 140, height: 140, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)' }} />
              <Typography sx={{ fontSize: 13, fontWeight: 700, opacity: 0.85, position: 'relative' }}>פוטנציאל הכנסה ריאלי</Typography>
              <Typography sx={{ fontSize: { xs: 44, sm: 56 }, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, position: 'relative', my: 0.5 }}>₪{(radar.potentialFromGaps + radar.churningValue).toLocaleString()}</Typography>
              <Typography sx={{ fontSize: 13, opacity: 0.9, position: 'relative' }}>חישוב שמרני: מילוי {radar.fillRatePct}% מהזמן המת + החזרת הלקוחות שנעלמו</Typography>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 3 }}>
              <Box className="zk-card" sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.5 }}>
                <Typography sx={{ fontSize: 30, fontWeight: 900, color: c.hot, letterSpacing: '-0.03em' }}>₪{radar.lostToNoShows.toLocaleString()}</Typography>
                <Typography sx={{ fontSize: 13, color: c.text2, fontWeight: 600, mt: 0.5 }}>הפסדת מ-{radar.noShowCount} אי-הגעות (30 יום)</Typography>
                <Typography sx={{ fontSize: 12, color: c.text3, mt: 1 }}>💡 הפעל מקדמות בדף ההזמנות כדי לעצור את זה</Typography>
              </Box>
              <Box className="zk-card" sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.5 }}>
                <Typography sx={{ fontSize: 30, fontWeight: 900, color: c.accent, letterSpacing: '-0.03em' }}>{radar.emptySlotHours} שעות</Typography>
                <Typography sx={{ fontSize: 13, color: c.text2, fontWeight: 600, mt: 0.5 }}>זמן מת ב-3 הימים הקרובים</Typography>
                <Typography sx={{ fontSize: 12, color: c.text3, mt: 1 }}>מילוי {radar.fillRatePct}% ≈ ₪{radar.potentialFromGaps.toLocaleString()} · לך ל&quot;מילוי חורים&quot;</Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {gaps.length > 0 && (
                <Box onClick={() => setTab('gaps')} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, bgcolor: c.accentDim, borderRadius: 2.5, p: 2 }}>
                  <Box sx={{ fontSize: 24 }}>🔮</Box>
                  <Box sx={{ flex: 1 }}><Typography sx={{ fontSize: 14.5, fontWeight: 800, color: c.text }}>מלא {gaps.length} חורים ביומן</Typography><Typography sx={{ fontSize: 12.5, color: c.text3 }}>הודעה מוכנה לכל חור — בוואטסאפ</Typography></Box>
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
            {/* Controls */}
            <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2.5, p: 2, mb: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text3 }}>ימים קדימה:</Typography>
                {[3, 5, 7].map((d) => <Box key={d} onClick={() => setDaysAhead(d)} sx={chip(daysAhead === d)}>{d}</Box>)}
                <Box sx={{ width: 10 }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: c.text3 }}>חור מינימלי:</Typography>
                {[30, 45, 60].map((m) => <Box key={m} onClick={() => setMinGap(m)} sx={chip(minGap === m)}>{m} דק&apos;</Box>)}
              </Box>
              <TextField fullWidth size="small" label="הטבה בהודעות (לא חובה)" placeholder='למשל: 10% הנחה'
                value={offer} onChange={(e) => setOffer(e.target.value)} onBlur={() => persistRevenue({ gapOffer: offer })} />
            </Box>

            {gaps.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Box sx={{ fontSize: 40, mb: 1.5 }}>🎉</Box>
                <Typography sx={{ fontWeight: 700, color: c.text }}>היומן שלך מלא!</Typography>
                <Typography sx={{ fontSize: 13, color: c.text3 }}>אין חורים משמעותיים ב-{daysAhead} הימים הקרובים{Object.keys(dismissed).length ? ` (${Object.keys(dismissed).length} סומנו כטופלו)` : ''}</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {gaps.map((g, i) => {
                  const k = gapKey(g);
                  const matches: GapMatch[] = matchForGap(customers, bookings, { limit: 3, rotate: i });
                  const pickList = customers.filter((cu) => cu.phone && (!pickQuery.trim() || cu.name?.includes(pickQuery.trim()) || cu.phone.includes(pickQuery.trim()))).slice(0, 8);
                  return (
                    <Box key={k} className="zk-card" sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ textAlign: 'center', bgcolor: c.accentDim, borderRadius: 2, px: 1.75, py: 0.75, minWidth: 68 }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: c.accent }}>{dayLabel(g.date)}</Typography>
                          <Typography sx={{ fontSize: 15, fontWeight: 900, color: c.accent, letterSpacing: '-0.02em' }}>{g.start}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text }}>{g.start}–{g.end}</Typography>
                          <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{g.minutes} דקות פנויות · שווי ≈ ₪{Math.round((g.minutes / 45) * ticket)}</Typography>
                        </Box>
                        <Button onClick={() => { const next = { ...dismissed, [k]: true }; setDismissed(next); persistRevenue({ dismissedGaps: next }); }} size="small" sx={{ minWidth: 'auto', fontSize: 12, fontWeight: 700, color: c.text3 }}>✓ טופל</Button>
                      </Box>

                      <Box sx={{ borderTop: `1px solid ${c.border2}`, pt: 1.5, mt: 1.75 }}>
                        {matches.length > 0 ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                            {matches.map((m) => (
                              <Box key={m.customer.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: c.text }}>{m.customer.name}</Typography>
                                  <Typography sx={{ fontSize: 11.5, color: m.tier === 1 ? c.green : c.text3 }}>{m.tier === 1 ? '🎯 ' : ''}{m.reason}</Typography>
                                </Box>
                                <Button onClick={() => openMsg(m.customer.phone, m.customer.name, gapMessage(g, m.customer.name))} size="small" variant="contained" sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12, bgcolor: '#25D366', '&:hover': { bgcolor: '#1EA952' } }}>💬 הצע</Button>
                              </Box>
                            ))}
                          </Box>
                        ) : (
                          <Typography sx={{ fontSize: 12.5, color: c.text3 }}>אין עדיין לקוחות במערכת — הוסף לקוחות או העתק את ההודעה לסטטוס 👇</Typography>
                        )}
                        <Box sx={{ display: 'flex', gap: 1, mt: 1.25, flexWrap: 'wrap' }}>
                          <Button onClick={() => { setPickerFor(pickerFor === k ? null : k); setPickQuery(''); }} size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12 }}>👤 בחר לקוח אחר</Button>
                          <Button onClick={() => { navigator.clipboard?.writeText(gapMessage(g)); }} size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12 }}>📋 העתק לסטטוס/קבוצה</Button>
                        </Box>
                        <Collapse in={pickerFor === k}>
                          <Box sx={{ mt: 1.5, bgcolor: c.surface2, borderRadius: 2, p: 1.5 }}>
                            <TextField fullWidth size="small" placeholder="חפש לקוח לפי שם או טלפון..." value={pickQuery} onChange={(e) => setPickQuery(e.target.value)} sx={{ mb: 1 }} />
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 220, overflowY: 'auto' }}>
                              {pickList.map((cu) => (
                                <Box key={cu.id} onClick={() => { setPickerFor(null); openMsg(cu.phone, cu.name, gapMessage(g, cu.name)); }} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.9, borderRadius: 1.5, '&:hover': { bgcolor: c.surface3 } }}>
                                  <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: c.text, flex: 1 }}>{cu.name}</Typography>
                                  <Typography sx={{ fontSize: 12, color: c.text3 }}>{cu.visits || 0} ביקורים</Typography>
                                </Box>
                              ))}
                              {pickList.length === 0 && <Typography sx={{ fontSize: 12.5, color: c.text3, textAlign: 'center', py: 1 }}>לא נמצא לקוח</Typography>}
                            </Box>
                          </Box>
                        </Collapse>
                      </Box>
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
            <Typography sx={{ fontSize: 14, color: c.text2, mb: 2, lineHeight: 1.6 }}>לקוחות שהיו קבועים ונעלמו — עברו את הקצב הרגיל שלהם. לחץ 💬 לעריכת הודעת &quot;התגעגענו&quot; ושליחה.</Typography>
            {churning.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Box sx={{ fontSize: 40, mb: 1.5 }}>💚</Box>
                <Typography sx={{ fontWeight: 700, color: c.text }}>הלקוחות שלך נאמנים!</Typography>
                <Typography sx={{ fontSize: 13, color: c.text3 }}>אף לקוח קבוע לא נעלם כרגע</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {churning.map((ch: ChurningCustomer) => (
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
                        <Button onClick={() => openMsg(ch.customer.phone, ch.customer.name, winbackMessage(ch.customer.name))} size="small" variant="contained" sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12, bgcolor: '#25D366', '&:hover': { bgcolor: '#1EA952' } }}>💬 החזר</Button>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </Box>

      {/* ===== Editable message dialog ===== */}
      <Dialog open={!!msgDialog} onClose={() => setMsgDialog(null)} fullWidth PaperProps={{ sx: { bgcolor: c.surface1, borderRadius: 3, maxWidth: 440, m: 2 } }}>
        <Box sx={{ p: 2.75 }}>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text, mb: 0.25 }}>💬 הודעה ל{msgDialog?.name}</Typography>
          <Typography sx={{ fontSize: 12.5, color: c.text3, mb: 2 }}>ערוך חופשי — ואז שלח בוואטסאפ או העתק</Typography>
          <TextField fullWidth multiline minRows={4} value={msgText} onChange={(e) => setMsgText(e.target.value)} sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button href={msgDialog ? waLink(msgDialog.phone, msgText) : '#'} target="_blank" onClick={() => setMsgDialog(null)} fullWidth variant="contained" sx={{ borderRadius: 2, fontWeight: 800, bgcolor: '#25D366', '&:hover': { bgcolor: '#1EA952' } }}>💬 שלח בוואטסאפ</Button>
            <Button onClick={() => { navigator.clipboard?.writeText(msgText); setMsgDialog(null); }} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, whiteSpace: 'nowrap' }}>📋 העתק</Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
}
