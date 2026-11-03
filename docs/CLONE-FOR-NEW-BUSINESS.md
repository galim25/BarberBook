# שכפול האפליקציה לעסק נוסף — מיפוי קידוד לעסק הנוכחי

> **נבדק:** 2026-11-03 מול הקוד ב-`main` (commit `fa10fba`, עץ עבודה נקי — `git status` ריק).
> **שיטה:** כל פריט במסמך נקרא או נחפש ישירות בקוד (grep + קריאת הקובץ). פריטים שלא נבדקו מופיעים בנפרד בסעיף 9 ואינם מוצגים כעובדה.
> **מטרה:** לאפשר לשכפל את BarberBook לעסק אחר **כעותק נפרד** (מסד, שרת/קונטיינר ודומיין משלו), בלי להפוך את המערכת ל-multi-tenant. זו ההחלטה שהתקבלה בשיחה.
> **מה המסמך אינו:** אין בו שינוי קוד, ואין בו החלטות עיצוביות. החלטות שנדרשות מהמשתמשת מרוכזות בסעיף 7.

---

## 1. מסקנה בקצרה

- **אין שכבת קונפיגורציה לעסק.** אין קובץ/טבלה שמחזיקים שם עסק, לוגו, שירותים או נוסחי הודעות. הערכים האלה פזורים בקוד. (נבדק: `AppSettings` ב-`schema.prisma` מכיל רק `requires_approval`, `ivr_enabled`, `waitlist_periods`.)
- **ההצמדה רדודה אבל פזורה.** הלוגיקה העסקית (זמינות, ביטול, בקשות אישור, התראות) כללית ואינה תלויה בסוג העסק. מה שמקודד הוא: מותג, זהות הבעלים, קטלוג שירותים, נוסחי טקסט (מילה "ספר"/"מספרה"/"תספורת"), ה-IVR, וקבועי אזור/ספק (ישראל, 019sms, ימות המשיח).
- **תשתית:** ה-compose יוצר פרויקט בשם קבוע ומפרסם פורטים 80/443, ולכן **אי אפשר להריץ שני עותקים על אותו host בלי שינוי** (סעיף 6).
- **אין תמיכה במייל בשום מקום בקוד** (סעיף 8).

---

## 2. מותג וזהות (שינוי חובה לכל עסק)

| מה | איפה | הערה |
|---|---|---|
| שם האפליקציה "BarberBook" | `apps/web/src/app/layout.tsx:12` (title), `:26` (`appleWebApp.title`); `apps/web/src/app/page.tsx:16` (כותרת דף הבית); `apps/web/public/site.webmanifest` (`name`, `short_name`) | שם האפליקציה כפי שמותקנת על מסך הבית |
| תיאור "מערכת ניהול תורים למספרה" | `layout.tsx:13`, `page.tsx:17`, `site.webmanifest` (`description`) | |
| כותרת ברירת מחדל להתראות Push | `apps/web/src/app/sw.ts:63`, `apps/web/src/lib/notifyCustomer.ts:38` | |
| טקסט הודעות SMS | `apps/web/src/lib/actions/smsLogin.ts:103` ("בברכה BarberBook"), `apps/web/src/lib/actions/auth.ts:114` (איפוס סיסמה, "ב-BarberBook") | |
| טקסט התקנה | `apps/web/src/components/InstallPrompt.tsx:61` | |
| הודעת עליית ה-worker | `apps/worker/src/index.ts:5` | לוג בלבד |
| שם שולח SMS (`SMS_SENDER_ID`) | משתנה סביבה; `.env.example:89` מציין "BarberBook"; עד 11 תווים לטיני; לפי ההערה בקובץ הספק עשוי לדרוש אישור | |
| לוגו (תמונה) | `apps/web/public/logo-cropped.png` (3045×863) — נצפה: איור פנים עם זקן + הכיתוב **YOSSI BARBER** | `alt="Yossi Barber"` ב-`BrandHero.tsx:34` וב-`AdminBrandHero.tsx:23` |
| אייקוני PWA / favicon | `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`, `apple-touch-icon.png`, `favicon-96x96.png`, `favicon.ico`, `favicon.svg`, `apps/web/src/app/favicon.ico` | נצפו בעין: `512`, `apple-touch-icon`, `favicon-96x96` — כולם מציגים את לוגו **YOSSI**. האחרים לא נצפו (סעיף 9) |
| כותרת "בס"ד" | רכיב יחיד `apps/web/src/components/BsdBar.tsx`, מיובא בכל דפי הלקוח וההתחברות וב-`PageHeader` (כל `/admin`) | להחלטה: האם ללקוח החדש (סעיף 7) |
| צבעי מותג | 6 טוקנים בבלוק `@theme` ב-`apps/web/src/app/globals.css` (`cream #fdf8f0`, `barber-teal #508186`, `barber-teal-dark #3d666a`, `ink #1f2421`, `slate-muted #7c7c7c`, `cream-text #fffcf7`); בנוסף `themeColor "#508186"` ב-`layout.tsx:31` ו-`theme_color`/`background_color` ב-`site.webmanifest` | נבדק: מחוץ לשלושת המקומות האלה אין hex בקבצי ה-TS/TSX. **הערה:** שם הטוקן `barber-teal` מופיע בשמות מחלקות בכל הקוד, כך שהחלפת **ערך** קלה, אבל שינוי **שם** הטוקן נוגע בהרבה קבצים |
| פונט | Rubik גלובלי ב-`layout.tsx:9`; דף כניסת המנהל דורס ל-Heebo (`app/(auth)/login/admin/page.tsx:7`) | |

