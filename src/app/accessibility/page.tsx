'use client';

import { Box, Typography, Button } from '@mui/material';
import { useRouter } from 'next/navigation';

const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <Box sx={{ mb: 3 }}>
    <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#EDEAF2', mb: 1 }}>{t}</Typography>
    <Typography sx={{ fontSize: 13.5, color: '#9C93A8', lineHeight: 1.8 }}>{children}</Typography>
  </Box>
);

export default function AccessibilityPage() {
  const router = useRouter();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0710', direction: 'rtl', py: 5, px: 2 }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Button onClick={() => router.back()} sx={{ color: '#9C93A8', mb: 2 }}>→ חזרה</Button>
        <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#fff', mb: 3 }}>הצהרת נגישות — זיקית</Typography>
        <S t="מחויבות לנגישות">זיקית רואה חשיבות עליונה בהנגשת שירותיה הדיגיטליים לאנשים עם מוגבלות, ברוח חוק שוויון זכויות לאנשים עם מוגבלות התשנ"ח-1998 ותקנות הנגישות לשירות, ובשאיפה לעמידה בתקן הישראלי (ת"י 5568) ברמה AA.</S>
        <S t="מה בוצע">האתר והאפליקציות תומכים בניווט מקלדת, טקסטים ברורים בעברית מלאה (RTL), ניגודיות צבעים גבוהה, גדלי מגע נוחים במובייל, ותאימות לקוראי מסך במסכים המרכזיים. הפיתוח נבחן שוטף במכשירים ובגדלי מסך שונים.</S>
        <S t="חריגות ידועות">ייתכנו רכיבים שטרם הונגשו במלואם (למשל תכנים גרפיים שהועלו על-ידי בתי עסק). אנו פועלים לשיפור מתמיד.</S>
        <S t="פנייה בנושא נגישות">נתקלתם בקושי? נשמח לתקן במהירות: support@zikkit.app — אנא ציינו את הדף והבעיה. מענה יינתן בהקדם ולא יאוחר מהקבוע בתקנות.</S>
        <Typography sx={{ fontSize: 11.5, color: '#6B6377', mt: 4 }}>עדכון ההצהרה: יולי 2026</Typography>
      </Box>
    </Box>
  );
}
