'use client';

import { Box, Typography, Button } from '@mui/material';
import { useRouter } from 'next/navigation';

const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <Box sx={{ mb: 3 }}>
    <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#EDEAF2', mb: 1 }}>{t}</Typography>
    <Typography sx={{ fontSize: 13.5, color: '#9C93A8', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{children}</Typography>
  </Box>
);

export default function TermsPage() {
  const router = useRouter();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0710', direction: 'rtl', py: 5, px: 2 }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Button onClick={() => router.back()} sx={{ color: '#9C93A8', mb: 2 }}>→ חזרה</Button>
        <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#fff', mb: 3 }}>תנאי שימוש ומדיניות פרטיות — זיקית</Typography>
        <S t="1. כללי">השימוש במערכת זיקית (Zikkit) — לרבות דפי הזמנת תורים, אפליקציות עסקיות ולוחות ניהול — כפוף לתנאים אלה. המשך שימוש מהווה הסכמה.</S>
        <S t="2. השירות">זיקית מספקת פלטפורמת ניהול תורים לעסקים: קביעת תורים אונליין, תזכורות, ניהול צוות ולקוחות ודוחות. השירות ניתן כפי-שהוא (AS-IS); אנו פועלים לזמינות גבוהה אך אינה מובטחת באופן מוחלט.</S>
        <S t="3. פרטיות ומידע">בעת קביעת תור נאספים פרטים הנחוצים למתן השירות: שם, טלפון ופרטי התור. המידע נשמר במאגרי ענן מאובטחים (Google Firebase), משמש את בית העסק שאצלו נקבע התור ואת תפעול המערכת בלבד, ואינו נמכר לצדדים שלישיים. הודעות (SMS/התראות) נשלחות לצורך תפעול התור — אישורים, תזכורות ועדכונים.</S>
        <S t="4. זכויות המשתמש">בהתאם לחוק הגנת הפרטיות, באפשרותך לבקש עיון, תיקון או מחיקה של המידע אודותיך — בפנייה לבית העסק או אלינו. ביטול תורים — בהתאם למדיניות בית העסק המוצגת בדף ההזמנות.</S>
        <S t="5. אחריות">בית העסק אחראי לתוכן, למחירים, לזמינות ולמתן השירות עצמו. זיקית אינה צד לעסקה בין הלקוח לבית העסק ואינה אחראית לנזק עקיף.</S>
        <S t="6. יצירת קשר">לכל שאלה בענייני פרטיות ותנאים: support@zikkit.app</S>
        <Typography sx={{ fontSize: 11.5, color: '#6B6377', mt: 4 }}>עדכון אחרון: יולי 2026 · מסמך זה מנוסח כתמצית ידידותית ואינו ייעוץ משפטי.</Typography>
      </Box>
    </Box>
  );
}