### זהות הבעלים (נתוני seed ו-IVR)

| מה | איפה |
|---|---|
| שם המנהל/ספר ראשי "יוסי הספר" | `packages/db/prisma/seed.ts:24` (`ADMIN_FULL_NAME`) — הוא גם `User.full_name` של המנהל וגם `Barber` הראשי (`id: "primary"`, `seed.ts:52-53`) |
| טלפון המנהל **`0500000000`** (מספר placeholder) | `packages/db/prisma/seed.ts:25` — המנהל מתחבר עם הטלפון הזה + סיסמה ב-`/login/admin` |
| סיסמת מנהל ראשונית | `ADMIN_SEED_PASSWORD` (אופציונלי); אחרת נוצרת אקראית ומודפסת פעם אחת. נקבעת רק ביצירה ראשונה (`seed.ts`) |
| עותק שני של השם | `packages/db/prisma/backfillPrimaryBarber.ts:12` — סקריפט חד-פעמי למיגרציה ישנה; לפי ההערה בראשו הוא לא נדרש במסד חדש |
| משפט הפתיחה של ה-IVR "…של מספרת יוסי" | `apps/web/src/lib/ivr/flow.ts:36` (`WELCOME_GREETING`); בנוסף "הַמָסְפֵרָה" ב-`flow.ts:80`, `:83` |

---

## 3. קטלוג שירותים ומודל ה"ספר" (הצמדה לסוג העסק)

**מקור יחיד לשירותים:** `SERVICE_DEFINITIONS` ב-`packages/shared/src/index.ts:3-10` — שישה שירותים עם שם, משך ו-`is_child_service`:
תספורת מבוגר (10) · תספורת + זקן (15) · תספורת ילד (10, ילד) · הסרת שיער בלייזר (10) · חלאקה (15) · תספורת מבוגר + טיפול לייזר (20).

הצמדות נוספות שנמצאו (כולן לפי **שם שירות בעברית** כמפתח לוגי, לא לפי מזהה):

| מה | איפה | משמעות לעסק אחר |
|---|---|---|
| `SUB_BARBER_SERVICE_NAMES` — 3 שירותים שמותרים לספר-משנה | `packages/shared/src/index.ts:15`; נצרך ב-`isServiceAllowedForBarber` (`index.ts:30`), `lib/actions/booking.ts:40`, `lib/actions/barbers.ts:43`, `lib/rescheduleCore.ts:48`, `lib/actions/bookingCore.ts:55` | שינוי שמות שירותים בלי לעדכן את הרשימה הזו שובר את ההגבלה בשקט |
| `IVR_SERVICE_WHITELIST` — אותם 3 שמות | `apps/web/src/lib/ivr/flow.ts:325` | רשימה נפרדת (לא נגזרת מהקודמת) |
| ניקוד לקריינות לכל שם שירות | `flow.ts:310-315` | שירות חדש בלי ניקוד נקרא ב-IVR לפי TTS גולמי |
| `is_child_service` — דורש שם ילד, מייצר `attendee_type: "child"` | `lib/actions/bookingCore.ts:79-90`, `app/account/book/page.tsx:338,350,627`, `flow.ts:541` ("ילד/ה של …") | קונספט ספציפי לספרות; לעסק אחר ייתכן שלא רלוונטי |
| שירותי "תור ידני" 5/10/15 דק' | `MANUAL_APPOINTMENT_DURATIONS` + `MANUAL_SERVICE_DEFINITIONS` (`index.ts:21-29`) | שמות בעברית ("תור ידני N דק'") |
| `seed.ts` מבצע `upsert` לפי שם בלבד | `packages/db/prisma/seed.ts:8-20` | **אינו מוחק** שירותים; במסד חדש זה לא משנה, במסד קיים שירות ישן נשאר |
| מילה "ספר"/"ספרים" כמושג המודל | טבלה `barbers`, `WorkDay.barber_id`, `Barber.is_primary` ב-`schema.prisma`; מסכי `/admin/barbers` | שם המודל נשאר גם אם התצוגה תתחלף; שינוי שם בסכימה = migration |

