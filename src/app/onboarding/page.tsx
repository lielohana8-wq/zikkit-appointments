'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, TextField, CircularProgress, Switch } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/Toast';
import { loadBiz, patchBiz, getServices, saveServices, getHours, setHours, getBranding, saveBranding, type Service, type BizHours } from '@/lib/bizdata';
import { track, Events } from '@/lib/analytics';
import { zikkitColors as c } from '@/styles/theme';

/**
 * Unified onboarding wizard — takes a brand-new owner from 0 to a live booking
 * page in one guided flow. Each step saves independently, is skippable, and
 * shows progress. Replaces hunting across 8 separate settings screens.
 */
const STEPS = ['עסק', 'שירותים', 'שעות', 'דף הזמנות', 'סיום'] as const;
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function OnboardingPage() {
  const router = useRouter();
  const { firebaseUser, bizId, loading } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Step data
  const [bizName, setBizName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [services, setServicesState] = useState<Service[]>([]);
  const [hours, setHoursState] = useState<BizHours | null>(null);
  const [welcomeText, setWelcomeText] = useState('');
  const [bookingEnabled, setBookingEnabled] = useState(true);

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  const load = useCallback(async () => {
    if (!bizId) return;
    try {
      const [biz, svcs, hrs, brand] = await Promise.all([
        loadBiz(bizId), getServices(bizId), getHours(bizId), getBranding(bizId),
      ]);
      const cfg = (biz.cfg as Record<string, unknown>) || {};
      setBizName((cfg.biz_name as string) || '');
      setOwnerPhone((cfg.owner_phone as string) || '');
      setAddress(brand.address || '');
      setServicesState(svcs.length ? svcs : [{ id: 'svc_1', name: '', category: '', price: 0, duration: 30, description: '', active: true }]);
      setHoursState(hrs);
      setWelcomeText(brand.welcomeText || '');
      setBookingEnabled(brand.enabled !== false);
    } catch { /* ignore */ } finally { setDataLoading(false); }
  }, [bizId]);
  useEffect(() => { load(); }, [load]);

  const saveStep = async () => {
    if (!bizId) return;
    setSaving(true);
    try {
      if (step === 0) {
        await patchBiz(bizId, { cfg: { biz_name: bizName, owner_phone: ownerPhone } });
        const brand = await getBranding(bizId);
        await saveBranding(bizId, { ...brand, address });
      } else if (step === 1) {
        await saveServices(bizId, services.filter((s) => s.name.trim()));
      } else if (step === 2 && hours) {
        await setHours(bizId, hours);
      } else if (step === 3) {
        const brand = await getBranding(bizId);
        await saveBranding(bizId, { ...brand, welcomeText, enabled: bookingEnabled });
        if (bookingEnabled) track(Events.BOOKING_PAGE_ENABLED, { bizId });
      }
      if (step < STEPS.length - 1) setStep(step + 1);
    } catch (e) { showToast((e as Error).message, 'error'); } finally { setSaving(false); }
  };

  const finish = () => { if (bizId) localStorage.setItem(`zk-welcomed-${bizId}`, '1'); router.push('/dashboard'); };

  const updateService = (i: number, field: keyof Service, val: string | number) => {
    setServicesState((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
  };
  const addService = () => setServicesState((prev) => [...prev, { id: 'svc_' + Date.now(), name: '', category: '', price: 0, duration: 30, description: '', active: true }]);

  if (loading || dataLoading || !hours) return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg }}><CircularProgress sx={{ color: c.accent }} /></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      {/* Progress header */}
      <Box sx={{ borderBottom: `1px solid ${c.border2}`, py: 2, px: { xs: 2.5, sm: 4 }, position: 'sticky', top: 0, bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', zIndex: 10 }}>
        <Box sx={{ maxWidth: 620, mx: 'auto' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text }}>הקמת העסק · {step + 1}/{STEPS.length}</Typography>
            <Button onClick={finish} sx={{ fontSize: 13, color: c.text3, fontWeight: 600 }}>דלג להמשך</Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            {STEPS.map((s, i) => (
              <Box key={s} sx={{ flex: 1, height: 6, borderRadius: 99, bgcolor: i <= step ? c.accent : c.surface3, transition: 'all 0.3s' }} />
            ))}
          </Box>
        </Box>
      </Box>

      <Box className="zk-page" sx={{ maxWidth: 620, mx: 'auto', px: { xs: 2.5, sm: 4 }, py: 4 }}>
        {/* STEP 0 — Business */}
        {step === 0 && (
          <>
            <Box sx={{ fontSize: 40, mb: 1 }}>🏪</Box>
            <Typography sx={{ fontSize: 26, fontWeight: 900, color: c.text, letterSpacing: '-0.03em', mb: 0.5 }}>ספר לנו על העסק</Typography>
            <Typography sx={{ fontSize: 15, color: c.text3, mb: 3 }}>הפרטים האלה יופיעו בדף ההזמנות שלך.</Typography>
            <TextField fullWidth label="שם העסק" value={bizName} onChange={(e) => setBizName(e.target.value)} sx={{ mb: 2 }} placeholder="הסלון של דנה" />
            <TextField fullWidth label="טלפון" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} sx={{ mb: 2 }} placeholder="050-1234567" />
            <TextField fullWidth label="כתובת (אופציונלי)" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="רחוב הראשי 1, תל אביב" />
          </>
        )}

        {/* STEP 1 — Services */}
        {step === 1 && (
          <>
            <Box sx={{ fontSize: 40, mb: 1 }}>✂️</Box>
            <Typography sx={{ fontSize: 26, fontWeight: 900, color: c.text, letterSpacing: '-0.03em', mb: 0.5 }}>מה אתה מציע?</Typography>
            <Typography sx={{ fontSize: 15, color: c.text3, mb: 3 }}>השירותים והמחירים שלקוחות יוכלו להזמין.</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {services.map((s, i) => (
                <Box key={s.id} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField label="שם השירות" value={s.name} onChange={(e) => updateService(i, 'name', e.target.value)} sx={{ flex: 2 }} size="small" placeholder="תספורת" />
                  <TextField label="₪" type="number" value={s.price || ''} onChange={(e) => updateService(i, 'price', Number(e.target.value))} sx={{ flex: 1 }} size="small" />
                  <TextField label="דק'" type="number" value={s.duration || ''} onChange={(e) => updateService(i, 'duration', Number(e.target.value))} sx={{ flex: 1 }} size="small" />
                </Box>
              ))}
            </Box>
            <Button onClick={addService} sx={{ mt: 2, fontWeight: 700, color: c.accent }}>+ הוסף שירות</Button>
          </>
        )}

        {/* STEP 2 — Hours */}
        {step === 2 && hours && (
          <>
            <Box sx={{ fontSize: 40, mb: 1 }}>🕐</Box>
            <Typography sx={{ fontSize: 26, fontWeight: 900, color: c.text, letterSpacing: '-0.03em', mb: 0.5 }}>מתי אתה פתוח?</Typography>
            <Typography sx={{ fontSize: 15, color: c.text3, mb: 3 }}>שעות הפעילות קובעות מתי אפשר להזמין תור.</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {DAYS.map((dayName, i) => {
                const d = hours.days[i] || { open: false, start: '09:00', end: '19:00' };
                return (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, px: 2, py: 1 }}>
                    <Typography sx={{ width: 60, fontSize: 14, fontWeight: 700, color: c.text }}>{dayName}</Typography>
                    <Switch checked={d.open} onChange={(e) => setHoursState({ ...hours, days: { ...hours.days, [i]: { ...d, open: e.target.checked } } })} size="small" />
                    {d.open ? (
                      <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
                        <TextField type="time" value={d.start} onChange={(e) => setHoursState({ ...hours, days: { ...hours.days, [i]: { ...d, start: e.target.value } } })} size="small" sx={{ flex: 1 }} />
                        <TextField type="time" value={d.end} onChange={(e) => setHoursState({ ...hours, days: { ...hours.days, [i]: { ...d, end: e.target.value } } })} size="small" sx={{ flex: 1 }} />
                      </Box>
                    ) : <Typography sx={{ flex: 1, fontSize: 13, color: c.text3 }}>סגור</Typography>}
                  </Box>
                );
              })}
            </Box>
          </>
        )}

        {/* STEP 3 — Booking page */}
        {step === 3 && (
          <>
            <Box sx={{ fontSize: 40, mb: 1 }}>🔗</Box>
            <Typography sx={{ fontSize: 26, fontWeight: 900, color: c.text, letterSpacing: '-0.03em', mb: 0.5 }}>דף ההזמנות שלך</Typography>
            <Typography sx={{ fontSize: 15, color: c.text3, mb: 3 }}>הלינק שתשתף עם לקוחות כדי שיקבעו תור לבד.</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2, mb: 2.5 }}>
              <Box><Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text }}>הפעל דף הזמנות</Typography><Typography sx={{ fontSize: 12.5, color: c.text3 }}>לקוחות יוכלו לקבוע תור אונליין 24/7</Typography></Box>
              <Switch checked={bookingEnabled} onChange={(e) => setBookingEnabled(e.target.checked)} />
            </Box>
            <TextField fullWidth label="הודעת ברוכים הבאים (אופציונלי)" value={welcomeText} onChange={(e) => setWelcomeText(e.target.value)} multiline rows={2} placeholder="ברוכים הבאים! נשמח לארח אתכם 💜" />
          </>
        )}

        {/* STEP 4 — Done */}
        {step === 4 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Box sx={{ width: 88, height: 88, borderRadius: '50%', background: `linear-gradient(135deg, ${c.accent}, ${c.accentDeep})`, color: '#fff', fontSize: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3, boxShadow: `0 12px 36px ${c.accent}55` }}>✓</Box>
            <Typography sx={{ fontSize: 28, fontWeight: 900, color: c.text, letterSpacing: '-0.03em', mb: 1 }}>העסק שלך מוכן! 🎉</Typography>
            <Typography sx={{ fontSize: 15.5, color: c.text2, lineHeight: 1.6, maxWidth: 380, mx: 'auto', mb: 4 }}>הכל מוגדר. עכשiv אפשר לשתף את דף ההזמנות, להוסיף תורים, ולתת ל-Zikkit לעבוד בשבילך.</Typography>
            {bizId && (
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 3, flexWrap: 'wrap' }}>
                <Button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/book/${bizId}`); showToast('הלינק הועתק!', 'success'); }} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>📋 העתק לינק הזמנות</Button>
                <Button href={`/book/${bizId}`} target="_blank" variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>👁 תצוגה מקדימה</Button>
              </Box>
            )}
          </Box>
        )}

        {/* Nav buttons */}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 4 }}>
          {step > 0 && step < 4 && <Button onClick={() => setStep(step - 1)} sx={{ borderRadius: 2, fontWeight: 700, color: c.text3, px: 3 }}>חזרה</Button>}
          <Box sx={{ flex: 1 }} />
          {step < 4 ? (
            <Button onClick={saveStep} disabled={saving || (step === 0 && !bizName.trim())} variant="contained" sx={{ borderRadius: 2, fontWeight: 800, px: 4, py: 1.4 }}>
              {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : step === 3 ? 'סיום →' : 'המשך →'}
            </Button>
          ) : (
            <Button onClick={finish} variant="contained" sx={{ borderRadius: 2, fontWeight: 800, px: 4, py: 1.4 }}>כניסה לדאשבורד →</Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
