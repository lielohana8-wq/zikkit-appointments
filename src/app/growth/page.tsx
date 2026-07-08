'use client';

/**
 * 📈 AI Growth Center — "a marketing manager inside the system".
 * Growth score, opportunities, weekly plan, smart segments, campaign
 * generator, marketing calendar, revenue predictions and benchmarks —
 * all computed live from the business's real data.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Typography, Button, CircularProgress, TextField, MenuItem, Dialog, Collapse } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/Toast';
import { zikkitColors as c } from '@/styles/theme';
import { getBookings, getCustomers, getServices, getReviews, loadBiz, patchBiz, type Booking, type Customer, type Service } from '@/lib/bizdata';
import {
  calculateGrowthScore, generateGrowthInsights, generateCustomerSegments,
  generateMarketingRecommendations, generateRevenuePredictions, generateBenchmarks,
  generateCampaign, avgTicket,
  type GrowthScore, type Opportunity, type Segment, type PlanItem, type MorningBrief, type Prediction, type Benchmark,
} from '@/lib/growth';

interface SavedCampaign { at: string; goal: string; segment: string; message: string }

const scoreColor = (s: number) => (s >= 70 ? c.green : s >= 40 ? '#F59E0B' : c.hot);

export default function GrowthPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const { showToast } = useToast();

  const [dataLoading, setDataLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [campaigns, setCampaigns] = useState<SavedCampaign[]>([]);
  const [bizName, setBizName] = useState('העסק שלי');
  const [openSeg, setOpenSeg] = useState<string | null>(null);

  // Campaign generator state
  const [genOpen, setGenOpen] = useState(false);
  const [goal, setGoal] = useState('החזרת לקוחות');
  const [segId, setSegId] = useState('inactive');
  const [tone, setTone] = useState('חם ואישי');
  const [offer, setOffer] = useState('');
  const [genOut, setGenOut] = useState<{ headline: string; message: string; cta: string } | null>(null);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const [bks, custs, svcs, reviews, biz] = await Promise.all([
        getBookings(bizId), getCustomers(bizId), getServices(bizId), getReviews(bizId), loadBiz(bizId),
      ]);
      setBookings(bks); setCustomers(custs); setServices(svcs); setReviewCount(reviews.length);
      const g = (biz as Record<string, unknown>).growth as { campaigns?: SavedCampaign[] } | undefined;
      setCampaigns(g?.campaigns || []);
      const cfg = (biz.cfg as Record<string, unknown>) || {};
      setBizName(String(cfg.biz_name || 'העסק שלי'));
    } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const campaignsLast30 = useMemo(
    () => campaigns.filter((cp) => Date.now() - new Date(cp.at).getTime() < 30 * 86400000).length,
    [campaigns],
  );

  const avg = useMemo(() => avgTicket(bookings, services), [bookings, services]);
  const score: GrowthScore = useMemo(() => calculateGrowthScore(bookings, customers, services, reviewCount, campaignsLast30), [bookings, customers, services, reviewCount, campaignsLast30]);
  const segments: Segment[] = useMemo(() => generateCustomerSegments(customers, bookings, services), [customers, bookings, services]);
  const ops: Opportunity[] = useMemo(() => generateGrowthInsights(bookings, customers, services, reviewCount), [bookings, customers, services, reviewCount]);
  const { calendar, brief }: { calendar: PlanItem[]; brief: MorningBrief } = useMemo(() => generateMarketingRecommendations(ops, segments), [ops, segments]);
  const preds: Prediction[] = useMemo(() => generateRevenuePredictions(bookings, customers, services), [bookings, customers, services]);
  const benches: Benchmark[] = useMemo(() => generateBenchmarks(services, bookings, campaignsLast30, avg), [services, bookings, campaignsLast30, avg]);

  const bookingUrl = typeof window !== 'undefined' && bizId ? `${window.location.origin}/book/${bizId}` : '';

  const waLink = (phone: string, msg: string) =>
    `https://wa.me/972${(phone || '').replace(/\D/g, '').replace(/^0/, '').replace(/^972/, '')}?text=${encodeURIComponent(msg)}`;

  const openGenerator = (presetGoal?: string, presetSeg?: string) => {
    if (presetGoal) setGoal(presetGoal);
    if (presetSeg) setSegId(presetSeg);
    setGenOut(null);
    setGenOpen(true);
  };

  const runGenerator = () => {
    const seg = segments.find((s) => s.id === segId);
    setGenOut(generateCampaign({ goal, segmentLabel: seg?.label || 'כל הלקוחות', tone, bizName, bookingUrl, offer }));
  };

  const saveCampaign = async (message: string) => {
    if (!bizId) return;
    const next = [{ at: new Date().toISOString(), goal, segment: segId, message }, ...campaigns].slice(0, 30);
    setCampaigns(next);
    try { await patchBiz(bizId, { growth: { campaigns: next } }); } catch { /* non-blocking */ }
  };

  const copyMsg = async (msg: string) => {
    await navigator.clipboard?.writeText(msg);
    showToast('ההודעה הועתקה — הדבק בוואטסאפ', 'success');
    saveCampaign(msg);
  };

  if (loading || dataLoading) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  const genSegment = segments.find((s) => s.id === segId);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: { xs: 2.5, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>📈 מרכז צמיחה</Typography>
        <Box sx={{ width: 60 }} />
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 4 }, py: 3, display: 'flex', flexDirection: 'column', gap: 3.5 }}>

        {/* ===== 1. GROWTH SCORE ===== */}
        <Box sx={{ background: `linear-gradient(135deg, ${c.accent}, #9333EA)`, borderRadius: 4, p: { xs: 2.5, sm: 3.5 }, color: '#fff', boxShadow: '0 16px 48px rgba(124,58,237,0.35)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700, opacity: 0.9 }}>ציון הצמיחה שלך</Typography>
              <Typography sx={{ fontSize: 56, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em' }}>{score.total}<span style={{ fontSize: 26, opacity: 0.75 }}>/100</span></Typography>
            </Box>
            <Box sx={{ fontSize: 44 }}>{score.total >= 70 ? '🚀' : score.total >= 40 ? '📈' : '🌱'}</Box>
          </Box>
          <Box sx={{ mt: 2.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {score.subs.map((s) => (
              <Box key={s.key}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{s.icon} {s.label}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{s.score}</Typography>
                </Box>
                <Box sx={{ height: 7, bgcolor: 'rgba(255,255,255,0.22)', borderRadius: 99, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${s.score}%`, bgcolor: '#fff', borderRadius: 99, transition: 'width 0.6s' }} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ===== 3. AI MARKETING MANAGER (morning brief) ===== */}
        <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3.5, p: { xs: 2.5, sm: 3 } }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color: c.accent, mb: 0.75 }}>🧠 מנהל השיווק שלך</Typography>
          <Typography sx={{ fontSize: 19, fontWeight: 800, color: c.text, mb: 1.5 }}>בוקר טוב! השבוע כדאי לך:</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {brief.tasks.map((t, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: c.accentDim, color: c.accent, fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</Box>
                <Typography sx={{ fontSize: 14.5, fontWeight: 600, color: c.text }}>{t}</Typography>
              </Box>
            ))}
          </Box>
          {brief.potential > 0 && (
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.green, mt: 1.75 }}>💰 שווי משוער: ‎+₪{brief.potential.toLocaleString()}</Typography>
          )}
          <Button onClick={() => openGenerator('החזרת לקוחות', 'inactive')} variant="contained" sx={{ mt: 2, borderRadius: 2, fontWeight: 800 }}>⚡ בצע הכל — התחל מקמפיין</Button>
        </Box>

        {/* ===== 2. AI OPPORTUNITIES ===== */}
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text, mb: 1.5 }}>💡 הזדמנויות שה-AI זיהה</Typography>
          {ops.length === 0 ? (
            <Box sx={{ bgcolor: c.surface1, border: `1px dashed ${c.border2}`, borderRadius: 3, p: 3, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 14, color: c.text3 }}>ככל שיצטברו תורים ולקוחות — יופיעו כאן הזדמנויות מדויקות 🌱</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {ops.map((o) => (
                <Box key={o.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.25 }}>
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: c.accentDim, fontSize: 21, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{o.icon}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text }}>{o.title}</Typography>
                      <Typography sx={{ fontSize: 13, color: c.text3, mt: 0.25 }}>{o.body}</Typography>
                      {o.potential ? <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.green, mt: 0.75 }}>פוטנציאל: ₪{o.potential.toLocaleString()}</Typography> : null}
                    </Box>
                  </Box>
                  <Button onClick={() => openGenerator(o.id === 'reviews' ? 'בקשת ביקורות' : o.id === 'weekday' ? 'מילוי יומן השבוע' : 'החזרת לקוחות', o.segmentId === 'loyal' ? 'loyal' : o.segmentId || 'inactive')} size="small" variant="outlined" sx={{ mt: 1.5, borderRadius: 2, fontWeight: 700 }}>{o.action} ←</Button>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* ===== 4. SMART SEGMENTS ===== */}
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text, mb: 1.5 }}>👥 פילוחי לקוחות חכמים</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {segments.filter((s) => s.customers.length > 0).map((s) => (
              <Box key={s.id} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2.5, overflow: 'hidden' }}>
                <Box onClick={() => setOpenSeg(openSeg === s.id ? null : s.id)} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, p: 2 }}>
                  <Box sx={{ fontSize: 22 }}>{s.icon}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: c.text }}>{s.label} · {s.customers.length}</Typography>
                    <Typography sx={{ fontSize: 12, color: c.text3 }}>{s.desc}{s.revenue > 0 ? ` · הכניסו ₪${s.revenue.toLocaleString()}` : ''}</Typography>
                  </Box>
                  <Button onClick={(e) => { e.stopPropagation(); openGenerator(s.id === 'loyal' ? 'בקשת ביקורות' : s.id === 'inactive' || s.id === 'at-risk' ? 'החזרת לקוחות' : 'מילוי יומן השבוע', s.id); }} size="small" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>שלח קמפיין</Button>
                  <Box sx={{ color: c.text3, fontWeight: 700 }}>{openSeg === s.id ? '▾' : '‹'}</Box>
                </Box>
                <Collapse in={openSeg === s.id}>
                  <Box sx={{ borderTop: `1px solid ${c.border}`, px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: 260, overflowY: 'auto' }}>
                    {s.customers.slice(0, 25).map((cu) => (
                      <Box key={cu.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: c.text, flex: 1 }}>{cu.name}</Typography>
                        <Typography sx={{ fontSize: 12, color: c.text3 }}>{cu.visits} ביקורים</Typography>
                        <Button href={waLink(cu.phone, `היי ${cu.name?.split(' ')[0] || ''} 💜`)} target="_blank" size="small" sx={{ minWidth: 'auto', fontSize: 12, fontWeight: 700, color: '#25D366' }}>💬</Button>
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ===== 8. REVENUE PREDICTIONS ===== */}
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text, mb: 1.5 }}>🔮 תחזיות הכנסה</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            {preds.map((p, i) => (
              <Box key={i} sx={{ background: `linear-gradient(160deg, ${c.surface1}, ${c.surface2})`, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.25 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: c.text2 }}>{p.icon} {p.title}</Typography>
                {p.amount > 0 && <Typography sx={{ fontSize: 30, fontWeight: 900, color: c.green, letterSpacing: '-0.02em', my: 0.5 }}>‎+₪{p.amount.toLocaleString()}<span style={{ fontSize: 14, color: c.text3, fontWeight: 600 }}> {p.period}</span></Typography>}
                <Typography sx={{ fontSize: 12, color: c.text3 }}>{p.how}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ===== 7. MARKETING CALENDAR ===== */}
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text, mb: 1.5 }}>🗓️ לוח השיווק השבועי</Typography>
          <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.25 }}>
            {calendar.map((d, i) => (
              <Box key={d.day} sx={{ display: 'flex', gap: 1.75, position: 'relative', pb: i < calendar.length - 1 ? 2.25 : 0 }}>
                {i < calendar.length - 1 && <Box sx={{ position: 'absolute', right: 21, top: 40, bottom: 0, width: 2, bgcolor: c.border }} />}
                <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: c.accentDim, fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>{d.icon}</Box>
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: c.accent }}>יום {d.day}</Typography>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: c.text }}>{d.title}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{d.desc}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ===== 9. BENCHMARKS ===== */}
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text, mb: 1.5 }}>📊 איך אתה מול עסקים כמוך?</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {benches.map((b, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', bgcolor: c.surface1, border: `1px solid ${b.level === 'good' ? c.green + '44' : '#F59E0B44'}`, borderRadius: 2.5, p: 2 }}>
                <Box sx={{ fontSize: 20 }}>{b.icon}</Box>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.text }}>{b.title}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: c.text3 }}>{b.body}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ===== 6. CONTENT STUDIO link (photo→post + auto landing page, preserved) ===== */}
        <Box onClick={() => router.push('/ai-studio')} className="zk-card" sx={{ cursor: 'pointer', background: `linear-gradient(135deg, ${c.accentDim}, transparent)`, border: `1px solid ${c.border2}`, borderRadius: 3, p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ fontSize: 30 }}>🎨</Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 15.5, fontWeight: 800, color: c.text }}>סטודיו תוכן AI</Typography>
            <Typography sx={{ fontSize: 13, color: c.text3 }}>תמונה → פוסט לאינסטגרם · בניית דף נחיתה אוטומטי</Typography>
          </Box>
          <Box sx={{ color: c.accent, fontSize: 20, fontWeight: 700 }}>‹</Box>
        </Box>

        {/* Recent campaigns */}
        {campaigns.length > 0 && (
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: c.text, mb: 1.5 }}>📨 קמפיינים אחרונים</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {campaigns.slice(0, 5).map((cp, i) => (
                <Box key={i} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2.5, p: 1.75 }}>
                  <Typography sx={{ fontSize: 12, color: c.text3, mb: 0.5 }}>{new Date(cp.at).toLocaleDateString('he-IL')} · {cp.goal}</Typography>
                  <Typography sx={{ fontSize: 13, color: c.text2, whiteSpace: 'pre-line' }}>{cp.message.slice(0, 120)}{cp.message.length > 120 ? '…' : ''}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* ===== 5. CAMPAIGN GENERATOR dialog ===== */}
      <Dialog open={genOpen} onClose={() => setGenOpen(false)} fullWidth PaperProps={{ sx: { bgcolor: c.surface1, borderRadius: 3, maxWidth: 480, m: 2 } }}>
        <Box sx={{ p: 3 }}>
          <Typography sx={{ fontSize: 19, fontWeight: 800, color: c.text, mb: 0.5 }}>✨ מחולל קמפיינים</Typography>
          <Typography sx={{ fontSize: 13, color: c.text3, mb: 2.5 }}>בחר מטרה, קהל וטון — וקבל הודעה מוכנה לשליחה.</Typography>

          <TextField select fullWidth size="small" label="מטרת הקמפיין" value={goal} onChange={(e) => setGoal(e.target.value)} sx={{ mb: 1.75 }}>
            {['החזרת לקוחות', 'מילוי יומן השבוע', 'מבצע חג', 'בקשת ביקורות', 'לקוחות חדשים'].map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
          </TextField>
          <TextField select fullWidth size="small" label="קהל יעד" value={segId} onChange={(e) => setSegId(e.target.value)} sx={{ mb: 1.75 }}>
            {segments.filter((s) => s.customers.length > 0).map((s) => <MenuItem key={s.id} value={s.id}>{s.icon} {s.label} ({s.customers.length})</MenuItem>)}
          </TextField>
          <TextField select fullWidth size="small" label="טון" value={tone} onChange={(e) => setTone(e.target.value)} sx={{ mb: 1.75 }}>
            {['חם ואישי', 'מקצועי', 'צעיר וקליל'].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField fullWidth size="small" label="הטבה (לא חובה)" placeholder="למשל: 15% הנחה" value={offer} onChange={(e) => setOffer(e.target.value)} sx={{ mb: 2 }} />

          <Button onClick={runGenerator} fullWidth variant="contained" sx={{ borderRadius: 2, fontWeight: 800, py: 1.25 }}>🎯 צור קמפיין</Button>

          {genOut && (
            <Box sx={{ mt: 2.5, bgcolor: c.surface2, borderRadius: 2.5, p: 2 }}>
              <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: c.accent, mb: 1 }}>{genOut.headline}</Typography>
              <Typography sx={{ fontSize: 13.5, color: c.text, whiteSpace: 'pre-line', lineHeight: 1.65 }}>{genOut.message.replace(/\{name\}/g, genSegment?.customers[0]?.name?.split(' ')[0] || 'לקוח/ה')}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                <Button onClick={() => copyMsg(genOut.message)} variant="contained" size="small" sx={{ borderRadius: 2, fontWeight: 700 }}>📋 העתק לכולם</Button>
                {genSegment?.customers[0] && (
                  <Button href={waLink(genSegment.customers[0].phone, genOut.message.replace(/\{name\}/g, genSegment.customers[0].name?.split(' ')[0] || ''))} target="_blank" onClick={() => saveCampaign(genOut.message)} variant="outlined" size="small" sx={{ borderRadius: 2, fontWeight: 700, color: '#25D366', borderColor: '#25D36655' }}>💬 שלח לראשון בוואטסאפ</Button>
                )}
              </Box>
              <Typography sx={{ fontSize: 11.5, color: c.text3, mt: 1.25 }}>💡 ההודעה נשלחת עם {'{שם}'} מותאם לכל לקוח — פתח את הפילוח ושלח אחד-אחד ב-💬</Typography>
            </Box>
          )}
        </Box>
      </Dialog>
    </Box>
  );
}
