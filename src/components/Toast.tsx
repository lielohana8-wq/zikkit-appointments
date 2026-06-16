'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { zikkitColors as c } from '@/styles/theme';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; type: ToastType; }

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const colors: Record<ToastType, { bg: string; icon: string }> = {
    success: { bg: c.green, icon: '✓' },
    error: { bg: c.hot, icon: '!' },
    info: { bg: c.text, icon: 'i' },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Box sx={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center', pointerEvents: 'none', width: 'max-content', maxWidth: '90vw' }}>
        {toasts.map((t) => (
          <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 99, px: 2.5, py: 1.5, boxShadow: c.shadowLg, animation: 'zkToastIn 0.3s cubic-bezier(0.22,1,0.36,1)', '@keyframes zkToastIn': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } } }}>
            <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: colors[t.type].bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{colors[t.type].icon}</Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: c.text }}>{t.message}</Typography>
          </Box>
        ))}
      </Box>
    </ToastContext.Provider>
  );
}
