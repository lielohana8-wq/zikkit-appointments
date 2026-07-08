'use client';

import { useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { zikkitColors as c } from '@/styles/theme';

// Registration is handled within the unified auth/landing page at /login.
export default function RegisterRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/login?register=1'); }, [router]);
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: c.bg }}>
      <CircularProgress sx={{ color: c.accent }} />
    </Box>
  );
}
