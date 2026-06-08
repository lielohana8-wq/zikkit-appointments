'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { zikkitColors as c } from '@/styles/theme';

interface BIPEvent extends Event { prompt: () => void; userChoice: Promise<{ outcome: string }>; }

/**
 * Registers the service worker and shows a custom "Add to home screen"
 * banner on mobile when the app is installable.
 */
export function PWAInstaller() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      // Only show if not already dismissed this session
      if (!sessionStorage.getItem('pwa-dismissed')) setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setShow(false);
    setDeferred(null);
  };

  const dismiss = () => { setShow(false); sessionStorage.setItem('pwa-dismissed', '1'); };

  if (!show) return null;

  return (
    <Box sx={{ position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 2000, maxWidth: 420, mx: 'auto', bgcolor: '#fff', borderRadius: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', p: 2, display: 'flex', alignItems: 'center', gap: 1.5, border: `1px solid ${c.border}` }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: c.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, flexShrink: 0 }}>Z</Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 800, color: c.text }}>התקן את האפליקציה</Typography>
        <Typography sx={{ fontSize: 12, color: c.text3 }}>גישה מהירה מהמסך הראשי</Typography>
      </Box>
      <Button onClick={install} variant="contained" size="small" sx={{ borderRadius: 2.5, fontWeight: 700 }}>התקן</Button>
      <Button onClick={dismiss} sx={{ minWidth: 'auto', color: c.text3 }}>✕</Button>
    </Box>
  );
}
