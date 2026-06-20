'use client';

import { useState, useEffect } from 'react';
import { Box, Typography, Button, Dialog, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { zikkitColors as c } from '@/styles/theme';

interface Props {
  bizId: string | null;
  hasServices: boolean;
  hasHours: boolean;
  bookingEnabled: boolean;
}

/**
 * Shown once to a brand-new owner (no services / hours / booking yet).
 * A friendly 3-step orientation that routes them into setup. Dismissible,
 * remembers dismissal in localStorage so it never nags.
 */
export function WelcomeWizard({ bizId, hasServices, hasHours, bookingEnabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const isNew = !hasServices && !hasHours && !bookingEnabled;

  useEffect(() => {
    if (!bizId) return;
    const key = `zk-welcomed-${bizId}`;
    const seen = localStorage.getItem(key);
    if (isNew && !seen) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [bizId, isNew]);

  const close = () => {
    if (bizId) localStorage.setItem(`zk-welcomed-${bizId}`, '1');
    setOpen(false);
  };

  const slides = [
    {
      emoji: '👋',
      title: 'ברוכים הבאים ל-Zikkit!',
      body: 'המערכת שתנהל לכם את כל התורים, הלקוחות וההכנסות — במקום אחד. בואו נגדיר אתכם ב-3 צעדים מהירים.',
      cta: 'יאללה, מתחילים',
      action: () => setStep(1),
    },
    {
      emoji: '📋',
      title: 'מה אתם מציעים?',
      body: 'נתחיל מהשירותים והמחירים שלכם — תספורת, צבע, מניקור, מה שזה לא יהיה. זה הבסיס לכל השאר.',
      cta: 'הוסף שירותים',
      action: () => { close(); router.push('/services'); },
      secondary: 'אחר כך',
      secondaryAction: () => setStep(2),
    },
    {
      emoji: '🔗',
      title: 'תנו ללקוחות לקבוע לבד',
      body: 'הפעילו את דף ההזמנות, שתפו את הלינק — והלקוחות יקבעו תורים 24/7. אתם פשוט עובדים.',
      cta: 'הפעל דף הזמנות',
      action: () => { close(); router.push('/booking-page'); },
      secondary: 'סיימתי לעכשיו',
      secondaryAction: close,
    },
  ];

  const s = slides[step];

  return (
    <Dialog open={open} onClose={close} PaperProps={{ sx: { borderRadius: 5, m: 2, maxWidth: 400, width: '100%', overflow: 'hidden' } }}>
      {/* progress dots */}
      <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center', pt: 3 }}>
        {slides.map((_, i) => (
          <Box key={i} sx={{ width: i === step ? 22 : 7, height: 7, borderRadius: 99, bgcolor: i === step ? c.accent : c.surface4, transition: 'all 0.3s' }} />
        ))}
      </Box>

      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Box sx={{ fontSize: 56, mb: 2 }}>{s.emoji}</Box>
        <Typography sx={{ fontSize: 24, fontWeight: 900, color: c.text, letterSpacing: '-0.03em', mb: 1.5 }}>{s.title}</Typography>
        <Typography sx={{ fontSize: 15.5, color: c.text2, lineHeight: 1.6, mb: 3.5, maxWidth: 320, mx: 'auto' }}>{s.body}</Typography>

        <Button onClick={s.action} fullWidth variant="contained" sx={{ borderRadius: 2.5, fontWeight: 800, py: 1.5, fontSize: 16, mb: s.secondary ? 1 : 0 }}>{s.cta}</Button>
        {s.secondary && (
          <Button onClick={s.secondaryAction} fullWidth sx={{ borderRadius: 2.5, fontWeight: 700, py: 1, color: c.text3 }}>{s.secondary}</Button>
        )}
      </Box>
    </Dialog>
  );
}
