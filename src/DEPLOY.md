# העלאה — זיקית 2.0 (עיצוב)

## מה יש בזיפ
תיקיית `src/` שמשקפת בדיוק את מבנה הריפו. פורקים על שורש הפרויקט והקבצים מחליפים את הקיימים.

- `src/styles/theme.ts` — שכבת הטוקנים החדשה (canvas, card, fill, glyph, chrome, shadowCard) + טיפוגרפיה מרוסנת + MUI overrides. **זה הקובץ שמשנה את כל המערכת.**
- 28 מסכים ב‑`src/app/**/page.tsx` — הומרו לשפה החדשה.
- `src/components/Skeleton.tsx`, `src/components/ui/Primitives.tsx`.

**לא נכללו בכוונה:** `src/app/book/[bizId]/page.tsx` (דף ההזמנות — ביקשת לא לגעת) ו‑`src/app/booking-page/page.tsx`.

## פקודות

```bash
# מהשורש של הריפו, אחרי שפרקת את הזיפ לתוכו
git checkout -b redesign-2.0

npm run build          # חייב לעבור נקי — 0 שגיאות

git add src
git commit -m "Redesign 2.0: quiet-premium design language across all screens"
git push -u origin redesign-2.0
```

Vercel יבנה preview לברנץ'. אם נראה טוב:

```bash
git checkout main
git merge redesign-2.0
git push
```

## מה השתנה בכל מסך
המרות מכניות, בלי נגיעה בלוגיקה, ב‑state או ב‑API:

| שינוי | מ־ | ל־ |
|---|---|---|
| משקלי גופן | 900 / 800 / 700 | 600 / 600 / 500 |
| מסגרות כרטיס | `1.5px solid c.border` (שחור) | `1px solid c.cardLine` + צל רך |
| רקע עמוד | `c.bg` (לבן) | `c.canvas` (אפור #F5F5F7) |
| משטחים | `surface1/2/3/4` | `card` / `fill` / `fillStrong` |
| רדיוס | 2–3.5 | 4 (=16px) |
| צללים מקובעים | הקסים בתוך המסך | `c.shadowCard` |
| הדר דביק | `var(--zk-blur)` | `c.chrome` |

## אם ה‑build נכשל
כמעט תמיד זה טוקן חסר. `zikkitColors` בקובץ החדש כולל את כל העשרה: `canvas, card, cardLine, fill, fillStrong, glyph, chrome, chromeLine, shadowCard, shadowCardHover`. ודא ש‑`src/styles/theme.ts` באמת הוחלף.

## מה נשאר לעשות ידנית
1. **אימוג'י** — עדיין כתובים בתוך המסכים כטקסט. להחלפה באייקוני קו צריך עריכה פר‑מסך.
2. **סידור פנימי** — היררכיה חדשה (כמו כרטיס "התור הבא" בדשבורד) דורשת עריכת JSX, לא רק סטיילינג.

המוקאפים ב‑`.dc.html` בפרויקט הזה הם הרפרנס לשני הסעיפים האלה.
