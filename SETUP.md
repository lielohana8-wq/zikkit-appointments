# ZikkitAppointments - אפליקציה נפרדת

מערכת תורים נפרדת לגמרי מ-Zikkit השדה. **פרויקט נפרד, מותג נפרד, אותו Firebase.**

## ✅ נבדק - ה-build עובר!

האפליקציה נבנתה ונבדקה (`npm run build` עבר בהצלחה). 8 routes:
- `/` - דף נחיתה ZikkitAppointments
- `/login` - התחברות
- `/register` - הרשמה לפיילוט
- `/dashboard` - דאשבורד תורים
- `/setup` - אשף הקמת דנה (8 שלבים)
- `/api/dana/provision` - הקצאת מספר
- `/api/dana/suggest-appointments` - זיהוי AI

## 🏗️ הארכיטקטורה

```
Zikkit (שדה)              ZikkitAppointments
zikkit-jvc7.vercel        zikkit-appointments.vercel  ← פרויקט נפרד!
       │                          │
       └──────────┬───────────────┘
                  ▼
          Firebase zikkit-e87ff (משותף)
          businesses/{uid} עם product: 'appointments'
```

**הפרדת נתונים:** כל עסק מסומן `product: 'appointments'`. האפליקציה הזו רואה רק אותם. Zikkit השדה רואה רק את שלו.

## 🎨 מותג נפרד

- שם: **ZikkitAppointments**
- צבע: סגול/פלum (#9333EA) במקום אינדיגו של Zikkit
- פונט: Sora + Assistant

## 🚀 העלאה - שלב אחר שלב

### 1. צור repo חדש ב-GitHub
```cmd
cd C:\
mkdir zikkit-appointments
cd zikkit-appointments
tar -xzf %USERPROFILE%\Downloads\ZIKKIT-APPOINTMENTS-APP.tar.gz
git init
git add .
git commit -m "init: ZikkitAppointments"
```

צור repo ב-https://github.com/new בשם `zikkit-appointments`, ואז:
```cmd
git remote add origin https://github.com/lielohana8-wq/zikkit-appointments.git
git branch -M main
git push -u origin main
```

### 2. בדוק build מקומית
```cmd
npm install
npm run build
```
אמור לראות "✓ Compiled successfully".

### 3. צור פרויקט Vercel נפרד
1. https://vercel.com/new
2. Import את `zikkit-appointments` מ-GitHub
3. הוסף את כל ה-env vars (ראה .env.example):
   - כל ה-`NEXT_PUBLIC_FIREBASE_*` (אותם ערכים כמו Zikkit)
   - `ANTHROPIC_API_KEY` (עם credit!)
   - `FIREBASE_SERVICE_ACCOUNT_KEY`
   - `TWILIO_*`
   - `NEXT_PUBLIC_BASE_URL=https://zikkit-appointments.vercel.app`
4. Deploy

### 4. הוסף את הדומיין ל-Firebase
Firebase Console → Authentication → Settings → Authorized domains
הוסף: `zikkit-appointments.vercel.app`

## ⚠️ דרישות

- `ANTHROPIC_API_KEY` **עם credit** (לזיהוי עסק)
- `FIREBASE_SERVICE_ACCOUNT_KEY` (לשמירת נתונים)
- Twilio (למספר + SMS)

## 🔮 לעתיד

- ElevenLabs tools (check-slots, book-slot) - כבר בניתי, צריך להעתיק לאפליקציה הזו
- יומן ויזואלי מלא בדאשבורד
- ניהול עמדות/צוות
- פורטל לקוח לביטול/שינוי תור
- חיבור ה-AI Studio (שיווק, פוסטים, גלריה)

## 💡 הערה על המנוי הנפרד

לפי ההחלטה שלך - כל מוצר עם מנוי נפרד. בקוד, כל עסק מסומן `product`. כשתבנה billing, כל product יחויב בנפרד. לקוח שרוצה גם שדה וגם תורים - נרשם פעמיים (אפשר לחבר אחר כך עם אותו אימייל).
