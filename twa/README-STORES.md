# 📱 זיקית בחנויות — מדריך מלא

## 🤖 Google Play (Android) — דרך Bubblewrap (TWA)
דרישות חד-פעמיות במחשב: Node 18+, JDK 17 (https://adoptium.net), Android SDK יותקן אוטומטית ע"י bubblewrap.

1. `npm i -g @bubblewrap/cli`
2. בתיקייה ריקה:
   `bubblewrap init --manifest https://zikkit-appointments.vercel.app/manifest.json`
   (לאשר את הערכים — הם נמשכים מהמניפסט; packageId: il.zikkit.app)
3. `bubblewrap build` → נוצר `app-release-signed.aab` + נוצר keystore (לשמור גיבוי! בלעדיו אין עדכונים)
4. `bubblewrap fingerprint` (או keytool) → להעתיק את ה-SHA256
5. בקוד: `public/.well-known/assetlinks.json` → להחליף את REPLACE_WITH_YOUR_SHA256 → commit+push (דיפלוי)
6. Play Console (25$ חד-פעמי): אפליקציה חדשה → העלאת ה-AAB → למלא את הליסטינג (טקסטים למטה) → שליחה לבדיקה (1-3 ימים)

## 🍎 App Store (iOS) — מהמק
דרך מומלצת: https://www.pwabuilder.com → הזן את הכתובת → iOS package → פותחים ב-Xcode → חתימה עם חשבון Apple Developer (99$/שנה) → העלאה. חלופה: עטיפת WKWebView ידנית ב-Xcode.

## 📝 טקסטים לליסטינג (מוכנים)
**שם:** זיקית — ניהול תורים לעסק
**תיאור קצר:** יומן תורים חכם, התראות ללקוחות, צוות ותשלומים — העסק על אוטומט.
**תיאור מלא:**
זיקית הופכת כל עסק תורים לאפליקציה מקצועית: יומן בזמן-אמת, קביעת תורים אונליין ללקוחות, תזכורות SMS והתראות פוש, ניהול צוות עם שעות ומחירים אישיים, דוחות הכנסות ושכר, עיצוב ממותג לכל עסק, ועוזר AI מובנה. בלי טלפונים, בלי הברזות — העסק שלך על אוטומט. 💜
**קטגוריה:** עסקים · **גרפיקה:** icon-512 + צילומי מסך מהדשבורד והיומן