**הערה:** ב-`SERVICE_DEFINITIONS` יש הערה שהקטלוג "קבוע לפי ה-PRD, לא להמציא ערכים אחרים". זה נכון לעסק הנוכחי; לעסק חדש הוא מוגדר מחדש (סעיף 7).

---

## 4. נוסח טקסטים הפונים ללקוח

אין שכבת i18n או קובץ מחרוזות (נבדק: אין ספריית i18n ב-`package.json`). כל הטקסטים inline, בעברית בלבד (`lang="he" dir="rtl"` ב-`layout.tsx`).

מחרוזות שמזכירות "הספר" / "מספרה" / "תספורת" (שורות שנמצאו ב-grep, ללא הערות קוד):

| קובץ:שורה | טקסט |
|---|---|
| `apps/worker/src/reminders.ts:94` | "זוהי תזכורת **מהספר** לגבי תשלום על **התספורת**. אם שילמת, **ראה** הודעה זו כמבוטלת." |
| `lib/notifyCustomer.ts:70` | "…בוטל ע"י הספר." |
| `lib/actions/adminAppointments.ts:136` | "הספר שינה את מועד התור שלך…" |
| `lib/actions/bookingRequests.ts:102-103` | "…אושר/נדחה ע"י הספר." |
| `lib/actions/announcements.ts:41` | "הודעה חדשה מהספר: …" |
| `lib/actions/booking.ts:181,213,230,313` | "יש ליצור קשר עם הספר", "השירות הזה לא זמין אצל הספר הזה" |
| `lib/actions/rescheduleRequests.ts:126` | "השירות לא זמין אצל הספר המבוקש…" |
| `lib/actions/barbers.ts:75,77,104,105` | "הספר לא נמצא", "לא ניתן להשבית/למחוק את הספר הראשי" |
| `app/account/appointments/page.tsx:70,74,86,92` | "נדחה ע"י הספר", "ממתין לאישור הספר" |
| `app/account/appointments/RescheduleButton.tsx:95,115` | "נשלחה לאישור הספר", "(הספר הנוכחי)" |
| `app/account/appointments/RequestCancellationButton.tsx:20` | "לשלוח בקשת ביטול לספר?…" |
| `app/account/book/page.tsx:411,643,669` | "…אישור מפורש של הספר", "יישלח לאישור הספר" |
| `app/admin/barbers/*` (`AddBarberForm.tsx:31`, `BarberActiveToggle.tsx:49`, `DeleteBarberButton.tsx:17-18`, `page.tsx:26`) | "שם הספר", "הספרים במערכת", "למחוק לצמיתות את הספר…" |
| `components/PushNotificationToggle.tsx:201` | טקסט הסבר Push (שורה ארוכה, מזכיר "הספר" — לא נקראה במלואה) |
| `layout.tsx:13`, `page.tsx:17` | "מערכת ניהול תורים למספרה" |

**מגדר:** הנוסחים מעורבים — חלקם בצורת "/י" (`שים/י לב`, `נסה/י`), חלקם זכר ("ראה", `reminders.ts:94`). לא נבדק אם יש מקומות בלשון נקבה בלבד.
**שורה אחת בולטת:** `reminders.ts:94` מקודדת גם "תספורת" וגם "הספר" — היחידה שנמצאה מחוץ ל-`apps/web` ובתוך ה-worker.

הערה: המחרוזת `smsLogin.ts:117` ("6 הספרות") הופיעה ב-grep אך אינה קשורה למותג — "ספרות" = digits.

