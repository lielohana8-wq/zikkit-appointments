'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Button, TextField, CircularProgress, Divider } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { zikkitColors as c } from '@/styles/theme';

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle, firebaseUser, error, clearError } = useAuth();
  const [bizName, setBizName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (firebaseUser) router.push('/setup'); }, [firebaseUser, router]);

  const handleRegister = async () => {
    setLoading(true);
    clearError();
    try { await register(email, password, bizName); } catch {} finally { setLoading(false); }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Box sx={{ maxWidth: 420, width: '100%', bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 4 }}>
        <Typography sx={{ fontFamily: 'Sora, sans-serif', fontSize: 24, fontWeight: 800, textAlign: 'center', mb: 1, color: c.text }}>
          הצטרף לפיילוט
        </Typography>
        <Typography sx={{ fontSize: 14, color: c.text2, textAlign: 'center', mb: 4 }}>גישה מלאה חינם בתקופת הפיילוט</Typography>

        <Button onClick={() => loginWithGoogle()} fullWidth variant="outlined" sx={{ py: 1.5, borderRadius: 3, mb: 2, fontWeight: 700, borderColor: c.border2 }}>
          הרשמה עם Google
        </Button>
        <Divider sx={{ my: 2, fontSize: 12, color: c.text3 }}>או</Divider>

        <TextField fullWidth placeholder="שם העסק" value={bizName} onChange={(e) => setBizName(e.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth placeholder="אימייל" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth type="password" placeholder="סיסמה (6+ תווים)" value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRegister()} sx={{ mb: 2 }} />

        {error && <Typography sx={{ fontSize: 13, color: c.hot, mb: 2 }}>{error}</Typography>}

        <Button onClick={handleRegister} disabled={loading || !bizName || !email || password.length < 6} fullWidth variant="contained" sx={{ py: 1.5, borderRadius: 3, fontWeight: 800 }}>
          {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'צור חשבון'}
        </Button>

        <Typography sx={{ fontSize: 13, color: c.text2, textAlign: 'center', mt: 3 }}>
          כבר יש לך חשבון?{' '}
          <Box component="span" onClick={() => router.push('/login')} sx={{ color: c.accent, fontWeight: 700, cursor: 'pointer' }}>התחבר</Box>
        </Typography>
      </Box>
    </Box>
  );
}
