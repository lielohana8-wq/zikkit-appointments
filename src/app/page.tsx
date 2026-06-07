'use client';

import { Box, Typography, Button, Container } from '@mui/material';
import { useRouter } from 'next/navigation';
import { zikkitColors as c } from '@/styles/theme';

export default function LandingPage() {
  const router = useRouter();

  const features = [
    { icon: '📞', title: 'דנה עונה 24/7', desc: 'סוכנת AI שעונה לכל שיחה, קובעת תור, ומעדכנת את היומן — גם כשאתם עסוקים.' },
    { icon: '📅', title: 'יומן חכם', desc: 'תורים מסתדרים לפי משך הטיפול וכמות העמדות. אפס כפילויות.' },
    { icon: '🔁', title: 'תורים חוזרים', desc: 'לקוח קבוע? דנה תקבע אוטומטית תור כל כמה שבועות.' },
    { icon: '💬', title: 'תזכורות SMS', desc: 'הלקוח מקבל אישור ותזכורת. פחות ביטולים, פחות "שכחתי".' },
    { icon: '🖼️', title: 'גלריית עבודות', desc: 'מעלים תמונות, וה-AI יוצר פוסט מקצועי + דף נחיתה אוטומטי.' },
    { icon: '📈', title: 'יועץ שיווק AI', desc: 'המלצות מותאמות איך למלא יותר תורים ולהגדיל הכנסה.' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg }}>
      {/* Nav */}
      <Box sx={{ borderBottom: `1px solid ${c.border}`, py: 2, px: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, bgcolor: c.bg, zIndex: 10 }}>
        <Typography sx={{ fontFamily: 'Sora, sans-serif', fontSize: 20, fontWeight: 800, color: c.text }}>
          Zikkit<Box component="span" sx={{ color: c.accent }}>Appointments</Box>
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button onClick={() => router.push('/login')} sx={{ color: c.text2, fontWeight: 600 }}>כניסה</Button>
          <Button onClick={() => router.push('/register')} variant="contained" sx={{ borderRadius: 99, px: 3, fontWeight: 700 }}>הצטרף לפיילוט</Button>
        </Box>
      </Box>

      {/* Hero */}
      <Box sx={{ background: `linear-gradient(160deg, ${c.accentDim}, ${c.bg})`, py: { xs: 8, md: 14 }, px: 3, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Box className="zk-fade-up" sx={{ display: 'inline-block', bgcolor: c.accentDim, color: c.accent, px: 2, py: 0.75, borderRadius: 99, fontSize: 13, fontWeight: 700, mb: 3 }}>
            ✨ ניהול תורים חכם עם AI
          </Box>
          <Typography className="zk-fade-up" sx={{ fontFamily: 'Sora, Assistant, sans-serif', fontSize: { xs: 38, md: 60 }, fontWeight: 800, color: c.text, lineHeight: 1.1, mb: 2 }}>
            היומן שלך מתמלא.<br />
            <Box component="span" sx={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>גם כשאתם עובדים.</Box>
          </Typography>
          <Typography className="zk-fade-up" sx={{ fontSize: { xs: 16, md: 20 }, color: c.text2, mb: 4, maxWidth: 580, mx: 'auto', lineHeight: 1.6 }}>
            ZikkitAppointments — סוכנת AI בעברית שעונה לטלפון, קובעת תורים, ומנהלת את היומן. לספרים, קוסמטיקאיות, קליניקות וכל עסק תור.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button onClick={() => router.push('/register')} variant="contained" size="large" sx={{ py: 2, px: 5, fontSize: 17, fontWeight: 800, borderRadius: 99 }}>
              הצטרף לפיילוט החינמי →
            </Button>
          </Box>
          <Typography sx={{ fontSize: 12, color: c.text3, mt: 2 }}>ללא כרטיס אשראי · גישה מלאה בתקופת הפיילוט</Typography>
        </Container>
      </Box>

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography sx={{ fontFamily: 'Sora, Assistant, sans-serif', fontSize: { xs: 28, md: 40 }, fontWeight: 800, textAlign: 'center', color: c.text, mb: 2 }}>
          כל מה שצריך לנהל תורים
        </Typography>
        <Typography sx={{ fontSize: 16, color: c.text2, textAlign: 'center', mb: 6 }}>
          מערכת אחת שמחליפה יומן, מזכירה, ומשווק.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 3 }}>
          {features.map((f, i) => (
            <Box key={i} sx={{ bgcolor: c.surface1, border: `1px solid ${c.border}`, borderRadius: 4, p: 4, transition: 'all 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 32px rgba(0,0,0,0.06)' } }}>
              <Box sx={{ fontSize: 40, mb: 2 }}>{f.icon}</Box>
              <Typography sx={{ fontSize: 19, fontWeight: 800, color: c.text, mb: 1 }}>{f.title}</Typography>
              <Typography sx={{ fontSize: 14, color: c.text2, lineHeight: 1.6 }}>{f.desc}</Typography>
            </Box>
          ))}
        </Box>
      </Container>

      {/* Pilot CTA */}
      <Box sx={{ background: `linear-gradient(135deg, ${c.accent}, ${c.accent2})`, py: 10, px: 3, textAlign: 'center' }}>
        <Container maxWidth="sm">
          <Typography sx={{ fontFamily: 'Sora, Assistant, sans-serif', fontSize: { xs: 28, md: 40 }, fontWeight: 800, color: '#fff', mb: 2 }}>
            מחפשים 50 עסקי תור לפיילוט
          </Typography>
          <Typography sx={{ fontSize: 17, color: 'rgba(255,255,255,0.9)', mb: 4, lineHeight: 1.6 }}>
            הצטרפו עכשיו, קבלו גישה מלאה חינם בתקופת הפיילוט, והשפיעו על המוצר.
          </Typography>
          <Button onClick={() => router.push('/register')} variant="contained" size="large" sx={{ py: 2, px: 6, fontSize: 17, fontWeight: 800, borderRadius: 99, bgcolor: '#fff', color: c.accent, '&:hover': { bgcolor: '#fff' } }}>
            הגש מועמדות לפיילוט
          </Button>
        </Container>
      </Box>

      <Typography sx={{ textAlign: 'center', py: 4, fontSize: 13, color: c.text3 }}>
        ZikkitAppointments · מופעל ע"י Zikkit
      </Typography>
    </Box>
  );
}
