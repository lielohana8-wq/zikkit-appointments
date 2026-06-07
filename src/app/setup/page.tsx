'use client';

import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, IconButton, Chip,
  CircularProgress, Slider,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { zikkitColors as c } from '@/styles/theme';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface AptService {
  id: string;
  name: string;
  duration: number;
  price: string;
  whatToAsk: string;
}

interface AptConfig {
  businessName: string;
  contactName: string;
  businessType?: string;
  industry?: string;
  services: AptService[];
  stations: number;
  recurring: boolean;
  recurringInterval: number;
  voiceId: string;
  voiceName: string;
  greeting: string;
  fieldsToCollect: {
    fullName: boolean;
    phone: boolean;
    service: boolean;
    preferredDate: boolean;
    preferredStaff: boolean;
    notes: boolean;
  };
  phoneNumber?: string;
}

const VOICES = [
  { id: 'noa', name: 'נועה', letter: 'נ', color: '#4F46E5', desc: 'נעימה ומקצועית' },
  { id: 'tomer', name: 'תומר', letter: 'ת', color: '#06B6D4', desc: 'רגוע וענייני' },
  { id: 'sharon', name: 'שרון', letter: 'ש', color: '#EC4899', desc: 'חמה ואדיבה' },
  { id: 'eitan', name: 'איתן', letter: 'א', color: '#F59E0B', desc: 'אנרגטי וחברותי' },
  { id: 'maya', name: 'מאיה', letter: 'מ', color: '#8B5CF6', desc: 'צעירה ותוססת' },
];

