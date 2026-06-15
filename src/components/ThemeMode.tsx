'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

type Mode = 'light' | 'dark';
interface ThemeModeValue { mode: Mode; toggle: () => void; }

const ThemeModeContext = createContext<ThemeModeValue>({ mode: 'light', toggle: () => {} });

export function useThemeMode() {
  return useContext(ThemeModeContext);
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('light');

  // On mount, read saved preference (cookie-free: uses a simple in-memory + data attr).
  useEffect(() => {
    let saved: Mode = 'light';
    try {
      const stored = document.cookie.split('; ').find((r) => r.startsWith('zk-theme='));
      if (stored) saved = (stored.split('=')[1] as Mode) || 'light';
      else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) saved = 'dark';
    } catch { /* ignore */ }
    setMode(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      try { document.cookie = `zk-theme=${next}; path=/; max-age=31536000`; } catch { /* ignore */ }
      return next;
    });
  }, []);

  return <ThemeModeContext.Provider value={{ mode, toggle }}>{children}</ThemeModeContext.Provider>;
}
