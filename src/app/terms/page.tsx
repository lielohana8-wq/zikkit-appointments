'use client';

/** Terms of service — required for store listing. */

import { Box, Typography } from '@mui/material';
import { zikkitColors as c } from '@/styles/theme';

const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <Box sx={{ mb: 3 }}>
    <Typography sx={{ fontSize: 17, fontWeight: 800, color: c.text, mb: 0.75 }}>{t}</Typography>
    <Typography component="div" sx={{ fontSize: 14, color: c.text2, lineHeight: 1.8 }}>{children}</Typography>
  </Box>
);

export default function TermsPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: c.bg, py: 6, px: 3 }}>
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>
        <Typography sx={{ fontSize: 28, fontWeight: 900, color: c.text, letterSpacing: '-0.02em', mb: 0.5 }}>תנאי שימוש</Typography>
        <Typography sx={{ fontSize: 13, color: c.text3, mb: 4 }}>Zikkit Appointments · עדכון אחרון: יולי 2026</Typography>

        <S t="השירות">Zikkit מספקת מערכת ענן לניהול עסקים נותני שירות: יומן תורים, ניהול לקוחות, דף הזמנות, תשלומים, דוחות וכלי שיווק. השימוש מהווה הסכמה לתנאים אלה.</S>
        <S t="חשבון ותקופת ניסיון">ההרשמה כוללת תקופת ניסיון. בסיומה נדרש מנוי בתשלום להמשך שימוש. אתה אחראי לשמירת פרטי ההתחברות שלך.</S>
        <S t="הנתונים שלך">כל נתוני העסק (לקוחות, תורים, מסמכים) הם בבעלות העסק. ניתן לייצא אותם בכל עת. אנו מתחזקים גיבויים ואבטחה בסטנדרט תעשייתי, אך מומלץ לייצא עותק תקופתי.</S>
        <S t="שימוש הוגן">אין להשתמש במערכת לשליחת ספאם, לפגיעה בפרטיות לקוחות, או לכל פעילות בלתי חוקית. שליחת הודעות ללקוחות היא באחריות העסק ובכפוף לדין.</S>
        <S t="תשלומים וביטול">המנוי מתחדש חודשית וניתן לביטול בכל עת מתוך המערכת; הביטול נכנס לתוקף בסוף תקופת החיוב. עסקאות סליקה של לקוחות העסק מעובדות ע&quot;י ספק הסליקה בכפוף לתנאיו.</S>
        <S t="אחריות">השירות ניתן כמות שהוא (AS-IS). נעשה כמיטב יכולתנו לזמינות ורציפות, אך לא נישא באחריות לנזק עקיף. אחריותנו הכוללת מוגבלת לסכום ששולם ב-3 החודשים האחרונים.</S>
        <S t="סיום">ניתן לסגור את החשבון בכל עת. אנו רשאים להשעות חשבון המפר תנאים אלה, לאחר התראה סבירה.</S>
        <S t="דין וסמכות">על תנאים אלה יחול הדין הישראלי. יצירת קשר: <b>ohanaliel@gmail.com</b></S>
      </Box>
    </Box>
  );
}