export default function AppointmentsSetupWizard() {
  const router = useRouter();
  const { user, firebaseUser, bizId } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [provisioning, setProvisioning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDetected, setAiDetected] = useState(false);

  const [config, setConfig] = useState<AptConfig>({
    businessName: '',
    contactName: '',
    services: [],
    stations: 1,
    recurring: false,
    recurringInterval: 3,
    voiceId: 'noa',
    voiceName: 'נועה',
    greeting: '',
    fieldsToCollect: {
      fullName: true, phone: true, service: true,
      preferredDate: true, preferredStaff: false, notes: false,
    },
  });

  useEffect(() => {
    if (config.businessName && config.voiceName) {
      const voice = VOICES.find((v) => v.id === config.voiceId);
      const g = `שלום, הגעתם ל${config.businessName}, כאן ${voice?.name}, אשמח לעזור לקבוע תור!`;
      if (!config.greeting || config.greeting.includes('הגעתם ל')) {
        setConfig((p) => ({ ...p, greeting: g }));
      }
    }
  }, [config.businessName, config.voiceId, config.voiceName]);

  useEffect(() => {
    if (!firebaseUser && !user) router.push('/login');
  }, [firebaseUser, user, router]);

  const detectWithAI = async () => {
    if (!config.businessName.trim()) return;
    setAiLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/dana/suggest-appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: config.businessName }),
      });
      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
        return;
      }
      setConfig((p) => ({
        ...p,
        businessType: data.businessType,
        industry: data.industry,
        services: (data.services || []).map((s: Record<string, unknown>) => ({
          id: s.id, name: s.name, duration: s.duration || 30,
          price: String(s.price || ''), whatToAsk: s.whatToAsk || '',
        })),
        stations: data.stations || 1,
        recurring: !!data.recurring,
        recurringInterval: data.recurringInterval || 3,
        greeting: data.suggestedGreeting || p.greeting,
        fieldsToCollect: data.suggestedFields || p.fieldsToCollect,
      }));
      setAiDetected(true);
    } catch {
      setErrorMsg('שגיאה בזיהוי העסק. אפשר להמשיך ידנית.');
    } finally {
      setAiLoading(false);
    }
  };

  const next = () => setStep((s) => Math.min(8, s + 1) as Step);
  const back = () => setStep((s) => Math.max(1, s - 1) as Step);

  const canProceed = () => {
    if (step === 1) return config.businessName.trim() && config.contactName.trim();
    if (step === 2) return config.services.length > 0 && config.services.every((s) => s.name.trim());
    if (step === 4) return !!config.voiceId;
    if (step === 5) return config.greeting.trim().length > 10;
    return true;
  };

  const submit = async () => {
    setProvisioning(true);
    setErrorMsg(null);
    try {
      if (!firebaseUser) throw new Error('צריך להתחבר. רענן ונסה שוב.');
      const idToken = await firebaseUser.getIdToken();
      const userBizId = bizId || firebaseUser.uid;
      const res = await fetch('/api/dana/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'x-biz-id': userBizId,
        },
        body: JSON.stringify({ ...config, mode: 'appointments' }),
      });
      const data = await res.json();
      if (data.success) {
        setConfig((p) => ({ ...p, phoneNumber: data.phoneNumber }));
        setStep(8);
      } else {
        throw new Error(data.error || 'שגיאה לא ידועה');
      }
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setProvisioning(false);
    }
  };

  const iconCircle = (emoji: string) => (
    <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: c.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, mx: 'auto', mb: 2 }}>{emoji}</Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg, py: { xs: 3, md: 6 }, px: 2 }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        {/* Top bar */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
          <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontSize: 13, textTransform: 'none' }}>{'← חזרה'}</Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <Box key={n} sx={{ width: n === step ? 24 : 6, height: 6, borderRadius: 99, bgcolor: n <= step ? c.accent : c.surface4, transition: 'all 0.3s' }} />
            ))}
          </Box>
        </Box>

        {/* STEP 1: Identity + AI */}
        {step === 1 && (
          <Box className="zk-fade-up">
            <Box sx={{ textAlign: 'center', mb: 5 }}>
              {iconCircle('💈')}
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: c.text, mb: 1 }}>{'בוא נכיר את העסק'}</Typography>
              <Typography sx={{ fontSize: 15, color: c.text2, maxWidth: 460, mx: 'auto', lineHeight: 1.6 }}>
                {'תזין שם עסק - וה-AI יזהה את התחום ויציע שירותים, משכי זמן ומחירים'}
              </Typography>
            </Box>
            <Box sx={{ maxWidth: 480, mx: 'auto' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.text2, mb: 1 }}>{'שם העסק'}</Typography>
              <TextField fullWidth placeholder="מספרת דניאל / מכון יופי שרה" value={config.businessName}
                onChange={(e) => { setConfig((p) => ({ ...p, businessName: e.target.value })); setAiDetected(false); }}
                sx={{ mb: 2.5, '& input': { fontSize: 17, py: 1.7, textAlign: 'right' } }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.text2, mb: 1 }}>{'שם איש הקשר'}</Typography>
              <TextField fullWidth placeholder="השם שלך" value={config.contactName}
                onChange={(e) => setConfig((p) => ({ ...p, contactName: e.target.value }))}
                sx={{ mb: 3, '& input': { fontSize: 17, py: 1.7, textAlign: 'right' } }} />

              {config.businessName.trim() && !aiDetected && (
                <Button onClick={detectWithAI} disabled={aiLoading} fullWidth variant="outlined"
                  sx={{ py: 1.75, borderRadius: 3, borderColor: c.accent, color: c.accent, fontSize: 14, fontWeight: 700, bgcolor: c.accentDim, mb: 2, '&:hover': { bgcolor: c.accentMid } }}>
                  {aiLoading ? <><CircularProgress size={16} sx={{ color: c.accent, mr: 1 }} />{'מזהה...'}</> : '✨ זהה את העסק אוטומטית עם AI'}
                </Button>
              )}

              {aiDetected && config.businessType && (
                <Box className="zk-fade-up" sx={{ bgcolor: c.surface1, border: `2px solid ${c.accent}`, borderRadius: 3, p: 2.5, mb: 2 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.accent, mb: 1 }}>{'✓ זוהה אוטומטית'}</Typography>
                  <Typography sx={{ fontSize: 13, color: c.text2, mb: 1 }}><strong>{config.businessType}</strong></Typography>
                  <Chip label={config.industry} size="small" sx={{ bgcolor: c.accentDim, color: c.accent, fontWeight: 700 }} />
                  <Typography sx={{ fontSize: 12, color: c.text3, mt: 1.5, lineHeight: 1.6 }}>
                    {'הכנו '}{config.services.length}{' שירותים · '}{config.stations}{' עמדות'}
                    {config.recurring ? ' · תורים חוזרים' : ''}
                  </Typography>
                </Box>
              )}

              {errorMsg && <Box sx={{ bgcolor: c.hotDim, border: `1px solid ${c.hot}`, borderRadius: 2, p: 2 }}><Typography sx={{ fontSize: 13, color: c.hot }}>{errorMsg}</Typography></Box>}
            </Box>
          </Box>
        )}

        {/* STEP 2: Services with duration */}
        {step === 2 && (
          <Box className="zk-fade-up">
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              {iconCircle('✂️')}
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: c.text, mb: 1 }}>{'אילו טיפולים אתם מציעים?'}</Typography>
              <Typography sx={{ fontSize: 15, color: c.text2 }}>{'כל טיפול עם משך זמן ומחיר'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {config.services.map((service, idx) => (
                <AptServiceCard key={service.id} service={service} index={idx}
                  onChange={(u) => setConfig((p) => ({ ...p, services: p.services.map((s, i) => (i === idx ? u : s)) }))}
                  onDelete={() => setConfig((p) => ({ ...p, services: p.services.filter((_, i) => i !== idx) }))} />
              ))}
              <Button onClick={() => setConfig((p) => ({ ...p, services: [...p.services, { id: 'apt_' + Date.now() + Math.random(), name: '', duration: 30, price: '', whatToAsk: '' }] }))}
                fullWidth sx={{ py: 2, borderRadius: 3, border: `2px dashed ${c.border2}`, color: c.text2, fontWeight: 700, textTransform: 'none', '&:hover': { borderColor: c.accent, color: c.accent } }}>
                {'+ הוסף טיפול'}
              </Button>
            </Box>
          </Box>
        )}

        {/* STEP 3: Stations + Recurring */}
        {step === 3 && (
          <Box className="zk-fade-up">
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              {iconCircle('💺')}
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: c.text, mb: 1 }}>{'הגדרות תורים'}</Typography>
              <Typography sx={{ fontSize: 15, color: c.text2 }}>{'כמה אפשר לטפל במקביל'}</Typography>
            </Box>
            <Box sx={{ maxWidth: 480, mx: 'auto' }}>
              <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 3, p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: c.text }}>{'כמה עמדות / כיסאות?'}</Typography>
                  <Typography sx={{ fontSize: 22, fontWeight: 800, color: c.accent }}>{config.stations}</Typography>
                </Box>
                <Slider value={config.stations} onChange={(_, v) => setConfig((p) => ({ ...p, stations: v as number }))}
                  min={1} max={10} step={1} marks valueLabelDisplay="auto"
                  sx={{ color: c.accent, '& .MuiSlider-thumb': { width: 22, height: 22 } }} />
                <Typography sx={{ fontSize: 12, color: c.text3 }}>{'דנה תוכל לקבוע '}{config.stations}{' תורים במקביל באותה שעה'}</Typography>
              </Box>

              <Box onClick={() => setConfig((p) => ({ ...p, recurring: !p.recurring }))}
                sx={{ cursor: 'pointer', bgcolor: config.recurring ? c.accentDim : c.surface1, border: `2px solid ${config.recurring ? c.accent : c.border}`, borderRadius: 3, p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ fontSize: 32 }}>{'🔁'}</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: c.text }}>{'תורים חוזרים'}</Typography>
                  <Typography sx={{ fontSize: 13, color: c.text2 }}>{'דנה תציע ללקוח לקבוע תור קבוע (למשל כל '}{config.recurringInterval}{' שבועות)'}</Typography>
                </Box>
                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: config.recurring ? c.accent : c.surface4, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{config.recurring ? '✓' : ''}</Box>
              </Box>

              {config.recurring && (
                <Box className="zk-fade-up" sx={{ mt: 2, px: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: c.text2 }}>{'כל כמה שבועות?'}</Typography>
                    <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.accent }}>{config.recurringInterval}{' שבועות'}</Typography>
                  </Box>
                  <Slider value={config.recurringInterval} onChange={(_, v) => setConfig((p) => ({ ...p, recurringInterval: v as number }))}
                    min={1} max={8} step={1} sx={{ color: c.accent }} />
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* STEP 4: Voice */}
        {step === 4 && (
          <Box className="zk-fade-up">
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              {iconCircle('🎙️')}
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: c.text, mb: 1 }}>{'בחר את הקול של דנה'}</Typography>
              <Typography sx={{ fontSize: 15, color: c.text2 }}>{'5 קולות עבריים'}</Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
              {VOICES.map((v) => (
                <Box key={v.id} onClick={() => setConfig((p) => ({ ...p, voiceId: v.id, voiceName: v.name }))}
                  sx={{ cursor: 'pointer', bgcolor: c.surface1, border: `2px solid ${config.voiceId === v.id ? c.accent : c.border}`, borderRadius: 3, p: 2.5, textAlign: 'center', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)' } }}>
                  <Box sx={{ width: 60, height: 60, borderRadius: '50%', bgcolor: v.color, color: '#fff', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>{v.letter}</Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text }}>{v.name}</Typography>
                  <Typography sx={{ fontSize: 11, color: c.text3, mt: 0.5 }}>{v.desc}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* STEP 5: Personality */}
        {step === 5 && (
          <Box className="zk-fade-up">
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              {iconCircle('💬')}
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: c.text, mb: 1 }}>{'איך דנה מתחילה?'}</Typography>
              <Typography sx={{ fontSize: 15, color: c.text2 }}>{'משפט פתיחה ומה לאסוף'}</Typography>
            </Box>
            <TextField fullWidth multiline rows={3} value={config.greeting}
              onChange={(e) => setConfig((p) => ({ ...p, greeting: e.target.value }))} sx={{ mb: 3 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: c.text2, mb: 1.5 }}>{'מה דנה אוספת מהלקוח?'}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
              {[
                { id: 'fullName', label: 'שם מלא', icon: '👤' },
                { id: 'phone', label: 'טלפון', icon: '📞' },
                { id: 'service', label: 'סוג טיפול', icon: '✂️' },
                { id: 'preferredDate', label: 'יום ושעה מועדפים', icon: '📅' },
                { id: 'preferredStaff', label: 'איש צוות מועדף', icon: '🧑‍💼' },
                { id: 'notes', label: 'הערות', icon: '📝' },
              ].map((f) => {
                const on = config.fieldsToCollect[f.id as keyof typeof config.fieldsToCollect];
                return (
                  <Box key={f.id} onClick={() => setConfig((p) => ({ ...p, fieldsToCollect: { ...p.fieldsToCollect, [f.id]: !on } }))}
                    sx={{ cursor: 'pointer', bgcolor: on ? c.accentDim : c.surface1, border: `2px solid ${on ? c.accent : c.border2}`, borderRadius: 2.5, p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ fontSize: 18 }}>{f.icon}</Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: c.text, flex: 1 }}>{f.label}</Typography>
                    <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: on ? c.accent : c.surface4, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{on ? '✓' : ''}</Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* STEP 6: Review */}
        {step === 6 && (
          <Box className="zk-fade-up">
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              {iconCircle('✨')}
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: c.text, mb: 1 }}>{'בדיקה אחרונה'}</Typography>
            </Box>
            <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 4 }}>
              {[
                { label: 'עסק', value: config.businessName, icon: '💈' },
                { label: 'תחום', value: config.industry || '—', icon: '🎯' },
                { label: 'עמדות', value: String(config.stations), icon: '💺' },
                { label: 'קול', value: config.voiceName, icon: '🎙️' },
                { label: 'תורים חוזרים', value: config.recurring ? `כל ${config.recurringInterval} שבועות` : 'לא', icon: '🔁' },
              ].map((row, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: i < 4 ? `1px solid ${c.border}` : 'none' }}>
                  <Box sx={{ fontSize: 22 }}>{row.icon}</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 11, color: c.text3, fontWeight: 600 }}>{row.label}</Typography>
                    <Typography sx={{ fontSize: 14, color: c.text, fontWeight: 700 }}>{row.value}</Typography>
                  </Box>
                </Box>
              ))}
              <Box sx={{ mt: 3, pt: 3, borderTop: `1px solid ${c.border}` }}>
                <Typography sx={{ fontSize: 11, color: c.text3, fontWeight: 600, mb: 1.5 }}>{'טיפולים ('}{config.services.length}{')'}</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {config.services.map((s) => (
                    <Chip key={s.id} label={`${s.name} · ${s.duration}ד'`} size="small" sx={{ bgcolor: c.accentDim, color: c.accent, fontWeight: 700 }} />
                  ))}
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* STEP 7: Provisioning */}
        {step === 7 && (
          <Box className="zk-fade-up" sx={{ textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{ fontSize: 80, mb: 3 }}>{'🚀'}</Box>
            <Typography sx={{ fontSize: 32, fontWeight: 800, color: c.text, mb: 1 }}>{'בונים את הסוכן שלך'}</Typography>
            <Typography sx={{ fontSize: 15, color: c.text2, mb: 4 }}>{'זה ייקח כ-30 שניות'}</Typography>
            {errorMsg && <Box sx={{ bgcolor: c.hotDim, border: `1px solid ${c.hot}`, borderRadius: 3, p: 2.5, mb: 3, maxWidth: 460, mx: 'auto' }}><Typography sx={{ fontSize: 13, color: c.hot, fontWeight: 600 }}>{errorMsg}</Typography></Box>}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 420, mx: 'auto' }}>
              {['יוצר סוכן AI לתורים', 'מקצה מספר טלפון', 'מחבר את ' + config.voiceName, 'משלים הגדרות'].map((s, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: c.surface1, borderRadius: 2.5, border: `1px solid ${c.border}` }}>
                  {provisioning ? <CircularProgress size={18} sx={{ color: c.accent }} /> : <Box sx={{ color: c.text3, fontSize: 18 }}>{'○'}</Box>}
                  <Typography sx={{ fontSize: 14, color: c.text, fontWeight: 600 }}>{s}</Typography>
                </Box>
              ))}
            </Box>
            {!provisioning && (
              <Button onClick={submit} variant="contained" size="large" sx={{ mt: 4, py: 2, fontSize: 16, fontWeight: 800, borderRadius: 3, maxWidth: 420, mx: 'auto' }}>
                {errorMsg ? '🔄 נסה שוב' : '✨ צור את הסוכן'}
              </Button>
            )}
          </Box>
        )}

        {/* STEP 8: Success */}
        {step === 8 && (
          <Box className="zk-fade-up" sx={{ textAlign: 'center', py: 4 }}>
            <Box sx={{ width: 100, height: 100, borderRadius: '50%', background: `linear-gradient(135deg, ${c.accent}, ${c.accent2})`, color: '#fff', fontSize: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3, boxShadow: '0 20px 50px rgba(79,70,229,0.3)' }}>{'🎉'}</Box>
            <Typography sx={{ fontSize: 36, fontWeight: 800, color: c.text, mb: 1 }}>{config.voiceName}{' מוכנה!'}</Typography>
            <Typography sx={{ fontSize: 16, color: c.text2, mb: 5 }}>{'לקוחות יתקשרו ויקבעו תור אוטומטית 24/7'}</Typography>
            <Box sx={{ bgcolor: c.surface1, border: `2px solid ${c.accent}`, borderRadius: 4, p: 4, maxWidth: 460, mx: 'auto', mb: 4 }}>
              <Typography sx={{ fontSize: 11, color: c.text3, fontWeight: 700, mb: 1, letterSpacing: 1 }}>{'מספר קביעת התורים שלך'}</Typography>
              <Typography sx={{ fontSize: 36, fontWeight: 800, color: c.accent, fontFamily: 'monospace', letterSpacing: 1, mb: 2 }}>{config.phoneNumber || '+972-50-123-4567'}</Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Button variant="outlined" onClick={() => { if (config.phoneNumber) navigator.clipboard.writeText(config.phoneNumber); }} sx={{ borderRadius: 3, fontWeight: 600 }}>{'📋 העתק'}</Button>
                {config.phoneNumber && <Button variant="contained" href={`tel:${config.phoneNumber}`} sx={{ borderRadius: 3, fontWeight: 700 }}>{'📞 התקשר'}</Button>}
              </Box>
            </Box>
            <Button variant="contained" size="large" onClick={() => router.push('/dashboard')} sx={{ py: 2, px: 6, fontSize: 16, fontWeight: 800, borderRadius: 3 }}>{'עבור לדאשבורד →'}</Button>
          </Box>
        )}

        {/* Nav */}
        {step >= 1 && step <= 6 && (
          <Box sx={{ display: 'flex', gap: 2, mt: 6, maxWidth: 480, mx: 'auto' }}>
            {step > 1 && <Button onClick={back} fullWidth variant="outlined" sx={{ py: 1.75, borderRadius: 3, fontWeight: 700 }}>{'← חזרה'}</Button>}
            <Button onClick={step === 6 ? () => setStep(7) : next} disabled={!canProceed()} fullWidth variant="contained" sx={{ py: 1.75, borderRadius: 3, fontWeight: 800, fontSize: 15 }}>{step === 6 ? 'אישור והמשך ✓' : 'המשך →'}</Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function AptServiceCard({ service, index, onChange, onDelete }: { service: AptService; index: number; onChange: (s: AptService) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.accent}`, borderRadius: 3, p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: expanded ? 2 : 0 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: c.accentDim, color: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{index + 1}</Box>
        <TextField placeholder="שם הטיפול" value={service.name} onChange={(e) => onChange({ ...service, name: e.target.value })} variant="standard" fullWidth InputProps={{ disableUnderline: true, sx: { fontWeight: 700, fontSize: 15 } }} />
        <Chip label={`${service.duration}ד'`} size="small" sx={{ bgcolor: c.accentDim, color: c.accent, fontWeight: 700 }} />
        {service.price && <Chip label={`₪${service.price}`} size="small" sx={{ bgcolor: c.surface3, color: c.text2, fontWeight: 700 }} />}
        <IconButton onClick={() => setExpanded(!expanded)} sx={{ color: c.text3 }}>{expanded ? '▲' : '▼'}</IconButton>
        <IconButton onClick={onDelete} sx={{ color: c.hot }}>{'✕'}</IconButton>
      </Box>
      {expanded && (
        <Box className="zk-fade-up" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ px: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: c.text2 }}>{'משך הטיפול'}</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.accent }}>{service.duration}{' דקות'}</Typography>
            </Box>
            <Slider value={service.duration} onChange={(_, v) => onChange({ ...service, duration: v as number })} min={15} max={180} step={15} sx={{ color: c.accent }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: c.text2, mb: 0.5 }}>{'מחיר (₪)'}</Typography>
            <TextField fullWidth size="small" type="number" placeholder="120" value={service.price} onChange={(e) => onChange({ ...service, price: e.target.value })} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: c.text2, mb: 0.5 }}>{'מה דנה צריכה לשאול?'}</Typography>
            <TextField fullWidth multiline rows={2} size="small" placeholder="לדוגמה: גבר/אישה, אורך שיער, האם הייתה כבר אצלנו" value={service.whatToAsk} onChange={(e) => onChange({ ...service, whatToAsk: e.target.value })} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
