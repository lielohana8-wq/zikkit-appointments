'use client';

import { useState, useEffect, Suspense } from 'react';
import { Box, Typography, Button, TextField, CircularProgress, Divider, IconButton } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { ZikkitLogo } from '@/components/ZikkitLogo';
import { zikkitColors as c } from '@/styles/theme';

type View = 'landing' | 'login' | 'request' | 'sent' | 'signup';

export default function AuthPageWrapper() {
  return (
    <Suspense fallback={<Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg }}><CircularProgress sx={{ color: c.accent }} /></Box>}>
      <AuthPage />
    </Suspense>
  );
}

function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle, register, firebaseUser, error, clearError } = useAuth();
  const [view, setView] = useState<View>('landing');
  const [bizName, setBizName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Pilot request form
  const [reqName, setReqName] = useState('');
  const [reqPhone, setReqPhone] = useState('');
  const [reqBizType, setReqBizType] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqError, setReqError] = useState('');
  // Invite-code signup
  const [inviteCode, setInviteCode] = useState('');
  const [signupError, setSignupError] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);

  useEffect(() => { if (searchParams.get('register')) setView('request'); }, [searchParams]);
  useEffect(() => { if (firebaseUser) router.push('/dashboard'); }, [firebaseUser, router]);

  const handleSubmit = async () => {
    setLoading(true);
    clearError();
    try {
      await login(email, password);
    } catch {} finally { setLoading(false); }
  };

  const submitRequest = async () => {
    setReqError('');
    if (!reqName.trim() || !reqPhone.trim()) { setReqError('צריך לפחות שם וטלפון'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/pilot-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: reqName, bizName, phone: reqPhone, email, bizType: reqBizType, note: reqNote }),
      });
      const data = await res.json();
      if (data.success) setView('sent');
      else setReqError(data.error || 'משהו השתבש, נסו שוב');
    } catch (e) {
      setReqError((e as Error).message);
    } finally { setLoading(false); }
  };

  const goTo = (v: View) => { clearError(); setView(v); };

  // Invite-code signup: verify code, then create the account.
  const verifyAndSignup = async () => {
    setSignupError('');
    if (!inviteCode.trim()) { setSignupError('צריך קוד הזמנה'); return; }
    if (!email.trim() || !password.trim()) { setSignupError('צריך אימייל וסיסמה'); return; }
    if (password.length < 6) { setSignupError('הסיסמה צריכה לפחות 6 תווים'); return; }
    setLoading(true);
    try {
      // 1. Verify the invite code
      const vr = await fetch('/api/verify-invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      const vdata = await vr.json();
      if (!vdata.valid) { setSignupError(vdata.error || 'קוד לא תקין'); setLoading(false); return; }

      // 2. Create the Firebase account (register also seeds the biz doc + trial)
      await register(email.trim(), password, vdata.lead?.bizName || bizName || 'העסק שלי');

      // 3. Mark the code as used
      await fetch('/api/verify-invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim(), markUsed: true }),
      });
      // AuthProvider redirect effect will take over → onboarding via dashboard
      router.push('/onboarding');
    } catch (e) {
      setSignupError((e as Error).message.includes('email') ? 'האימייל כבר רשום — נסה להתחבר' : 'ההרשמה נכשלה, נסה שוב');
    } finally { setLoading(false); }
  };


  const features = [
    { icon: '📅', title: 'יומן תורים חכם', desc: 'נהל את כל התורים במקום אחד' },
    { icon: '🔗', title: 'דף הזמנות ממותג', desc: 'לקוחות קובעים תור לבד 24/7' },
    { icon: '⚡', title: 'אוטומציות SMS', desc: 'אישורים ותזכורות אוטומטית' },
    { icon: '📞', title: 'דנה — מענה אוטומטי', desc: 'עוזרת AI שעונה לטלפון' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg, position: 'relative', overflow: 'hidden', direction: 'rtl' }}>
      {/* subtle grid texture instead of orbs */}
      <Box sx={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: `linear-gradient(${c.border2} 1px, transparent 1px), linear-gradient(90deg, ${c.border2} 1px, transparent 1px)`, backgroundSize: '64px 64px', pointerEvents: 'none', maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)' }} />

      {/* ===== LANDING VIEW ===== */}
      {view === 'landing' && (
        <Box className="zk-fade-up" sx={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {/* Top bar */}
          <Box sx={{ px: { xs: 3, sm: 6 }, py: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <ZikkitLogo useImage size={28} />
            <Button onClick={() => goTo('login')} sx={{ fontWeight: 600, color: c.text2 }}>כניסה</Button>
          </Box>

          {/* Hero */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 3, py: 4, maxWidth: 680, mx: 'auto' }}>
            <Box sx={{ bgcolor: c.accentDim, color: c.accent, fontWeight: 700, fontSize: 13, borderRadius: 99, px: 2, py: 0.75, mb: 3 }}>
              ✦ מערכת ניהול התורים החכמה לעסקים
            </Box>
            <Typography sx={{ fontSize: { xs: 46, sm: 72 }, fontWeight: 900, color: c.text, letterSpacing: '-0.055em', lineHeight: 0.92, mb: 3 }}>
              היומן שלך מתמלא.<br />
              <Box component="span" sx={{ color: c.accent }}>גם כשאתה עובד.</Box>
            </Typography>
            <Typography sx={{ fontSize: { xs: 16, sm: 19 }, color: c.text2, maxWidth: 520, mb: 4, lineHeight: 1.6 }}>
              ניהול תורים, דף הזמנות ממותג, אוטומציות ולקוחות — הכל במקום אחד. למספרות, מכוני יופי, קליניקות ועוד.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button onClick={() => goTo('request')} variant="contained" sx={{ py: 1.6, px: 4, borderRadius: 1.5, fontWeight: 700, fontSize: 16 }}>התחל בחינם →</Button>
              <Button onClick={() => goTo('login')} variant="outlined" sx={{ py: 1.6, px: 4, borderRadius: 1.5, fontWeight: 600, fontSize: 16 }}>יש לי כבר חשבון</Button>
            </Box>
          </Box>

          {/* Feature strip */}
          <Box sx={{ maxWidth: 920, mx: 'auto', width: '100%', px: { xs: 3, sm: 6 }, pb: 6 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
              {features.map((f) => (
                <Box key={f.title} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2, p: 2.5 }}>
                  <Box sx={{ fontSize: 28, mb: 1 }}>{f.icon}</Box>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: c.text, mb: 0.25 }}>{f.title}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: c.text3, lineHeight: 1.5 }}>{f.desc}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {/* ===== LOGIN VIEW (existing approved users only) ===== */}
      {view === 'login' && (
        <Box sx={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Box className="zk-fade-up" sx={{ maxWidth: 400, width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', mb: 3 }}>
              <IconButton onClick={() => goTo('landing')} sx={{ position: 'absolute', right: 0, color: c.text3 }}>→</IconButton>
              <ZikkitLogo useImage size={40} />
            </Box>

            <Box sx={{ bgcolor: c.surface1, borderRadius: 2, p: { xs: 3, sm: 4.5 }, boxShadow: c.shadowLg, border: `1px solid ${c.border2}` }}>
              <Typography sx={{ fontSize: 24, fontWeight: 800, textAlign: 'center', color: c.text, letterSpacing: '-0.02em' }}>ברוכים השבים</Typography>
              <Typography sx={{ fontSize: 14.5, color: c.text3, textAlign: 'center', mb: 3, mt: 0.5 }}>התחברו כדי לנהל את העסק שלכם</Typography>

              <Button onClick={() => loginWithGoogle()} fullWidth variant="outlined" sx={{ py: 1.4, borderRadius: 1.5, mb: 2.5, fontWeight: 600, fontSize: 14.5, gap: 1 }}>
                <Box component="span" sx={{ fontSize: 17 }}>🔵</Box> המשך עם Google
              </Button>
              <Divider sx={{ my: 2.5, fontSize: 12, color: c.text3, '&::before, &::after': { borderColor: c.border } }}>או באמצעות אימייל</Divider>

              <TextField fullWidth placeholder="אימייל" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 1.75 }} />
              <TextField fullWidth type="password" placeholder="סיסמה" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} sx={{ mb: 2 }} />

              {error && <Box sx={{ bgcolor: c.hotDim, borderRadius: 2.5, px: 2, py: 1.25, mb: 2 }}><Typography sx={{ fontSize: 13, color: c.hot, fontWeight: 500 }}>{error}</Typography></Box>}

              <Button onClick={handleSubmit} disabled={loading} fullWidth variant="contained" sx={{ py: 1.5, borderRadius: 1.5, fontWeight: 700, fontSize: 15.5 }}>
                {loading ? <CircularProgress size={21} sx={{ color: '#fff' }} /> : 'התחברות'}
              </Button>
            </Box>

            <Typography sx={{ fontSize: 14, color: c.text2, textAlign: 'center', mt: 3 }}>
              עדיין לא בפיילוט?{' '}
              <Box component="span" onClick={() => goTo('request')} sx={{ color: c.accent, fontWeight: 700, cursor: 'pointer' }}>בקשו גישה</Box>
            </Typography>
          </Box>
        </Box>
      )}

      {/* ===== PILOT REQUEST VIEW (gated signup) ===== */}
      {view === 'request' && (
        <Box sx={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Box className="zk-fade-up" sx={{ maxWidth: 420, width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', mb: 3 }}>
              <IconButton onClick={() => goTo('landing')} sx={{ position: 'absolute', right: 0, color: c.text3 }}>→</IconButton>
              <ZikkitLogo useImage size={40} />
            </Box>

            <Box sx={{ bgcolor: c.surface1, borderRadius: 2, p: { xs: 3, sm: 4.5 }, boxShadow: c.shadowLg, border: `1px solid ${c.border2}` }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, bgcolor: c.accentDim, color: c.accent, borderRadius: 99, px: 1.5, py: 0.5, fontSize: 12.5, fontWeight: 700, mb: 1.5 }}>🎁 פיילוט · חינם</Box>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: c.text, letterSpacing: '-0.02em' }}>בקשה להצטרף לפיילוט</Typography>
              <Typography sx={{ fontSize: 14, color: c.text3, mb: 3, mt: 0.5, lineHeight: 1.5 }}>אנחנו בוחרים בקפידה את העסקים הראשונים. השאירו פרטים ונחזור אליכם אישית.</Typography>

              <TextField fullWidth placeholder="שם מלא *" value={reqName} onChange={(e) => setReqName(e.target.value)} sx={{ mb: 1.75 }} />
              <TextField fullWidth placeholder="טלפון *" value={reqPhone} onChange={(e) => setReqPhone(e.target.value)} sx={{ mb: 1.75 }} />
              <TextField fullWidth placeholder="שם העסק" value={bizName} onChange={(e) => setBizName(e.target.value)} sx={{ mb: 1.75 }} />
              <TextField fullWidth select placeholder="סוג העסק" value={reqBizType} onChange={(e) => setReqBizType(e.target.value)} sx={{ mb: 1.75 }} SelectProps={{ native: true }}>
                <option value="">סוג העסק...</option>
                {['מספרה', 'קוסמטיקה', 'מניקור/פדיקור', 'מכון יופי', 'עיסוי וספא', 'קליניקה', 'רפואת שיניים', 'וטרינר', 'אחר'].map((t) => <option key={t} value={t}>{t}</option>)}
              </TextField>
              <TextField fullWidth placeholder="אימייל (לא חובה)" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 1.75 }} />
              <TextField fullWidth placeholder="משהו שנרצה לדעת? (לא חובה)" value={reqNote} onChange={(e) => setReqNote(e.target.value)} multiline rows={2} sx={{ mb: 2 }} />

              {reqError && <Box sx={{ bgcolor: c.hotDim, borderRadius: 2.5, px: 2, py: 1.25, mb: 2 }}><Typography sx={{ fontSize: 13, color: c.hot, fontWeight: 500 }}>{reqError}</Typography></Box>}

              <Button onClick={submitRequest} disabled={loading || !reqName.trim() || !reqPhone.trim()} fullWidth variant="contained" sx={{ py: 1.5, borderRadius: 1.5, fontWeight: 700, fontSize: 15.5 }}>
                {loading ? <CircularProgress size={21} sx={{ color: '#fff' }} /> : 'שליחת בקשה'}
              </Button>
            </Box>

            <Typography sx={{ fontSize: 14, color: c.text2, textAlign: 'center', mt: 3 }}>
              יש לכם קוד הזמנה?{' '}
              <Box component="span" onClick={() => goTo('signup')} sx={{ color: c.accent, fontWeight: 700, cursor: 'pointer' }}>הירשמו כאן</Box>
            </Typography>
            <Typography sx={{ fontSize: 14, color: c.text2, textAlign: 'center', mt: 1 }}>
              כבר יש לכם חשבון?{' '}
              <Box component="span" onClick={() => goTo('login')} sx={{ color: c.accent, fontWeight: 700, cursor: 'pointer' }}>התחברו</Box>
            </Typography>
          </Box>
        </Box>
      )}

      {/* ===== SIGNUP WITH INVITE CODE ===== */}
      {view === 'signup' && (
        <Box sx={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Box className="zk-fade-up" sx={{ maxWidth: 420, width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', mb: 3 }}>
              <IconButton onClick={() => goTo('request')} sx={{ position: 'absolute', right: 0, color: c.text3 }}>→</IconButton>
              <ZikkitLogo useImage size={40} />
            </Box>
            <Box sx={{ bgcolor: c.surface1, borderRadius: 2, p: { xs: 3, sm: 4.5 }, boxShadow: c.shadowLg, border: `1px solid ${c.border2}` }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, bgcolor: c.accentDim, color: c.accent, borderRadius: 99, px: 1.5, py: 0.5, fontSize: 12.5, fontWeight: 700, mb: 1.5 }}>🎉 אושרת לפיילוט</Box>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: c.text, letterSpacing: '-0.02em' }}>יצירת החשבון שלך</Typography>
              <Typography sx={{ fontSize: 14, color: c.text3, mb: 3, mt: 0.5, lineHeight: 1.5 }}>הזן את קוד ההזמנה שקיבלת, בחר אימייל וסיסמה — והעסק שלך מוכן.</Typography>

              <TextField fullWidth placeholder="קוד הזמנה (ZK-XXXX)" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} sx={{ mb: 1.75, '& input': { fontFamily: 'monospace', letterSpacing: '0.1em', fontWeight: 700 } }} />
              <TextField fullWidth placeholder="שם העסק" value={bizName} onChange={(e) => setBizName(e.target.value)} sx={{ mb: 1.75 }} />
              <TextField fullWidth type="email" placeholder="אימייל *" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 1.75 }} />
              <TextField fullWidth type="password" placeholder="סיסמה (6+ תווים) *" value={password} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 2 }} />

              {signupError && <Box sx={{ bgcolor: c.hotDim, borderRadius: 2.5, px: 2, py: 1.25, mb: 2 }}><Typography sx={{ fontSize: 13, color: c.hot, fontWeight: 500 }}>{signupError}</Typography></Box>}

              <Button onClick={verifyAndSignup} disabled={loading || !inviteCode.trim() || !email.trim() || !password.trim()} fullWidth variant="contained" sx={{ py: 1.5, borderRadius: 1.5, fontWeight: 700, fontSize: 15.5 }}>
                {loading ? <CircularProgress size={21} sx={{ color: '#fff' }} /> : 'צור חשבון והתחל →'}
              </Button>
            </Box>
            <Typography sx={{ fontSize: 14, color: c.text2, textAlign: 'center', mt: 3 }}>
              אין לכם קוד עדיין?{' '}
              <Box component="span" onClick={() => goTo('request')} sx={{ color: c.accent, fontWeight: 700, cursor: 'pointer' }}>בקשו גישה</Box>
            </Typography>
          </Box>
        </Box>
      )}

      {/* ===== REQUEST SENT (thank you) ===== */}
      {view === 'sent' && (
        <Box sx={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Box className="zk-fade-up" sx={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <Box sx={{ width: 88, height: 88, borderRadius: '50%', bgcolor: c.accent, color: '#fff', fontSize: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>✓</Box>
            <Typography sx={{ fontSize: 28, fontWeight: 900, color: c.text, letterSpacing: '-0.03em', mb: 1.5 }}>קיבלנו את הבקשה!</Typography>
            <Typography sx={{ fontSize: 16, color: c.text2, lineHeight: 1.6, mb: 4, maxWidth: 340, mx: 'auto' }}>
              תודה {reqName ? reqName.split(' ')[0] : ''}! נעבור על הפרטים וניצור איתכם קשר אישית בהקדם כדי לפתוח לכם גישה לפיילוט.
            </Typography>
            <Button onClick={() => goTo('landing')} variant="outlined" sx={{ borderRadius: 1.5, fontWeight: 700, px: 4, py: 1.25 }}>חזרה לדף הבית</Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
