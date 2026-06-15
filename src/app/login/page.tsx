'use client';

import { useState, useEffect, Suspense } from 'react';
import { Box, Typography, Button, TextField, CircularProgress, Divider, IconButton } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { ZikkitLogo } from '@/components/ZikkitLogo';
import { zikkitColors as c } from '@/styles/theme';

type View = 'landing' | 'login' | 'register';

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
  const { login, register, loginWithGoogle, firebaseUser, error, clearError } = useAuth();
  const [view, setView] = useState<View>('landing');
  const [bizName, setBizName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (searchParams.get('register')) setView('register'); }, [searchParams]);
  useEffect(() => { if (firebaseUser) router.push('/dashboard'); }, [firebaseUser, router]);

  const handleSubmit = async () => {
    setLoading(true);
    clearError();
    try {
      if (view === 'register') await register(email, password, bizName);
      else await login(email, password);
    } catch {} finally { setLoading(false); }
  };

  const goTo = (v: View) => { clearError(); setView(v); };

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
              <Button onClick={() => goTo('register')} variant="contained" sx={{ py: 1.6, px: 4, borderRadius: 3, fontWeight: 700, fontSize: 16 }}>התחל בחינם →</Button>
              <Button onClick={() => goTo('login')} variant="outlined" sx={{ py: 1.6, px: 4, borderRadius: 3, fontWeight: 600, fontSize: 16 }}>יש לי כבר חשבון</Button>
            </Box>
          </Box>

          {/* Feature strip */}
          <Box sx={{ maxWidth: 920, mx: 'auto', width: '100%', px: { xs: 3, sm: 6 }, pb: 6 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 2 }}>
              {features.map((f) => (
                <Box key={f.title} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 4, p: 2.5, boxShadow: c.shadowSm }}>
                  <Box sx={{ fontSize: 28, mb: 1 }}>{f.icon}</Box>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: c.text, mb: 0.25 }}>{f.title}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: c.text3, lineHeight: 1.5 }}>{f.desc}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {/* ===== AUTH FORM VIEW (login/register) ===== */}
      {view !== 'landing' && (
        <Box sx={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Box className="zk-fade-up" sx={{ maxWidth: 400, width: '100%' }}>
            {/* Back + logo */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', mb: 3 }}>
              <IconButton onClick={() => goTo('landing')} sx={{ position: 'absolute', right: 0, color: c.text3 }}>→</IconButton>
              <ZikkitLogo useImage size={40} />
            </Box>

            <Box sx={{ bgcolor: c.surface1, borderRadius: 6, p: { xs: 3, sm: 4.5 }, boxShadow: c.shadowLg, border: `1px solid ${c.border2}` }}>
              <Typography sx={{ fontSize: 24, fontWeight: 800, textAlign: 'center', color: c.text, letterSpacing: '-0.02em' }}>
                {view === 'register' ? 'נתחיל לעבוד' : 'ברוכים השבים'}
              </Typography>
              <Typography sx={{ fontSize: 14.5, color: c.text3, textAlign: 'center', mb: 3, mt: 0.5 }}>
                {view === 'register' ? 'גישה מלאה חינם בתקופת הפיילוט' : 'התחברו כדי לנהל את העסק שלכם'}
              </Typography>

              <Button onClick={() => loginWithGoogle()} fullWidth variant="outlined" sx={{ py: 1.4, borderRadius: 3, mb: 2.5, fontWeight: 600, fontSize: 14.5, gap: 1 }}>
                <Box component="span" sx={{ fontSize: 17 }}>🔵</Box> המשך עם Google
              </Button>
              <Divider sx={{ my: 2.5, fontSize: 12, color: c.text3, '&::before, &::after': { borderColor: c.border } }}>או באמצעות אימייל</Divider>

              {view === 'register' && <TextField fullWidth placeholder="שם העסק" value={bizName} onChange={(e) => setBizName(e.target.value)} sx={{ mb: 1.75 }} />}
              <TextField fullWidth placeholder="אימייל" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 1.75 }} />
              <TextField fullWidth type="password" placeholder={view === 'register' ? 'סיסמה (6+ תווים)' : 'סיסמה'} value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} sx={{ mb: 2 }} />

              {error && <Box sx={{ bgcolor: c.hotDim, borderRadius: 2.5, px: 2, py: 1.25, mb: 2 }}><Typography sx={{ fontSize: 13, color: c.hot, fontWeight: 500 }}>{error}</Typography></Box>}

              <Button onClick={handleSubmit} disabled={loading || (view === 'register' && (!bizName || !email || password.length < 6))} fullWidth variant="contained" sx={{ py: 1.5, borderRadius: 3, fontWeight: 700, fontSize: 15.5 }}>
                {loading ? <CircularProgress size={21} sx={{ color: '#fff' }} /> : view === 'register' ? 'יצירת חשבון' : 'התחברות'}
              </Button>
            </Box>

            <Typography sx={{ fontSize: 14, color: c.text2, textAlign: 'center', mt: 3 }}>
              {view === 'register' ? 'כבר יש לכם חשבון? ' : 'אין לכם חשבון עדיין? '}
              <Box component="span" onClick={() => goTo(view === 'register' ? 'login' : 'register')} sx={{ color: c.accent, fontWeight: 700, cursor: 'pointer' }}>
                {view === 'register' ? 'התחברו' : 'הצטרפו לפיילוט'}
              </Box>
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
