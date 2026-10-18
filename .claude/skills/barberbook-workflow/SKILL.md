---
name: barberbook-workflow
description: Use whenever the user asks to build, change or fix a feature in BarberBook (apps/web, packages/*, worker). Defines how we work here - build the feature, run tests, build, restart the pm2 dev server on port 39000, STOP and let the user test and approve, and only after approval commit and push. Load it at the start of any feature/bugfix request, and again when the user says she is done testing.
---

# BarberBook — שיטת העבודה

המכונה הזו (`~/BarberBook`) היא **שרת הפיתוח החי** — המשתמשת בודקת עליו ישירות בפורט **39000**.
האפליקציה רצה שם תחת **pm2** (`barberbook-web` ו-`barberbook-worker`), על נתונים אמיתיים.
**לא מקימים שרת נוסף ולא עוצרים את הקיים** — עובדים מול ה-pm2 הרגיל.

## הזרימה

1. **בונים את הפיצ'ר** לפי הבקשה (לפני כתיבת UI: סקיל `barberbook-design`).
2. **בדיקות** (מתוך `~/BarberBook`):
   - `pnpm --filter @barberbook/web test`
   - `pnpm --filter @barberbook/web lint`
   - `cd apps/web && npx tsc --noEmit`
   - נוגעים בחבילות אחרות (`packages/db`, `packages/shared`, ה-worker) — להריץ גם את הבדיקות שלהן.
   - כשל — מתקנים לפני שממשיכים. לא ממשיכים ל-build עם בדיקה אדומה.
3. **Build:** קודם `pgrep -af "next build"` — חייב להיות ריק (אחרת מחכים). אחר כך `pnpm build` מתוך `apps/web`.
4. **הפעלה מחדש ב-pm2.** `pm2` לא ב-PATH:
   `PM2=~/.npm/_npx/5f7878ce38f1eb13/node_modules/.bin/pm2`
   (אם הנתיב לא קיים — `npx pm2`)
   - `$PM2 restart barberbook-web barberbook-worker` ואז `$PM2 save`.
   - אם `$PM2 list` ריק (למשל אחרי אתחול שרת) — `$PM2 resurrect`.
5. **אימות:** `curl -s -o /dev/null -w '%{http_code}' localhost:39000/login` = `200`; שני השירותים `online` בלי אתחולים חוזרים; `$PM2 logs --nostream --lines 20` נקי משגיאות חדשות (בלוג יש שורות ישנות — להסתכל על חדשות בלבד).
6. **אם נגעו ב-UI:** `pnpm --filter @barberbook/web check:overflow` — רץ מול ה-pm2 שעל 39000 (אחרי שלב 4), לא מרימים שרת בשבילו.
7. **עוצרים ומדווחים בעברית:** מה נבנה, מה נבדק (ומה לא), ומה היא צריכה לבדוק בדפדפן על 39000. **לא עושים commit ולא push בשלב הזה.**
8. **היא בודקת ומאשרת** ("מעולה", "עובד", "תמשיך" וכו'). רק אז — סקיל `git-checkpoint`: pull, סקירה, `git add` מפורש, commit, push.
   - אם מבקשת תיקון — חוזרים לשלב 1 (תיקון, בדיקות, build, restart) ושוב עוצרים לבדיקה.

## כללים

- **מיגרציות Prisma** משנות את ה-DB החי. לפני `prisma migrate deploy` — להציג מה המיגרציה עושה ולקבל אישור, ולהריץ אותה לפני ה-restart בשלב 4.
- **לא לקרוא `.env`** (CLAUDE.md סעיף 12). קבצים שמכילים סודות לא נכנסים ל-commit.
- ה-worker רץ על נתונים אמיתיים (תזכורות, התראות, SMS) — restart שלו מותר רק כחלק מהנוהל; לא להפעיל לוגיקה חדשה של שליחה בלי לומר לה.
- פקודות מסוכנות (`pkill`, `kill` לפי דפוס) — לא. עוצרים תהליך לפי PID אחרי שבדקנו מהו.
- אל תעשה deploy לפרודקשן האמיתי (Docker) — זה נוהל נפרד ב-`docs/DEPLOY.md` ורק על בקשה מפורשת, והיא מריצה אותו בעצמה.
- אחרי commit: אם השינוי משנה התנהגות — לעדכן את `CLAUDE.md` (ואת `docs/DEPLOY.md` אם זה משפיע על פריסה) באותו commit.