---

## 5. ברירות מחדל התנהגותיות וקבועי אזור

### קבועים עסקיים שמוגדרים בקוד (לא ב-DB)

| קבוע | ערך | איפה |
|---|---|---|
| תזכורת לפני תור | 120 דק' | `APPOINTMENT_REMINDER_LEAD_MINUTES`, `packages/shared/src/index.ts` |
| תזכורת תשלום | 30 דק' אחרי תחילת התור; תקרה 6 שעות אחורה | `PAYMENT_REMINDER_DELAY_MINUTES` (`index.ts`); `PAYMENT_REMINDER_MAX_AGE_MINUTES` ב-`apps/worker/src/reminders.ts` |
| רשת שעות | 10 דק' (ברירת מחדל) | `availability.ts:31` (`slot_step_minutes ?? 10`); `dayTimeline.ts:69` (`splitFreeSegments`, `stepMinutes = 10`). הפרמטר `slot_step_minutes` קיים בחתימה, אך **נמצא רק בקריאות ובטסטים — לא נמצאה קריאה בקוד היצרני שמעבירה ערך אחר** (נבדק ב-grep) |
| פיצול יום ל-3 חלקים ב-IVR | גבולות 12:00 ו-18:00 | `availability.ts:88-89` (`getDayPeriods`) |
| טווחי רשימת המתנה (בוקר/צהריים/ערב) | ברירת מחדל 09:00-13:00 / 13:00-17:00 / 17:00-20:00; **ניתנים להגדרה** ב-`/admin/waitlist-settings` | `lib/waitlistPeriods.ts:15-19`, נשמר ב-`AppSettings.waitlist_periods` |
| **שתי הגדרות "בוקר/צהריים/ערב" שונות** | 12/18 ב-IVR מול 09-13/13-17/17-20 ברשימת ההמתנה | אי-התאמה קיימת בקוד, לא נוצרה בשכפול |
| עבודה אחרי חצות | עד 03:00 | `lib/workDayTimes.ts:4` |
| משכי תור ידני | 5/10/15 | `index.ts:21` |
| תוקף קוד כניסה / ניסיונות | 10 דק' / 5 | `LOGIN_CODE_TTL_MINUTES`, `LOGIN_CODE_MAX_ATTEMPTS` |
| מגבלות קצב שליחת קוד | 3 ל-15 דק' למספר; 10 לשעה ל-IP; **100 לשעה גלובלית**; אימות 10 ל-15 דק' | `lib/actions/smsLogin.ts` (קבועים `SEND_PER_PHONE` וכו') — התקרה הגלובלית נועדה לעלות SMS, יחסית לנפח הלקוחות של כל עסק |
| ניקוי לילי / ניקוי קודים | 00:00 (Asia/Jerusalem) / 03:17 (שעון השרת) | `apps/worker/src/index.ts` |

### קבועי אזור/ספק (ישראל)

| מה | איפה |
|---|---|
| אזור זמן `Asia/Jerusalem` | `ISRAEL_TIME_ZONE` ב-`packages/shared/src/index.ts:61`; **ליטרל נוסף** ב-`apps/worker/src/index.ts:40` (לא משתמש בקבוע) |
| פורמט תאריך/שעה `he-IL` | `formatIsraelDate`/`formatIsraelTime` ב-`packages/shared` |
| טלפון ישראלי: נרמול, `05X` בלבד ללקוחות | `normalizeIsraeliPhone`, `isIsraeliMobile`, `PHONE_NUMBER_REGEX` ב-`packages/shared/src/index.ts`; `lib/validation.ts` |
| קישור וואטסאפ `wa.me/972…` | `lib/contacts.ts:9` |
| זיהוי מתקשר IVR `+972` | `lib/ivr/identifyCaller.ts:20` |
| ספק SMS: 019sms | `packages/shared/src/sms019.ts` (endpoint ברירת מחדל `https://019sms.co.il/api`); בחירה ב-`getOtpSmsProvider()` (`sms.ts`) |
| ספק טלפוניה: ימות המשיח | `apps/web/src/lib/ivr/*`, route `app/api/ivr/yemot/[secret]/route.ts` |
| מספר המנהל ב-seed | ראו סעיף 2 |

---

## 6. תשתית ופריסה

| נושא | ממצא (נבדק) | השלכה לעותק שני |
|---|---|---|
| שם פרויקט compose | `docker-compose.yml:1` — `name: barberbook` | volumes (`pgdata`, `certbot-www`, `certbot-certs`) ורשת משותפים לשני עותקים באותו host |
| פורטים | שירות `nginx` מפרסם `80:80` ו-`443:443`; `postgres`/`web` לא מפורסמים | שני stacks על אותו שרת מתנגשים על 80/443; נדרש nginx/reverse proxy אחד משותף או שרת נפרד |
| דומיין | `DOMAIN` ב-`.env` → `server_name` ונתיב התעודה ב-`nginx/templates/default.conf.template` | כל עותק: דומיין + תעודה משלו |
| סקריפט פריסה | `scripts/deploy.sh` — מתבסס על `cd "$(dirname "$0")/.."` (לא תלוי בנתיב); הערת הכותרת מזכירה `/root/barberbook/` | עובד מכל תיקייה, אבל פועל על `docker compose` של התיקייה שבה הוא נמצא |
| בנייה | `Dockerfile` יחיד (targets `web`/`worker`); `NEXT_PUBLIC_VAPID_PUBLIC_KEY` נאפה בזמן build (`ARG`) | **כל עסק צריך build משלו** (המפתח מוטמע ב-bundle) |
| שמות חבילות | `@barberbook/web`, `/worker`, `/db`, `/shared`; ה-reference `@barberbook/` מופיע ב-61 קבצים (ts/tsx/json) | שינוי שם החבילות = שינוי רחב; אין סיבה פונקציונלית לעשות זאת |
| שרת הפיתוח הנוכחי | לפי `.claude/skills/barberbook-workflow/SKILL.md`: pm2 בשמות `barberbook-web`/`barberbook-worker`, פורט 39000, **על נתונים אמיתיים** | עותק חדש לא יכול לשבת על אותם שמות/פורט/מסד |
| ריפו | `origin` = `github.com/galim25/BarberBook` | החלטה: ריפו נפרד / fork / ענף (סעיף 7) |

### משתני סביבה שחייבים להיות ייחודיים לכל עותק
(רשימה מלאה מה-grep על `process.env.*` ומ-`.env.example`; ערכי `.env` עצמם **לא נקראו**, בהתאם לחוק בסעיף 12 של CLAUDE.md)

- **סודות:** `SESSION_SECRET`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `ADMIN_SEED_PASSWORD`
- **דומיין/כתובות:** `DOMAIN`, `PUBLIC_BASE_URL`, `COOKIE_SECURE`
- **Push:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (build), `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — ליצור זוג מפתחות חדש לכל עסק
- **SMS:** `CUSTOMER_LOGIN_MODE`, `SMS_PROVIDER`, `SMS_019_USERNAME`, `SMS_019_TOKEN`, `SMS_SENDER_ID` (+ `SMS_019_ENDPOINT` לבדיקה)
- **IVR (אם רלוונטי):** `YEMOT_PHONE_NUMBER`, `YEMOT_WEBHOOK_SECRET`
- קיימים גם קבצי `.env` נפרדים ב-`apps/web`, `apps/worker`, `packages/db` (ריצה מחוץ ל-Docker) — נמצאו ברשימת הקבצים, לא נקראו.

### מה כבר ניתן לשינוי בזמן ריצה (בלי קוד)
`AppSettings.requires_approval`, `ivr_enabled`, `waitlist_periods`; הוספה/השבתה/מחיקה של ספרי משנה; ימי עבודה, שעות והפסקות; הודעות כלליות. **שירותים, שם עסק, לוגו, נוסחים וזמני תזכורות — אינם ניתנים לשינוי בלי שינוי קוד.**

---

## 7. החלטות שנדרשות מהמשתמשת לפני העבודה

לא הוחלט כאן דבר; אלה השאלות ששינוי הקוד תלוי בהן:

1. **סוג העסק החדש** — עוד מספרה, או עסק אחר (קוסמטיקה, מכון וכו')? זה קובע אם "ספר/תספורת/ילד/זקן" נשארים, ואם שם המודל `Barber` מתאים.
2. **קטלוג שירותים** — שמות ומשכים; האם יש ספרי משנה והאם יש להם תת-קבוצת שירותים; האם נדרש מושג "ילד".
3. **IVR** — האם הלקוח החדש צריך קו טלפוני (ימות המשיח, עלות נוספת ומספר חדש), או רק אפליקציה.
4. **מצב כניסה** — `sms_code` (דורש חשבון SMS וספק) או סיסמה; וכן האם להוסיף כניסה/התראות במייל (סעיף 8). לקוחות שקובעים מהמחשב — רלוונטי להחלטה.
5. **מותג** — שם, לוגו (קבצי מקור), צבעים, האם להשאיר "בס"ד".
6. **זהות מנהל** — שם, טלפון אמיתי (במקום `0500000000`), סיסמה.
7. **אירוח** — שרת נפרד, או אותו שרת עם reverse proxy משותף; דומיין ותת-דומיין.
8. **ניהול הקוד לאורך זמן** — ריפו נפרד (fork) שמושך שינויים מהמקור, או ענף. תיקוני באגים ופיצ'רים יעברו ידנית בין העותקים; ככל שההתאמות מרוכזות בפחות קבצים, המיזוגים נקיים יותר.
9. **נוסח הודעות** — מגדר ("הספר" → ניסוח ניטרלי/אחר), במיוחד `reminders.ts:94`.

---

## 8. הערות לגבי תזכורות/כניסה במייל (נבדק בקוד, ללא החלטה)

- **אין שום קוד מייל.** grep ל-`email`/`mailto`/`nodemailer`/`resend`/`sendgrid` בכל `apps` ו-`packages` החזיר ריק. אין שדה מייל ב-`User` (`schema.prisma`).
- **זהות המשתמש היא הטלפון.** `phone_number` מופיע ב-41 קבצי מקור (לא כולל טסטים), `User.phone_number` ייחודי; כניסת לקוחות היא טלפון + קוד SMS ל-`05X` בלבד.
- **נקודות החיבור לערוץ התראות נוסף:**
  - `getSmsProvider()` (`packages/shared/src/sms.ts`) — ברירת מחדל Noop (התראות אינן נשלחות ב-SMS); `getOtpSmsProvider()` נפרד ומשמש לקודי כניסה בלבד.
  - `sendCustomerNotification` (`lib/notifyCustomer.ts`) — מקבלת `phone_number`, כותבת `Notification`, שולחת Push; נקראת מ-`waitlist.ts` (שתי נקודות), `adminAppointments.ts`, `bookingRequests.ts`, `cancellationRequests.ts`, `rescheduleRequests.ts`, ודרך `notifyAppointmentCancelled`.
  - **ה-worker עוקף את `sendCustomerNotification`:** `apps/worker/src/reminders.ts` קורא ל-`getSmsProvider()` ול-`prisma.notification.create` ול-`sendPushToUser` ישירות, גם לתזכורת לפני תור וגם לתזכורת תשלום. תזכורות במייל ידרשו לגעת בשני המסלולים.
- **אין סבב "ביטול הרשמה" (unsubscribe)** — לא קיים בקוד לאף ערוץ.

---

## 9. מה לא נבדק (ולכן אינו מוצג כעובדה)

- **תוכן מסד הנתונים החי** — לא נקרא; בפרט לא ידוע מהו טלפון המנהל בפועל (הקוד יוצר `0500000000`, ייתכן שהוחלף) ואילו שירותים/ספרים קיימים בפועל.
- **ערכי `.env`** — לא נקראו בכוונה (חוק הפרויקט). לא ידוע איזה מצב כניסה/ספק פעיל בשרת.
- **שרת הפרודקשן ושרת הפיתוח** — לא נגעתי ולא התחברתי. תיעוד מצב ההעברה נמצא ב-`docs/DEPLOY.md` ו-`CLAUDE.md` ולא אומת מול השרת.
- **`favicon.svg` (236KB), `favicon.ico`, `web-app-manifest-192x192.png`, `app/favicon.ico`** — לא נצפו בעין; אינם מכילים את המחרוזות yossi/barber כטקסט (grep על ה-SVG), אך ייתכן שהם גרפיקה של הלוגו.
- **מחלקות צבע סטנדרטיות של Tailwind** (אדום/ירוק/וכו') — 51 קבצי TSX מכילים אחת מהן; לא נבדק מה כל אחת מהן, אם הן חלק ממערכת המותג או לא.
- **`PushNotificationToggle.tsx:201`** — שורה ארוכה שנחתכה בפלט; הוזכר בה "הספר", לא נקראה במלואה.
- **מסמכי PRD/ERD/IVR/STACK ב-`docs/`** — נבדק grep לשם הבעלים בלבד (נמצא ב-`# IVR BarberBook.txt` ובמסמך הפרטיות `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md`); לא נקראו במלואם.
- **בדיקות אוטומטיות** — לא הורצו (המשימה לקריאה בלבד). הטסטים משתמשים בשם "יוסי" ובשולח "BarberBook" כנתוני דוגמה בלבד (`contacts.test.ts`, `dayTimeline.test.ts`, `sms019.test.ts`) — אין צורך לשנות אותם.
- **דומיין הפרודקשן:** `CLAUDE.md` מציין `yossibarberbook.co.il`, ו-`docs/DEPLOY.md:39` מביא דוגמה `booking.yossi-barber.co.il`. לא אומת איזה מהם נכון (ייתכן שהאחד דוגמה בלבד).

---

## 10. רשימת עבודה מוצעת לעותק חדש

> זו **הצעה** שנגזרת מהממצאים לעיל, לא עובדה שנבדקה על מימוש. הסדר מניח שההחלטות בסעיף 7 התקבלו.

1. **ריפו/ענף חדש** לפי החלטה 8. בלי לגעת בשרת הפיתוח הקיים.
2. **ריכוז הקונפיגורציה בנקודה אחת** (שם עסק, שם שולח, כותרות, צבעים, שירותים, משפט פתיחת IVR) — כך שהעתקים עתידיים ישתנו בקובץ אחד ולא ב-10+ מקומות. זה השלב שמצמצם את כאב המיזוג בין העותקים.
3. **החלפת נכסים:** לוגו (PNG שטוח עם alpha, לפי הכלל ב-`CLAUDE.md` סעיף 13 — לא SVG עם mask), אייקוני PWA, favicon, `site.webmanifest`.
4. **קטלוג שירותים:** עדכון `SERVICE_DEFINITIONS`, `SUB_BARBER_SERVICE_NAMES`, `IVR_SERVICE_WHITELIST` + ניקוד IVR **יחד** (שלוש רשימות נפרדות, סעיף 3).
5. **נוסחים:** מעבר על הטבלה בסעיף 4, כולל `reminders.ts:94`.
6. **seed:** שם מנהל, טלפון אמיתי, סיסמה (`ADMIN_SEED_PASSWORD`).
7. **תשתית:** `name:` ייחודי ב-compose או שרת נפרד; `DOMAIN`; סודות וזוג VAPID חדשים; חשבון/שולח SMS (ואישור `SMS_SENDER_ID`); חשבון IVR אם נדרש.
8. **אימות לפני מסירה:** `pnpm test`, `tsc --noEmit` (web, worker), `pnpm build`, `check:overflow` (דורש build רץ), וקביעת תור מקצה לקצה בדפדפן.
9. **רק אחרי כל זה** — ערוץ מייל (סעיף 8), כפיצ'ר נפרד ובסיס משותף לשני העותקים.

---

## נספח: פקודות לאימות חוזר

להרצה מתיקיית הריפו; אינן משנות דבר.

```bash
# מותג ובעלים
grep -rnI -i -E 'יוסי|yossi' apps packages --include=*.ts --include=*.tsx --include=*.json --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist
grep -rnI -i 'barberbook' apps packages docker-compose.yml .env.example scripts | grep -v '@barberbook/'

# נוסח "ספר/מספרה/תספורת" (ללא הערות)
grep -rnI -E 'מספרה|מספרת|הספר|לספר|תספורת' apps packages --include=*.ts --include=*.tsx --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist | grep -v '\.test\.ts'

# שירותים כמפתח לוגי
grep -rnI -E 'SERVICE_DEFINITIONS|SUB_BARBER_SERVICE_NAMES|IVR_SERVICE_WHITELIST|is_child_service' apps packages --include=*.ts --include=*.tsx --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist

# כל משתני הסביבה בקוד
grep -rnI -o -E 'process\.env\.[A-Z_0-9]+' apps packages --include=*.ts --include=*.tsx --include=*.mts --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist | sed 's/:[0-9]*:/ -> /' | sort -u

# צבעי hex מחוץ ל-globals.css
grep -rnI -E '#[0-9a-fA-F]{6}\b' apps/web/src --include=*.ts --include=*.tsx

# אין מייל
grep -rIn -i -E '\bemail\b|mailto|nodemailer|resend|sendgrid' apps packages --include=*.ts --include=*.tsx --include=*.prisma --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist
```
