'use client';

/**
 * Zikkit landing — the sales machine. Guests see the pitch; logged-in
 * users bounce straight to their dashboard. Every CTA leads to signup,
 * which flows into the 3-step onboarding wizard.
 */

import { useEffect } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';

const ACCENT = '#9333EA';
const PINK = '#EC4899';

export default function Home() {
  const router = useRouter();
  const { firebaseUser, loading } = useAuth();

  useEffect(() => {
    if (!loading && firebaseUser) router.replace('/dashboard');
  }, [loading, firebaseUser, router]);

  if (loading || firebaseUser) {
    return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0A0710' }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  }

  const go = () => router.push('/login');

  const features = [
    { icon: '📱', title: 'אפליקציה ממותגת ללקוחות', text: 'הלוגו שלך, הצבעים שלך, השם שלך במסך הבית — הלקוחות שומרים אותך כאפליקציה' },
    { icon: '📅', title: 'יומן חכם בזמן-אמת', text: 'תור נקבע או בוטל? היומן והדשבורד מתעדכנים לבד, בשנייה' },
    { icon: '🔔', title: 'תזכורות אוטומטיות', text: 'SMS והתראות פוש על כל קביעה, ביטול ותזכורת יום-לפני — בלי לגעת' },
    { icon: '✂️', title: 'צוות עצמאי לגמרי', text: 'לכל איש צוות שעות משלו, מחירים משלו, ימי חופש משלו — ובלגן אפס' },
    { icon: '📊', title: 'הכנסות ודוח שכר', text: 'כמה נכנס היום, כמה כל ספר הכניס החודש — הכל מחושב לבד' },
    { icon: '🤖', title: 'עוזר AI מובנה', text: 'שאלה על המערכת? זיקי עונה בעברית, צעד-אחר-צעד, 24/7' },
  ];

  const steps = [
    ['1', 'נרשמים בחינם', 'דקה אחת, בלי כרטיס אשראי'],
    ['2', 'אשף של 3 צעדים', 'שם, שעות, שירות — והעסק באוויר'],
    ['3', 'שולחים לינק ללקוחות', 'הם שומרים אותך כאפליקציה — ומתחילים לקבוע לבד'],
  ];

  return (
    <Box dir="rtl" sx={{ minHeight: '100vh', background: 'radial-gradient(1000px 500px at 50% -10%, #7C3AED33, transparent), linear-gradient(180deg,#0A0710,#141019 45%,#0A0710)', color: '#EDEAF2', fontFamily: 'inherit' }}>
      {/* Nav */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: { xs: 2.5, md: 6 }, py: 2.5, maxWidth: 1100, mx: 'auto' }}>
        <Typography sx={{ fontWeight: 600, fontSize: 20, letterSpacing: '0.12em' }}>ZIKKIT ⚡</Typography>
        <Button onClick={go} sx={{ color: '#EDEAF2', fontWeight: 500, fontSize: 14 }}>כניסה</Button>
      </Box>

      {/* Hero */}
      <Box sx={{ textAlign: 'center', px: 2.5, pt: { xs: 6, md: 10 }, pb: 8, maxWidth: 760, mx: 'auto' }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#C9A0FF', letterSpacing: '0.2em', mb: 2 }}>למספרות · ציפורניים · קוסמטיקה · כל עסק תורים</Typography>
        <Typography component="h1" sx={{ fontSize: { xs: 38, md: 56 }, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.02em', mb: 2.5 }}>
          העסק שלך.<br />
          <Box component="span" sx={{ background: `linear-gradient(90deg, ${ACCENT}, ${PINK})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>האפליקציה שלו.</Box>
        </Typography>
        <Typography sx={{ fontSize: { xs: 16, md: 18 }, color: '#A79DB5', lineHeight: 1.7, mb: 4, maxWidth: 560, mx: 'auto' }}>
          לקוחות קובעים לבד, תזכורות יוצאות לבד, היומן מסתדר לבד — ואתה מתעסק במקצוע, לא בטלפונים.
        </Typography>
        <Button onClick={go} sx={{ background: `linear-gradient(135deg, ${ACCENT}, ${PINK})`, color: '#fff', fontWeight: 600, fontSize: 17, px: 5, py: 1.75, borderRadius: 99, boxShadow: `0 18px 44px ${ACCENT}55`, '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 22px 52px ${ACCENT}70` }, transition: 'all .2s' }}>
          התחילו ניסיון חינם — 30 יום 🚀
        </Button>
        <Typography sx={{ fontSize: 12.5, color: '#8C8399', mt: 1.5 }}>בלי כרטיס אשראי · מוכן תוך 5 דקות</Typography>
      </Box>

      {/* Stats strip */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 3, md: 7 }, flexWrap: 'wrap', px: 2.5, pb: 8 }}>
        {[['90%', 'פחות טלפונים ביום'], ['24/7', 'קביעת תורים אונליין'], ['0', 'תורים שנופלים בין הכיסאות']].map(([n, t]) => (
          <Box key={t} sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 34, fontWeight: 600, background: `linear-gradient(90deg, ${ACCENT}, ${PINK})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{n}</Typography>
            <Typography sx={{ fontSize: 13, color: '#A79DB5' }}>{t}</Typography>
          </Box>
        ))}
      </Box>

      {/* Features */}
      <Box sx={{ maxWidth: 1000, mx: 'auto', px: 2.5, pb: 9 }}>
        <Typography sx={{ textAlign: 'center', fontSize: { xs: 26, md: 32 }, fontWeight: 600, mb: 4.5 }}>כל מה שעסק תורים צריך. במקום אחד.</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          {features.map((f) => (
            <Box key={f.title} sx={{ bgcolor: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 4, p: 2.75, transition: 'all .25s', '&:hover': { transform: 'translateY(-4px)', borderColor: `${ACCENT}66` } }}>
              <Typography sx={{ fontSize: 30, mb: 1.25 }}>{f.icon}</Typography>
              <Typography sx={{ fontSize: 15.5, fontWeight: 600, mb: 0.75 }}>{f.title}</Typography>
              <Typography sx={{ fontSize: 13.5, color: '#A79DB5', lineHeight: 1.65 }}>{f.text}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Testimonial */}
      <Box sx={{ maxWidth: 660, mx: 'auto', px: 2.5, pb: 9, textAlign: 'center' }}>
        <Typography sx={{ fontSize: { xs: 19, md: 23 }, fontWeight: 500, lineHeight: 1.7, color: '#EDEAF2' }}>
          ״פעם הטלפון לא הפסיק לצלצל באמצע תספורות. היום הלקוחות קובעים לבד באפליקציה — ואני רק מסתפר… כלומר מספר.״
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: '#C9A0FF', fontWeight: 600, mt: 2 }}>💈 דניאל · בעל מספרה · לקוח זיקית</Typography>
      </Box>

      {/* How it works */}
      <Box sx={{ maxWidth: 860, mx: 'auto', px: 2.5, pb: 9 }}>
        <Typography sx={{ textAlign: 'center', fontSize: { xs: 26, md: 32 }, fontWeight: 600, mb: 4.5 }}>מ-0 לאפליקציה חיה — ב-5 דקות</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          {steps.map(([n, t, sub]) => (
            <Box key={n} sx={{ textAlign: 'center', p: 2 }}>
              <Box sx={{ width: 52, height: 52, borderRadius: '50%', mx: 'auto', mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 20, background: `linear-gradient(135deg, ${ACCENT}, ${PINK})` }}>{n}</Box>
              <Typography sx={{ fontSize: 16, fontWeight: 600, mb: 0.5 }}>{t}</Typography>
              <Typography sx={{ fontSize: 13, color: '#A79DB5' }}>{sub}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Pricing */}
      <Box sx={{ maxWidth: 460, mx: 'auto', px: 2.5, pb: 9, textAlign: 'center' }}>
        <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: `1.5px solid ${ACCENT}66`, borderRadius: 5, p: 4, boxShadow: `0 24px 60px ${ACCENT}30` }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#C9A0FF', letterSpacing: '0.15em', mb: 1 }}>⭐ מחיר השקה — מייסדים</Typography>
          <Typography sx={{ fontSize: 52, fontWeight: 600, lineHeight: 1 }}>₪99<Box component="span" sx={{ fontSize: 17, color: '#A79DB5', fontWeight: 500 }}> /חודש</Box></Typography>
          <Typography sx={{ fontSize: 13, color: '#A79DB5', mt: 1, mb: 3 }}>מחיר נעול לשנה · פחות מתספורת אחת בחודש · ביטול בכל רגע</Typography>
          {['אפליקציה ממותגת + תורים אונליין', 'תזכורות SMS ופוש ללא הגבלה', 'צוות, דוחות, יומן בזמן-אמת', 'עוזר AI + תמיכה ישירה'].map((x) => (
            <Typography key={x} sx={{ fontSize: 14, color: '#EDEAF2', py: 0.5 }}>✓ {x}</Typography>
          ))}
          <Button onClick={go} fullWidth sx={{ mt: 3, background: `linear-gradient(135deg, ${ACCENT}, ${PINK})`, color: '#fff', fontWeight: 600, fontSize: 16, py: 1.5, borderRadius: 99 }}>
            30 יום חינם — מתחילים ←
          </Button>
        </Box>
      </Box>

      {/* Final CTA + footer */}
      <Box sx={{ textAlign: 'center', px: 2.5, pb: 8 }}>
        <Typography sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 600, mb: 2 }}>הלקוח הבא שלך כבר מחפש איפה לקבוע.</Typography>
        <Button onClick={go} sx={{ background: `linear-gradient(135deg, ${ACCENT}, ${PINK})`, color: '#fff', fontWeight: 600, fontSize: 16, px: 4.5, py: 1.5, borderRadius: 99 }}>פתחו את האפליקציה של העסק שלכם 🚀</Button>
        <Typography sx={{ fontSize: 12, color: '#6E6580', mt: 6 }}>ZIKKIT ⚡ · העסק שלך על אוטומט · <Box component="a" href="/terms" sx={{ color: '#8C8399' }}>תקנון</Box> · <Box component="a" href="/privacy" sx={{ color: '#8C8399' }}>פרטיות</Box></Typography>
      </Box>
    </Box>
  );
}
