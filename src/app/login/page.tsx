'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Button, TextField, CircularProgress, Divider } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { ZikkitLogo } from '@/components/ZikkitLogo';
import { zikkitColors as c } from '@/styles/theme';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle, firebaseUser, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (firebaseUser) router.push('/dashboard'); }, [firebaseUser, router]);

  const handleLogin = async () => {
    setLoading(true);
    clearError();
    try { await login(email, password); } catch {} finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient orbs */}
      <Box sx={{ position: 'absolute', top: '-15%', right: '-10%', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${c.accentMid}, transparent 70%)`, filter: 'blur(40px)' }} />
      <Box sx={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 460, height: 460, borderRadius: '50%', background: `radial-gradient(circle, rgba(144,97,249,0.10), transparent 70%)`, filter: 'blur(50px)' }} />

      <Box className="zk-fade-up" sx={{ maxWidth: 400, width: '100%', position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <ZikkitLogo size={48} />
        </Box>
        <Box sx={{ bgcolor: c.surface1, borderRadius: 6, p: { xs: 3, sm: 4.5 }, boxShadow: c.shadowLg, border: `1px solid ${c.border}` }}>
          <Typography sx={{ fontSize: 24, fontWeight: 800, textAlign: 'center', color: c.text, letterSpacing: '-0.02em' }}>ברוכים השבים</Typography>
          <Typography sx={{ fontSize: 14.5, color: c.text3, textAlign: 'center', mb: 3.5, mt: 0.5 }}>התחברו כדי לנהל את העסק שלכם</Typography>

          <Button onClick={() => loginWithGoogle()} fullWidth variant="outlined" sx={{ py: 1.4, borderRadius: 3, mb: 2.5, fontWeight: 600, fontSize: 14.5, gap: 1 }}>
            <Box component="span" sx={{ fontSize: 17 }}>🔵</Box> המשך עם Google
          </Button>
          <Divider sx={{ my: 2.5, fontSize: 12, color: c.text3, '&::before, &::after': { borderColor: c.border } }}>או באמצעות אימייל</Divider>

          <TextField fullWidth placeholder="אימייל" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 1.75 }} />
          <TextField fullWidth type="password" placeholder="סיסמה" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()} sx={{ mb: 2 }} />

          {error && <Box sx={{ bgcolor: c.hotDim, borderRadius: 2.5, px: 2, py: 1.25, mb: 2 }}><Typography sx={{ fontSize: 13, color: c.hot, fontWeight: 500 }}>{error}</Typography></Box>}

          <Button onClick={handleLogin} disabled={loading} fullWidth variant="contained" sx={{ py: 1.5, borderRadius: 3, fontWeight: 700, fontSize: 15.5 }}>
            {loading ? <CircularProgress size={21} sx={{ color: '#fff' }} /> : 'התחברות'}
          </Button>
        </Box>

        <Typography sx={{ fontSize: 14, color: c.text2, textAlign: 'center', mt: 3 }}>
          אין לכם חשבון עדיין?{' '}
          <Box component="span" onClick={() => router.push('/register')} sx={{ color: c.accent, fontWeight: 700, cursor: 'pointer' }}>הצטרפו לפיילוט</Box>
        </Typography>
      </Box>
    </Box>
  );
}
