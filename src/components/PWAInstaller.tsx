'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Typography, Dialog } from '@mui/material';
import { zikkitColors as c } from '@/styles/theme';

interface BIPEvent extends Event { prompt: () => void; userChoice: Promise<{ outcome: string }>; }

const DISMISS_KEY = 'zk-pwa-dismissed-v2';

/**
 * Registers the service worker and shows an "Add to home screen" prompt.
 * - Android/Chrome: uses the native beforeinstallprompt event (one-tap install).
 * - iOS Safari: never fires that event, so we detect iOS and show manual
 *   "Share → Add to Home Screen" instructions instead.
 */
export function PWAInstaller() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Already installed (standalone)? Don't prompt.
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Recently dismissed? Respect for 7 days.
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;

    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isMobile = ios || /android/i.test(ua);
    setIsIOS(ios);

    if (ios) {
      // iOS: show our banner after a short delay (Safari only).
      const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
      if (isSafari) {
        const t = setTimeout(() => setShow(true), 2500);
        return () => clearTimeout(t);
      }
      return;
    }

    // Android/Chrome path
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      if (isMobile) setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (isIOS) { setIosOpen(true); return; }
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setShow(false);
    setDeferred(null);
  };

  const dismiss = () => { setShow(false); localStorage.setItem(DISMISS_KEY, String(Date.now())); };

  return (
    <>
      {show && (
        <Box className="zk-pwa-slide" sx={{ position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 2000, maxWidth: 440, mx: 'auto' }}>
          <Box sx={{ bgcolor: c.surface1, borderRadius: 3, boxShadow: '0 12px 48px rgba(0,0,0,0.22)', p: 2, display: 'flex', alignItems: 'center', gap: 1.5, border: `1px solid ${c.border2}` }}>
            <Box component="img" src="/icon-192.png" sx={{ width: 52, height: 52, borderRadius: 2.5, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text }}>התקינו את Zikkit</Typography>
              <Typography sx={{ fontSize: 12.5, color: c.text3, lineHeight: 1.35 }}>
                {isIOS ? 'גישה מהירה — כמו אפליקציה אמיתית' : 'גישה מהירה מהמסך הראשי, בלי דפדפן'}
              </Typography>
            </Box>
            <Button onClick={install} variant="contained" size="small" sx={{ borderRadius: 2, fontWeight: 800, px: 2, flexShrink: 0 }}>
              {isIOS ? 'איך?' : 'התקן'}
            </Button>
            <Button onClick={dismiss} sx={{ minWidth: 32, width: 32, height: 32, p: 0, color: c.text3, fontSize: 18, flexShrink: 0 }}>✕</Button>
          </Box>
        </Box>
      )}

      {/* iOS manual instructions */}
      <Dialog open={iosOpen} onClose={() => { setIosOpen(false); dismiss(); }} PaperProps={{ sx: { borderRadius: 4, m: 2, maxWidth: 380 } }}>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Box component="img" src="/icon-192.png" sx={{ width: 64, height: 64, borderRadius: 3, mb: 2 }} />
          <Typography sx={{ fontSize: 20, fontWeight: 900, color: c.text, letterSpacing: '-0.02em', mb: 0.5 }}>התקנה על האייפון</Typography>
          <Typography sx={{ fontSize: 14, color: c.text3, mb: 3 }}>שני צעדים פשוטים והאפליקציה על המסך הראשי</Typography>

          <Box sx={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: c.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>1</Box>
              <Typography sx={{ fontSize: 14.5, color: c.text2 }}>
                לחצו על כפתור <b style={{ color: c.accent }}>שיתוף</b> <Box component="span" sx={{ display: 'inline-flex', verticalAlign: 'middle', mx: 0.5, width: 24, height: 24, borderRadius: 1, border: `1.5px solid ${c.accent}`, color: c.accent, alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⬆️</Box> בתחתית המסך
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: c.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>2</Box>
              <Typography sx={{ fontSize: 14.5, color: c.text2 }}>
                בחרו <b style={{ color: c.accent }}>הוסף למסך הבית</b> <Box component="span" sx={{ mx: 0.3 }}>➕</Box>
              </Typography>
            </Box>
          </Box>

          <Button onClick={() => { setIosOpen(false); dismiss(); }} fullWidth variant="contained" sx={{ mt: 3, borderRadius: 2, fontWeight: 800, py: 1.25 }}>הבנתי</Button>
        </Box>
      </Dialog>
    </>
  );
}
