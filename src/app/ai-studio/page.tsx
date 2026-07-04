'use client';

import { useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { AIStudio } from '@/components/ai/AIStudio';
import { zikkitColors as c } from '@/styles/theme';

export default function AIStudioPage() {
  const router = useRouter();
  const { firebaseUser, loading } = useAuth();

  useEffect(() => { if (!loading && !firebaseUser) router.push('/login'); }, [loading, firebaseUser, router]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 1.75, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'var(--zk-blur)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Button onClick={() => router.push('/dashboard')} sx={{ color: c.text2, fontWeight: 600 }}>{'← דאשבורד'}</Button>
        <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text }}>🎨 סטודיו תוכן</Typography>
        <Box sx={{ width: 80 }} />
      </Box>
      <Box sx={{ p: 3 }}>
        <AIStudio />
      </Box>
    </Box>
  );
}
