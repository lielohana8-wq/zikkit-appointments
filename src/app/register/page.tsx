'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Button, TextField, CircularProgress, Divider } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { ZikkitLogo } from '@/components/ZikkitLogo';
import { zikkitColors as c } from '@/styles/theme';

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle, firebaseUser, error, clearError } = useAuth();
  const [bizName, setBizName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (firebaseUser) router.push('/dashboard'); }, [firebaseUser, router]);

  const handleRegister = async () => {
    setLoading(true);
    clearError();
    try { await register(email, password, bizName); } catch {} finally { setLoading(false); }
  };

  const perks = ['יומן תורים חכם', 'דף הזמנות ממותג', 'אוטומציות SMS', 'ניהול צוות ולקוחות'];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', top: '-15%', left: '-10%', width: 420, height: 420, borderRadius: '50%', background: `radial-gradient(circle, ${c.accentMid}, transparent 70%)`, filter: 'blur(45px)' }} />

      <Box className="zk-fade-up" sx={{ maxWidth: 400, width: '100%', position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <ZikkitLogo size={48} />
        </Box>
        <Box sx={{ bgcolor: c.surface1, borderRadius: 6, p: { xs: 3, sm: 4.5 }, boxShadow: c.shadowLg, border: `1px solid ${c.border}` }}>
          <Typography sx={{ fontSize: 24, fontWeight: 800, textAlign: 'center', color: c.text, letterSpacing: '-0.02em' }}>נתחיל לעבוד</Typography>
          <Typography sx={{ fontSize: 14.5, color: c.text3, textAlign: 'center', mb: 3, mt: 0.5 }}>גישה מלאה חינם בתקופת הפיילוט</Typography>

          {/* Perks */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center', mb: 3 }}>
            {perks.map((p) => (
              <Box key={p} sx={{ fontSize: 12, fontWeight: 600, color: c.accent, bgcolor: c.accentDim, borderRadius: 99, px: 1.5, py: 0.5 }}>✓ {p}</Box>
            ))}
          </Box>

          <Button onClick={() => loginWithGoogle()} fullWidth variant="outlined" sx={{ py: 1.4, borderRadius: 3, mb: 2.5, fontWeight: 600, fontSize: 14.5, gap: 1 }}>
            <Box component="span" sx={{ fontSize: 17 }}>🔵</Box> הרשמה עם Google
          </Button>
          <Divider sx={{ my: 2.5, fontSize: 12, color: c.text3, '&::before, &::after': { borderColor: c.border } }}>או</Divider>

          <TextField fullWidth placeholder="שם העסק" value={bizName} onChange={(e) => setBizName(e.target.value)} sx={{ mb: 1.75 }} />
          <TextField fullWidth placeholder="אימייל" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 1.75 }} />
          <TextField fullWidth type="password" placeholder="סיסמה (6+ תווים)" value={password} onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRegister()} sx={{ mb: 2 }} />

          {error && <Box sx={{ bgcolor: c.hotDim, borderRadius: 2.5, px: 2, py: 1.25, mb: 2 }}><Typography sx={{ fontSize: 13, color: c.hot, fontWeight: 500 }}>{error}</Typography></Box>}

          <Button onClick={handleRegister} disabled={loading || !bizName || !email || password.length < 6} fullWidth variant="contained" sx={{ py: 1.5, borderRadius: 3, fontWeight: 700, fontSize: 15.5 }}>
            {loading ? <CircularProgress size={21} sx={{ color: '#fff' }} /> : 'יצירת חשבון'}
          </Button>
        </Box>

        <Typography sx={{ fontSize: 14, color: c.text2, textAlign: 'center', mt: 3 }}>
          כבר יש לכם חשבון?{' '}
          <Box component="span" onClick={() => router.push('/login')} sx={{ color: c.accent, fontWeight: 700, cursor: 'pointer' }}>התחברו</Box>
        </Typography>
      </Box>
    </Box>
  );
}
