'use client';

/**
 * /app — public install page. Send this link to anyone ("הורד את האפליקציה").
 * Detects the device and shows the right one-tap flow:
 * - Already installed (standalone) → open the app
 * - Android/Chrome → native install prompt (beforeinstallprompt)
 * - iOS Safari → visual Share → Add to Home Screen steps
 * - Desktop → open on phone / browser install hint
 */

import { useEffect, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useRouter } from 'next/navigation';
import { ZikkitLogo } from '@/components/ZikkitLogo';
import { useToast } from '@/components/Toast';
import { zikkitColors as c } from '@/styles/theme';

interface BIPEvent extends Event { prompt: () => void; userChoice: Promise<{ outcome: string }>; }

type Device = 'standalone' | 'android' | 'ios' | 'desktop';

export default function AppInstallPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [device, setDevice] = useState<Device>('desktop');
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) { setDevice('standalone'); return; }
    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    if (ios) setDevice('ios');
    else if (/android/i.test(ua)) setDevice('android');
    else setDevice('desktop');

    const onBIP = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', onBIP);
  }, []);

  const feature = (icon: string, text: string) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box sx={{ fontSize: 17 }}>{icon}</Box>
      <Typography sx={{ fontSize: 13.5, color: c.text2, fontWeight: 600 }}>{text}</Typography>
    </Box>
  );

  const step = (n: number, icon: string, title: string, desc: string) => (
    <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start', bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 2.5, p: 2 }}>
      <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: c.accentDim, color: c.accent, fontWeight: 900, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</Box>
      <Box>
        <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text }}>{icon} {title}</Typography>
        <Typography sx={{ fontSize: 13, color: c.text3, mt: 0.25, lineHeight: 1.5 }}>{desc}</Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', px: 3, py: 6 }}>
      <Box sx={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}><ZikkitLogo useImage size={64} /></Box>
        <Typography sx={{ fontSize: 30, fontWeight: 900, color: c.text, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
          Zikkit על המסך שלך.<br /><span style={{ color: c.accent }}>כמו כל אפליקציה.</span>
        </Typography>
        <Typography sx={{ fontSize: 14.5, color: c.text3, mt: 1.5, mb: 3, lineHeight: 1.6 }}>
          התקנה של 10 שניות — בלי חנות, בלי הורדות כבדות.<br />נפתח במסך מלא, ישר מהאייקון.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center', mb: 4 }}>
          {feature('⚡', 'פתיחה מיידית מהמסך הראשי')}
          {feature('📅', 'היומן, הלקוחות והתורים — בקליק')}
          {feature('🔄', 'מתעדכן לבד — תמיד הגרסה החדשה')}
        </Box>

        {/* ===== Already installed ===== */}
        {(device === 'standalone' || installed) && (
          <Box>
            <Box sx={{ fontSize: 48, mb: 1.5 }}>🎉</Box>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: c.text, mb: 2 }}>האפליקציה מותקנת — אתה בפנים!</Typography>
            <Button onClick={() => router.push('/dashboard')} variant="contained" size="large" fullWidth sx={{ py: 1.75, borderRadius: 2, fontWeight: 800, fontSize: 16 }}>פתח את Zikkit →</Button>
          </Box>
        )}

        {/* ===== Android ===== */}
        {device === 'android' && !installed && (
          <Box>
            {deferred ? (
              <Button onClick={async () => { deferred.prompt(); const r = await deferred.userChoice; if (r.outcome === 'accepted') setInstalled(true); }} variant="contained" size="large" fullWidth sx={{ py: 2, borderRadius: 2, fontWeight: 900, fontSize: 17, boxShadow: `0 12px 36px ${c.accent}55` }}>
                📲 התקן את Zikkit — בלחיצה
              </Button>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, textAlign: 'right' }}>
                {step(1, '⋮', 'פתח את תפריט הדפדפן', 'שלוש הנקודות בפינה העליונה')}
                {step(2, '📲', 'בחר "הוספה למסך הבית"', 'או "התקנת אפליקציה" — תלוי בדפדפן')}
                {step(3, '✅', 'אישור — וזהו', 'אייקון Zikkit יופיע במסך הראשי')}
              </Box>
            )}
          </Box>
        )}

        {/* ===== iOS ===== */}
        {device === 'ios' && !installed && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, textAlign: 'right' }}>
            <Typography sx={{ fontSize: 13.5, color: c.text3, textAlign: 'center', mb: 0.5 }}>באייפון זה 2 צעדים (חובה בספארי):</Typography>
            {step(1, '⬆️', 'לחץ על כפתור השיתוף', 'הריבוע עם החץ — בתחתית המסך בספארי')}
            {step(2, '➕', 'גלול ובחר "הוסף למסך הבית"', 'Add to Home Screen — ואז "הוסף"')}
            {step(3, '💜', 'זהו!', 'אייקון Zikkit מחכה לך במסך הראשי')}
          </Box>
        )}

        {/* ===== Desktop ===== */}
        {device === 'desktop' && !installed && (
          <Box>
            <Box sx={{ bgcolor: c.surface1, border: `1px solid ${c.border2}`, borderRadius: 3, p: 3, mb: 2 }}>
              <Box sx={{ fontSize: 34, mb: 1 }}>📱</Box>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: c.text, mb: 0.5 }}>פתח את הדף הזה בטלפון</Typography>
              <Typography sx={{ fontSize: 13, color: c.text3, mb: 2 }}>שלח לעצמך את הקישור — וההתקנה משם היא לחיצה אחת</Typography>
              <Button onClick={() => { navigator.clipboard?.writeText(window.location.href); showToast('הקישור הועתק — שלח לעצמך בוואטסאפ', 'success'); }} variant="contained" sx={{ borderRadius: 2, fontWeight: 800 }}>📋 העתק קישור</Button>
            </Box>
            <Typography sx={{ fontSize: 12.5, color: c.text3 }}>💡 גם במחשב אפשר: בכרום, לחץ על אייקון ההתקנה ⊕ בשורת הכתובת</Typography>
          </Box>
        )}

        <Typography sx={{ fontSize: 12, color: c.text3, mt: 5 }}>Zikkit Appointments · המערכת שממלאת לך את היומן 💜</Typography>
      </Box>
    </Box>
  );
}
