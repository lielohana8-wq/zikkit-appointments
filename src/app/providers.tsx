'use client';

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { useMemo } from 'react';
import { theme } from '@/styles/theme';
import { AuthProvider } from '@/features/auth/AuthProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  const cache = useMemo(
    () => createCache({ key: 'muirtl', stylisPlugins: [], prepend: true }),
    []
  );

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}
