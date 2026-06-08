'use client';

import { useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { zikkitColors as c } from '@/styles/theme';

/**
 * Root entry. The system has no landing page of its own —
 * the marketing landing is a separate HTML site.
 * Logged-in users go to the dashboard; everyone else to login.
 */
export default function Home() {
  const router = useRouter();
  const { firebaseUser, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(firebaseUser ? '/dashboard' : '/login');
  }, [loading, firebaseUser, router]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg }}>
      <CircularProgress sx={{ color: c.accent }} />
    </Box>
  );
}
