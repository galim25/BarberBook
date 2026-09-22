# BarberBook — מערכת ניהול תורים למספרה

אפליקציה לניהול תורים עבור ספר עצמאי. לקוחות קובעים, משנים ומבקשים לבטל תורים בעצמם לפי הזמינות שהספר מגדיר; הספר מנהל את היומן במלואו מתוך מסך ניהול.

מסמכי המקור המלאים נמצאים ב-`docs/`:
- `# PRD BarberBook.txt` — דרישות מוצר, User Stories, Functional Requirements
- `# ERD BarberBook.txt` — מודל נתונים (Mermaid ERD + טבלאות שדות)
- `# STACK BarberBook.txt` — ארכיטקטורת מערכת
- `# IVR BarberBook.txt` — **ימות המשיח (הוחלף מ-Twilio ב-2026-08-04). קו נרכש
  ב-2026-08-05 (`0772248273`), `.env` מלא (`YEMOT_PHONE_NUMBER`/`YEMOT_WEBHOOK_SECRET`/
  `PUBLIC_BASE_URL` דרך דומיין ngrok סטטי `marlin-capitol-carat.ngrok-free.dev`),
  ותחביר `read=`/רשימת תווים אסורים תוקנו בקוד לפי מקור קהילתי מפורט (freeivr.co.il
  post/76) — השלוחה הוגדרה ובוצעה שיחת בדיקה אמיתית ראשונה (2026-08-08, עד הצעת
  התור הקרוב ביותר, לא עד אישור סופי) + נוספה בחירת טווח שעות (בוקר/צהריים/ערב)**
  — קביעת תור טלפונית (מענה קולי אוטומטי, DTMF). כל ההחלטות שסוכמו + תסריט שיחה
  מלא + סטטוס מימוש מעודכן. קרא במלואו לפני שממשיכים את הפיצ'ר הזה.

קרא את הקבצים המלאים לפני שינויים משמעותיים — הסיכום כאן חלקי בכוונה.

## 🔖 איפה עצרנו (עודכן 2026-09-22, בוקר) — קראו קודם

**בעבודה: כניסת לקוחות עם קוד SMS במקום סיסמה/הרשמה** (החלטת המשתמשת, אחרי ניתוח סיכונים). **מסמך מלא + תרחיש הדלקה + רשימת "מה נשאר": [`docs/SMS-LOGIN.md`](docs/SMS-LOGIN.md).**
- **סטטוס:** הזרימה נבדקה מלאה בדפדפן במצב `mock` בשרת הפיתוח (כל התרחישים תקינים — לקוח קיים, קוד שגוי, שליחה חוזרת, מספר חדש, מספר חסום, מספר מנהל, כניסת מנהל). שרת הפיתוח עדיין במצב `sms_code`/`mock` כרגע (לא הוחזר לברירת המחדל). אף SMS אמיתי לא נשלח מעולם. פורמט ה-auth של 019sms (`Authorization: Bearer <token>`) **אומת מול התיעוד הרשמי — נכון כפי שממומש**, אין צורך לתקן קוד.
- **הצעד הבא:** (1) לפתוח חשבון ב-019sms (הרשמה ב-`019sms.co.il`, טוקן ראשון מהדשבורד, לברר גם שם שולח מאושר `SMS_SENDER_ID`); (2) dry-run מול endpoint הבדיקות של 019; (3) הדלקה אמיתית. פירוט מדויק בסעיף 5 במסמך.
- **המנהל נשאר עם סיסמה בכל מצב** (`/login/admin`); מספרו פשוט/ידוע ולכן אסור לאפשר לו כניסה בקוד/טלפון בלבד.
- **פתוח בנפרד:** איפוס סיסמה (`forgotPasswordAction`) עדיין לא שולח כלום כי `getSmsProvider()` הוא Noop — במצב `sms_code` הוא סגור ממילא; נשאר רלוונטי רק אם נשארים במצב סיסמה.
- **נעשה היום ונדחף (2026-09-21/22):** Push ללקוחות + התראות מנהל (`ebcb908`), סימון תור שנקבע בטלפון + חיוג (`fece809`) — פירוט בסעיפי המצב למטה.

## Stack וארכיטקטורה

```
Browser / Mobile Web
   → Nginx (aaPanel)
   → Next.js App Container (מסכי לקוח, מסכי ניהול, API/Server Actions, Auth)
   → PostgreSQL
   ↑
Worker Container — שולח תזכורות, החלטות ביטול, SMS על שינוי תור
```

**ידוע ופתוח:** `apps/worker`'s `pnpm build` (`tsc`) + `pnpm start` (`node dist/index.js`) לא עובד כרגע בפועל — `packages/shared`/`packages/db` נצרכים כמקור TS ישיר (בלי build step משלהם), ו-Node הרץ-CommonJS-רגיל לא יודע לפענח את זה. עד שזה יתוקן, מריצים את ה-worker דרך `pnpm exec tsx --env-file=.env src/index.ts` (בלי `--watch` לריצה יציבה ארוכת-טווח) — זה עובד תקין (`tsx` מתרגם TS "on the fly", כולל בין-חבילתי), רק שזה טכנית dev-runtime ולא בינארי מקומפל.

**Docker (נוסף 2026-08-31):** `Dockerfile` יחיד בשורש (targets `web`/`worker`, חולק שלבי deps/build כי שני האפליקציות תלויות באותו workspace), `docker-compose.yml` (postgres · web · worker · nginx · certbot), ו-`nginx/templates/default.conf.template` (HTTPS + headers בסיסיים, בלי CSP — ראה הערה בקובץ). מדריך הרצה מלא (כולל ה-bootstrap הידוע של תעודת SSL עצמית זמנית) ב-`docs/DEPLOY.md`. worker רץ בקונטיינר שלו גם דרך `tsx` (אותה מגבלה כמו למעלה — לא בינארי מקומפל, וזה בסדר).

## משתמשים

- **לקוח** — נרשם/מתחבר עם שם מלא + טלפון + סיסמה. קובע תורים לעצמו ולילדיו, משנה תור, שולח בקשת ביטול (טעונה אישור הספר), מקבל תזכורות והודעות.
- **מנהל מערכת (הספר)** — פותח ימי עבודה (תאריך, שעת התחלה/סיום, הפסקות), רואה ומנהל את כל היומן, קובע תורים ידנית, מוחק תורים/ימים שלמים (עם אזהרת אישור), מפרסם הודעות כלליות, מאשר/דוחה בקשות ביטול.

### שם מנהל המערכת

השם המוצג למנהל ("היי [שם]") הוא פשוט `User.full_name` של חשבון ה-administrator — **הכניסה/ההתחברות (login) נשארת אחת ויחידה**, אין ריבוי חשבונות admin. כרגע קבוע כ-"יוסי הספר". כדי למסור את המערכת לספר אחר: לשנות את `ADMIN_FULL_NAME` ב-`packages/db/prisma/seed.ts` ולהריץ `pnpm db:seed` (עדכון אידמפוטנטי — `upsert` לפי `phone_number`, מעדכן גם חשבון קיים, לא רק יוצר חדש). זה נפרד לגמרי מזהות ה"ספר" ליומן/הזמנות — ראו "ספרי משנה" למטה: מ-2026-08-03 יש **ריבוי ספרים ברמת היומן** (ישות `Barber` נפרדת מ-`User`), אבל תמיד רק admin אחד מחובר שמנהל את כולם.

## ישויות עיקריות (ERD)

`User` (role: customer/administrator) · `Barber` (`is_primary`, `is_active` — ראו "ספרי משנה" למטה) · `PasswordResetCode` · `Service` (duration_minutes, `is_child_service`) · `WorkDay` (`barber_id`, `is_blocked` — ראו למטה) · `WorkBreak` · `BlockedTime` · `Appointment` (status: scheduled/cancelled, attendee_type: self/child/other) · `CancellationRequest` (status: pending/approved/rejected) · `BookingRequest` (status: pending/approved/rejected) · `AppSettings` (סינגלטון, `requires_approval`) · `WaitlistEntry` · `Notification` (type כולל גם `appointment_booked`/`waitlist_slot_available`/`booking_decision`, ו-`read_at`) · `Announcement` · `BlockedPhoneNumber`

הערות מודל חשובות:
- `Appointment.booked_by_user_id` אופציונלי — תור ידני שהספר קובע יכול להתקיים בלי חשבון משתמש מקושר.
- אין ישות `Child` נפרדת — פרטי הילד נשמרים ברמת התור (`attendee_name`, `attendee_type`).
- **שלוש פעולות נפרדות ושונות על תור/יום, אל תתבלבלו ביניהן:** "ביטול תור בודד" (`cancelAppointmentAction`) הוא soft — רק מחליף `status` ל-`cancelled`, הרשומה נשארת. "מחיקת היסטוריה" (`deleteWorkDayAction`/`deleteAllWorkDaysAction`) היא hard delete אמיתי — מחיקה מלאה, לא שמירה בארכיון, מסתמכת על ה-cascade בסכימה. "חסימת יום" (`WorkDay.is_blocked`, `setWorkDayBlockedAction`, 2026-07-26) לא מוחקת ולא מבטלת כלום — רק חוסמת קביעה/שינוי תור **חדשים** של לקוחות לאותו יום; הפיכה לגמרי (טוגל).
- לכל תור יכולה להיות בקשת ביטול פעילה אחת בו־זמנית, ולכל היותר בקשת תור (`BookingRequest`) אחת (נוצרת רק כשהתור נקבע בזמן שהמדיניות "דורש אישור" דלוקה).
- `BookingRequest` אינה "כוונה" — ה-`Appointment` הנלווה נוצר מיד עם סטטוס `scheduled` ותופס את השעה ביומן מרגע הבקשה; דחייה משנה את הסטטוס ל-`cancelled` ומשחררת את השעה, אישור לא נוגע בתור כלל.
- `AppSettings` היא שורה יחידה קבועה (`id = "singleton"`, ראו `settings.ts`'s get-or-create) — לא טבלת key-value כללית; אם יתווספו הגדרות גלובליות נוספות, כנראה עדיף עמודות נוספות לאותה שורה.
- `WaitlistEntry` כללית במכוון — לא משויכת לתאריך/שעה/שירות ספציפיים; `user_id` הוא `@unique`, אז לקוח יכול להיות ברשימה פעם אחת בלבד (הצטרפות חוזרת = no-op, לא כפילות).

## שירותים ומשכי זמן (קבועים ב-PRD, לא להמציא ערכים אחרים)

| שירות | משך |
|---|---|
| תספורת מבוגר | 10 דק' |
| תספורת + זקן | 15 דק' |
| תספורת ילד | 10 דק' |
| הסרת שיער בלייזר | 10 דק' |
| חלאקה | 15 דק' |
| תספורת מבוגר + טיפול לייזר | 20 דק' |

## חוקי עסק קריטיים

- מוצגות ללקוח רק שעות פנויות בתוך ימי עבודה שהספר פתח — אסור חפיפה בין תורים, ואסור גם שעה שכבר עברה (גם אם היא בתוך יום עבודה פתוח שטרם הסתיים).
- שינוי תור מותר רק לשעה פנויה שעדיין לא עברה; שולחת הודעה על השינוי.
- **מדיניות "דורש אישור" (`AppSettings.requires_approval`, ברירת מחדל כבויה) קובעת גלובלית את ההתנהגות של קביעת תור חדש *וגם* של בקשת ביטול:**
  - דלוקה: קביעת תור נשמרת כ-`BookingRequest` ממתין (התור עצמו כבר תופס את השעה); בקשת ביטול נשמרת כ-`CancellationRequest` ממתינה — בשני המקרים רק החלטת הספר קובעת בפועל.
  - כבויה: גם קביעת תור וגם בקשת ביטול קורים **מיידית**, בלי המתנה להחלטת הספר.
  - אל תניחו שביטול/קביעה **תמיד** דורשים אישור מפורש — זה תלוי במתג, בדקו את `getRequiresApproval()`.
- מחיקת יום/תור דורשת הודעת אזהרה ואישור מפורש לפני ביצוע.
- איפוס סיסמה — קוד חד־פעמי ב-SMS, לא מייל.
- הרשאות: מסכי ניהול נגישים רק ל-`administrator`; לקוח לא מחובר לא יכול לערוך תורים.
- **גישה ל-`/admin` חייבת שתי הגנות בו-זמנית, לעולם לא רק אחת:**
  1. `apps/web/src/proxy.ts` — רץ ב-edge *לפני* כל קוד עמוד, על כל נתיב תחת `/admin/:path*` (matcher). זו ההגנה שמונעת גישה ע"י הקלדת URL בלבד, גם אם עמוד ספציפי ישכח לבדוק הרשאה.
  2. `requireAdmin()` (`lib/auth/session.ts`) — נקרא בתוך כל עמוד/`page.tsx` תחת `/admin`.
  כל נתיב/עמוד ניהול חדש (כולל routes דינמיים כמו `/admin/day/[id]`) **חייב** גם להיכלל תחת ה-matcher ב-`proxy.ts` וגם לקרוא ל-`requireAdmin()` בעצמו — אף אחד מהשניים אינו תחליף לשני. (הערה: Next.js 16 החליף את השם `middleware.ts` ב-`proxy.ts` — קובץ בשם `middleware.ts` יגרום להתנגשות ולקריסת השרת אם `proxy.ts` כבר קיים.)
- **`COOKIE_SECURE`** (`.env`, ראו `.env.example`) — עוקף את ברירת המחדל (`NODE_ENV === "production"`) לדגל ה-`Secure` של עוגיית הסשן. `next start` תמיד מפעיל `NODE_ENV=production`, וללא HTTPS אמיתי עוגיית `Secure` נזרקת בשקט ע"י הדפדפן — כניסה "לא עובדת" בלי שום שגיאה גלויה. יש להשאיר `COOKIE_SECURE=false` כל עוד משרתים HTTP גולמי (כתובת IP:פורט, בלי דומיין+TLS), ולהסיר/להפוך ל-`true` ברגע שיש HTTPS אמיתי.

## אבטחה — כללים לסוכן הקוד

- **לעולם אל תקרא/תדפיס `.env`/`apps/worker/.env`/`~/.ssh`/`~/.aws`** — נאכף גם ע"י `permissions.deny` וגם ע"י PreToolUse hook חוסם (`.claude/hooks/block-secrets.sh`, `exit 2`) ב-`.claude/settings.json`; זו לא רק בקשה התנהגותית.
- שאילתות מסד נתונים תמיד דרך Prisma (מפרמט אוטומטית) — לעולם לא `$queryRaw`/`$executeRaw` עם קלט לא-סניטייז.
- כל mutation שמקבל id צריך לבדוק בעלות/הרשאה בצד השרת לפני נגיעה ברשומה (ראו את דפוס `booked_by_user_id !== session.sub` ב-`booking.ts`/`cancellationRequests.ts`) — אל תסמכו על כך שה-UI לא מציג כפתור.
- ברירת מחדל תמיד סגורה: פעולת אדמין חדשה חייבת `requireAdmin()`/`requireAdminSession()`, ונתיב `/admin` חדש חייב גם להיכלל ב-matcher של `proxy.ts` (שני השכבות ביחד, לא אחת בלבד — ראו "גישה ל-`/admin`" למעלה).
- זרימות אימות (login, reset-password) עוברות דרך `apps/web/src/lib/rateLimit.ts` (in-memory, per-process — ראו את ההערה בקובץ על המגבלה בפריסה מרובת-אינסטנסים) — כל endpoint אימות חדש שמנחש credential (סיסמה/קוד) חייב rate limit דומה.
- אל תדפיסו OTP/סיסמה/טוקן ל-console בקוד חדש — `MockSmsProvider` (`packages/shared/src/sms.ts`) כבר עושה redact כברירת מחדל לקודי OTP.
- ידוע ופתוח (לא תוקן, דורש החלטה אדריכלית): אין revocation לסשן קיים בעת reset סיסמה — JWT stateless. אל תניחו שסשן "מבוטל" אחרי reset.
- **סשן "זכור אותי" (sliding session, נוסף 2026-08-09):** עוגיית הסשן אינה 30 יום קבועים מרגע ההתחברות — `proxy.ts` מרעננת אותה (חותמת טוקן חדש עם `iat`/`exp` חדשים, `signSession`) בכל בקשה מאומתת ל-`/account/*`/`/admin/*`, כך שהחלון מתחדש ל-30 יום נוספים מכל ביקור פעיל. המשמעות: לקוח/אדמין פעיל (חוזר לפחות פעם ב-30 יום) לא מתנתק לעולם עקב חלוף זמן קלנדרי — רק חוסר פעילות אמיתי מעבר ל-30 יום או logout מפורש. `cookieSecure()` הועבר מ-`session.ts` ל-`jwt.ts` (edge-safe, בלי `server-only`/`next/headers`) כדי ש-`proxy.ts` (edge middleware) יוכל להשתמש בו גם כן. שימו לב: זה מגביר את המשמעות המעשית של הפסקה הקודמת — טוקן שממשיך "לחיות" (מוצג לפחות פעם ב-30 יום, כולל טוקן לפני reset סיסמה שלא בוטל) הופך בפועל לבלתי-מוגבל בזמן, לא רק ל-30 יום מקסימום.

## עיצוב (Design System)

מסמכי מקור: אין קובץ עיצוב נפרד — הכללים כאן הם המקור היחיד. הבסיס נקבע בשיחה עם המשתמשת ב-2026-07-19; **ב-2026-07-21 נוסף ערכת נושא בהירה חדשה למסכי הלקוח**, מבוססת על קובץ פיגמה שהמשתמשת בנתה ("Hair Salon | Barber Shop | Salon | App UI Design Template (Community)" — תבנית קהילתית שהיא התאימה עם לוגו "Yossi Barber" אמיתי; שאר התוכן בה היה placeholder ולא הועתק כמות שהוא).

**ב-2026-07-25 האפליקציה אוחדה לערכת נושא בהירה אחת גלובלית** — עד אז `/admin` היה על ערכת נושא כהה נפרדת ומכוונת (תועד כאן בעבר כ"שתי ערכות נושא במקביל, לא אחת שהוחלפה"); זה בוטל. הסיבה: לוגו חדש שהמשתמשת סיפקה (ראו "לוגו" למטה) מבוסס שחור+זהב על רקע בהיר, ולא היה קריא על הרקע הכהה של `/admin` — ובמקום לתחזק שתי ערכות נפרדות רק כדי לפתור את זה, כל `/admin` עבר לאותה ערכת נושא בהירה שכבר הייתה קיימת במסכי הלקוח (ראו "פלטת צבעים" למטה). טוקני הצבע הכהים (`prussian-blue`/`space-indigo`/`dusk-blue`/`tropical-teal`/`neon-ice`) הוסרו לגמרי מ-`globals.css` ומכל הקוד.

**היחיד שנשאר בהיר-מסיבה-נפרדת ולא קשור למיתוג:** עמודי הדפסה/ייצוא (`admin/day/[id]/print`, `admin/print-all`) — נשארים `bg-white`/`text-gray-*` פשוטים, לא טוקני `cream`/`barber-teal`, כי הם מיועדים להדפסה/PDF בפועל ולא חלק מהעיצוב הממותג.

### חיבור לפיגמה

- טוקן API אישי שמור ב-`.env` בתור `FIGMA_ACCESS_TOKEN` (לא ב-git). קובץ הייחוס: file key `RLOrFLhV7pQErRxAUiA3do`.
- משיכת מסכים: `GET https://api.figma.com/v1/files/{key}?depth=2` לרשימת frames, ואז `GET https://api.figma.com/v1/images/{key}?ids=<node-ids>&format=png` לתמונות. אין סקריפט קבוע לזה עדיין — נעשה אד-הוק דרך `curl` בשיחה מ-2026-07-21; אם זה יקרה שוב בתדירות, שווה להפוך לסקריפט ב-`scripts/`.

### לוגו

**היסטוריה (חשוב להבין כדי לא להתבלבל בין גרסאות ישנות בקוד/מסמכים ישנים):** היה לוגו ישן (`logo.svg`, JPEG עטוף ב-SVG, קומפוננטת `<Logo/>`) שהוצג בתחתית העמוד בתוך תיבה ממוסגרת. ב-2026-07-25 המשתמשת סיפקה לוגו חדש (`~/winmux-drops/new logo1.svg` — קובץ Figma שכלל את האמנות **וגם** רקע גרדיאנט אפוי-בפנים + מסגרת). אחרי כמה סבבי איטרציה (ראו היסטוריית git אם צריך את הפרטים), המצב הנוכחי (2026-07-26) הוא:

- **קובץ אחד משותף לכל האפליקציה:** `apps/web/public/logo-cropped.png` — האמנות בלבד, רקע שקוף (alpha אמיתי). זה **הלוגו היחיד** שקיים כרגע בקוד — `logo.svg` הישן, קומפוננטת `<Logo/>`, `admin-logo.svg` (הגרסה המרובעת עם הגרדיאנט אפוי-בפנים) ו-`admin-logo-cropped.svg`/`admin-logo-cropped.svg` (שמות ביניים, **SVG**) **נמחקו כולם**.
  - **למה PNG ולא SVG (תקלה אמיתית, תוקנה 2026-07-26):** הגרסה המקורית של `new logo1.svg` (וכל הגזירות שלה) השתמשה ב-`<mask>`/`<pattern>`/`<image>` מקוננים כדי לדמות רקע שקוף — זה נראה תקין ב-Chromium שולחני (הכלי היחיד שהיה זמין לאימות בסביבת הפיתוח), אבל המשתמשת דיווחה שהלוגו **לא מופיע בכלל** בדפדפן נייד אמיתי — הסימפטום הקלאסי של mask/pattern SVG מורכב שלא נתמך אחיד בין מנועי רינדור (בפרט WebKit/מובייל Safari). הפתרון: רינדור חד-פעמי של ה-SVG ברזולוציה כפולה עם alpha אמיתי, ושטיחה ל-PNG שקוף רגיל — נתמך זהה בכל דפדפן, בלי תלות ביכולות mask. **אם הלוגו צריך להשתנות אי-פעם, ליצור PNG חדש באותה שיטה (רינדור+שטיחה) מתוך קובץ המקור — לא לחזור ל-SVG מבוסס mask, ולא לערוך את ה-PNG ידנית.**
- **מוצג דרך שני קומפוננטים כמעט-זהים (לא אוחדו לאחד, כי הם חיים בשני חלקים שונים של העץ):**
  - **מסכי לקוח** — `<BrandHero />` (`apps/web/src/components/BrandHero.tsx`).
  - **`/admin`** — `<AdminBrandHero />` (`apps/web/src/components/AdminBrandHero.tsx`), מוזרם דרך ה-`topBanner` prop של `<PageHeader/>` (ראו למטה) — לא מוכנס ישירות ב-JSX של כל עמוד.
  - שניהם: גרדיאנט `from-barber-teal/50 to-cream` (טורקיז למעלה, נמס לקרם למטה — נבנה ב-Tailwind, לא חלק מהקובץ), `-mx-6` לפריסה מלאה לרוחב, **בלי** תיבה/מסגרת סביב הלוגו (רק התמונה עצמה על הגרדיאנט), גובה קבוע `90px` ורוחב `auto`.
- **מיקום: בראש העמוד** (לא בתחתית — שונה מהעיצוב המקורי מ-2026-07-21/25) — מיד אחרי `<BsdBar/>` ולפני הכותרת/תוכן העמוד. אצל הלקוח מוכנס ידנית ב-JSX (`<BsdBar/>` ואז `<BrandHero/>` ואז ה-`<h1>`); ב-`/admin` מוכנס אוטומטית על ידי `<PageHeader topBanner={<AdminBrandHero/>} title=.../>` (ראו הסבר `PageHeader` למטה) — **אין** יותר `mt-auto`/מיקום בתחתית, וממילא `flex flex-col` על ה-`<main>` כבר לא קריטי לצורך הזה (נשאר בכל זאת כמוסכמת layout).
- כל עמוד לקוח חדש **חייב** לכלול `<BrandHero />` מיד אחרי `<BsdBar/>`. כל עמוד `/admin` חדש **חייב** להעביר `topBanner={<AdminBrandHero/>}` ל-`<PageHeader/>`.

### "בס"ד" — `BsdBar` (כל האפליקציה)

בכל עמוד באפליקציה (מסכי לקוח **וגם** `/admin`), "בס"ד" מוצג דרך `<BsdBar />` (`apps/web/src/components/BsdBar.tsx`) — רכיב אחד משותף, לא כפול. ממוקם כילד ראשון תחת ה-`<main>`, `sticky top-0`, כך שנשאר גלוי תמיד גם בגלילה, מעל שאר התוכן. שובר את ה-`p-6` של ה-`<main>` עם `-mx-6 -mt-6` כדי להיצמד לרוחב וגובה מלאים. כל עמוד לקוח חדש **חייב** לכלול אותו כילד הראשון תחת ה-`<main>` (ואז `<BrandHero/>` מיד אחריו, ראו למעלה). ב-`/admin` הוא מגיע דרך `<PageHeader title?: string; topBanner?: ReactNode />` (`apps/web/src/components/PageHeader.tsx`), שמחזיר `<><BsdBar/>{topBanner}{title && <h1>...</h1>}</>` כ-fragment (לא עטוף ב-`div` נוסף) — כדי שה-`-mx-6 -mt-6` של `BsdBar` יעבוד נכון גם כש-`PageHeader` הוא הילד הראשון תחת ה-`<main>` של עמוד `/admin`. ה-`topBanner` הוא סלוט אופציונלי בין `BsdBar` לכותרת — כרגע כל 9 עמודי ה-`/admin` מעבירים `<AdminBrandHero/>`.

### פלטת צבעים (אפליקציה כולה, 2026-07-21, מפיגמה)

| טוקן | HEX | תפקיד |
|---|---|---|
| `cream` | `#fdf8f0` | רקע בהיר גלובלי (`body`, כל `<main>` באפליקציה) |
| `barber-teal` | `#508186` | צבע מותג ראשי — כותרות, מסגרות, כפתורים, קישורים |
| `barber-teal-dark` | `#3d666a` | גוון כהה יותר של הטורקיז, לשימוש עתידי (hover/pressed) — לא בשימוש פעיל עדיין |
| `ink` | `#1f2421` | טקסט ראשי כהה |
| `slate-muted` | `#7c7c7c` | טקסט משני/placeholder |
| `cream-text` | `#fffcf7` | טקסט לבן-שבור על רקע `barber-teal` מלא (כפתורים) |

**מוסכמות רכיבים (כל האפליקציה, כולל `/admin` מ-2026-07-25):** שדות טקסט — `rounded-xl` (לא `rounded` רגיל), מסגרת `border-barber-teal`, רקע לבן. כפתורים ראשיים — `rounded-full` (פיל מלא), רקע `bg-barber-teal`, טקסט `text-cream-text`. כפתורים משניים — `rounded-full` עם מסגרת בלבד (`border-barber-teal text-barber-teal`, ללא מילוי). כרטיסי מידע (הודעות, תורים) — `rounded-xl border-barber-teal bg-white`. אלו נלקחו ישירות מ-corner-radius שנמדדו בקובץ הפיגמה (כ-10px לשדות, ~200px+ לכפתורים — בפועל pill מלא בכל גובה סביר). **כפתורי מחיקה/הרס** (מחיקת יום עבודה, הסרת חסימה וכו') חורגים מהצבע הזה בכוונה — נשארים `text-red-600`/`border-red-600` סמנטית אדומים, אבל עם אותה צורה (`rounded-full` לכפתור בודד, `rounded-xl` לפאנל אישור עם כמה כפתורים).

### לוח שנה — שני מימושים נפרדים (`account/book` ו-`/admin`), אל תתבלבלו ביניהם

**מסך לקוח (`DateCalendar`, בתוך `account/book/page.tsx`, לא מופרד לקובץ נפרד — קטן מספיק כרגע):** רשת חודשית אמיתית (RTL, יום ראשון בצד ימין), רק תאריכים שקיימים ב-`getOpenDates()` ניתנים ללחיצה (עיגול טורקיז מלא), השאר מוצגים דהויים ולא לחיצים. ניווט בין חודשים מוגבל לחודשים שבהם יש בפועל תאריך פתוח אחד לפחות (נגזר מ-`dates`, לא כל חודש קלנדרי) — כדי שלא יהיה אפשר "לתעות" בחודשים ריקים. שעות פנויות (`slot` step) עברו מגריד מלבנים לכפתורי-פיל עגולים (`rounded-full`).

**מסך אדמין (`AdminDateCalendar`, בתוך `apps/web/src/app/admin/OpenWorkDayForm.tsx`, ב"פתיחת יום עבודה חדש") — אותו עיצוב ויזואלי, לוגיקה הפוכה (2026-07-26):** כאן הספר הוא זה שפותח יום, אז **כל** תאריך עתידי לחיץ (לא רק רשימה סגורה), חוץ מתאריכי עבר ותאריכים שכבר קיימים כיום עבודה פתוח (מוצגים דהויים/disabled). ניווט חודשים חופשי קדימה, חסום אחורה מהחודש הנוכחי. **תבנית UI חשובה שכדאי לחזור עליה בעתיד:** הלוח לא מוצג תמיד פתוח — יש שדה קומפקטי (נראה כמו `<input>` רגיל, מציג את התאריך שנבחר או "בחרו תאריך") שבלחיצה עליו פותח את הלוח כ"פופאפ" מתחתיו (`calendarOpen` state); בחירת תאריך סוגרת אותו חזרה. זה נמנע מלוח שנה תפוס-שטח שתמיד גלוי בעמוד.

**מוסכמת כותרות (מ-2026-07-26):** כל כותרת עמוד (`<h1>`, כולל `PageHeader`'s title ב-`/admin`) ממורכזת (`text-center`) — כולל מקרים עם כפתור "חזרה" לצידה (`forgot-password`/`reset-password`): במקרה כזה יש `div` מרווח שקוף (`w-[22px]`, תואם לרוחב ה-`BackIcon`) בצד הנגדי לכפתור, כדי שהכותרת (`flex-1 text-center`) תהיה ממורכזת אמיתית ביחס לרוחב כל השורה, לא רק ביחס למקום הפנוי שנשאר לה.

### פונט

- **Rubik** (Google Fonts, `next/font/google`, subsets `hebrew`+`latin`), נטען גלובלית ב-`app/layout.tsx` על תגית ה-`<html>`. אין להוסיף אותו שוב בעמודים בודדים. משמש את כל האפליקציה. (חריג ידוע: `app/(auth)/login/page.tsx` דורס אותו מקומית ל-`Heebo` — לא קשור לאיחוד ה-2026-07-25, סטייה ישנה יותר שלא טופלה כאן.)

## מפורשות מחוץ לסקופ (Out of Scope)

אין לממש: תשלום/סליקת אשראי באפליקציה, מערכת נאמנות, דירוגים/ביקורות, ריבוי סניפים, צ'אט לקוח-ספר. (ריבוי ספרים באותה מספרה **כן** קיים — ראו "ספרי משנה" למטה — מה שנשאר מחוץ לסקופ הוא ריבוי מספרות/סניפים נפרדים.)

## מצב נוכחי

מונוריפו pnpm פעיל: `apps/web` (Next.js), `apps/worker`, `packages/db` (Prisma), `packages/shared`. הרוב עדיין לא committed (יש שינויים מצטברים ב-worktree) — יש להריץ `git status`/`git diff` לפני שמניחים שמשהו כבר בהיסטוריה.

**קיים ועובד (נבדק ידנית בדפדפן):**
- **אימות לקוח** — הרשמה/כניסה/יציאה/איפוס סיסמה (SMS מדומה דרך `packages/shared/src/sms.ts`).
- **קביעת תור ללקוח** (`account/book`) — בחירת שירות (כולל שירותי ילד, ללא צ'ק-בוקס — `Service.is_child_service` קובע אם מבקשים שם ילד), תאריך, שעה, קביעה נוספת חוזרת לאותה זרימה.
- **שינוי תור ללקוח** (`account/appointments` + `RescheduleButton`).
- **`apps/web/src/lib/availability.ts`** — `findAvailableSlots`/`isSlotAvailable`: רשת קבועה של 10 דקות מתחילת יום העבודה, מתיישרת מחדש בדיוק לסוף כל תור/הפסקה/חסימה (בלי מרווח) — כדי שלא יוצגו שתי אפשרויות בפער קטן מ-10 דקות גם כששירות אינו כפולה של 10. מכוסה בטסטים (`pnpm test` בתוך `apps/web`).
- **תיקון timezone**: כל תצוגת זמן משתמשת ב-`ISRAEL_TIME_ZONE` (`packages/shared`) במפורש — Server Components רצים בשעון השרת, לא בשעון ישראל, אז בלי `timeZone` מפורש התצוגה הייתה שגויה.
- **מסכי ניהול (`/admin`)** — מוגנים ע"י `requireAdmin()` (מפנה לקוח/לא-מחובר הצידה, לא רק מסתיר תוכן):
  - פתיחת יום עבודה חדש + הפסקות דינמיות.
  - עדכון שעות של יום פתוח (נחסם אם יש תור/הפסקה/חסימה מחוץ לטווח החדש).
  - צפייה בתורי יום + העברת תור לשעה אחרת באותו יום (`/admin/day/[id]`) — שולח SMS + רושם `Notification` ללקוח עם חשבון מקושר; תור ידני ללא חשבון מועבר בלי הודעה.
  - קביעת תור ידנית ללקוח ללא חשבון (שם בלבד, ללא טלפון).
  - חסימת/הסרת חסימה של מספרי טלפון (`/admin/blocked-customers`) — נאכף גם בהרשמה וגם בקביעה/שינוי תור, וחל גם על מספרים שטרם נרשמו.
  - **ביטול תור בודד** (`CancelAppointmentButton`, US-017) — soft, הופך `status` ל-`cancelled` ומשחרר את השעה מחדש; שולח SMS+`Notification` ללקוח עם חשבון מקושר.
  - **מחיקת יום/כל היומן לצמיתות** (US-012, "מחיקת היום כולו" ב-`/admin/day/[id]`, "מחיקת כל היומן" ב-`/admin`) — hard delete אמיתי (cascade), עם עותק להדפסה/PDF אופציונלי לפני (`/admin/day/[id]/print`, `/admin/print-all`) והודעת ביטול לכל לקוח עם תור פעיל מקושר בטווח שנמחק.
  - **אישור/דחיית בקשות ביטול** (`/admin/cancellation-requests`, US-008).
- `zonedTimeToUtc()` ב-`packages/shared` — ממיר שעון קיר ישראלי (כולל שעון קיץ/חורף, בלי ספריית tz) ל-UTC; משמש את כל טפסי הניהול.
- `runSerializable()` הועבר ל-`apps/web/src/lib/serializableTransaction.ts` (לא בקובץ `"use server"`) כדי שיהיה ניתן לשימוש חוזר משם.
- `notifyAppointmentCancelled()` ו-`sendCustomerNotification()` (גנרי) ב-`apps/web/src/lib/notifyCustomer.ts` — המקום היחיד שכותב ל-`Notification`; `appointment_id`/`cancellation_request_id` מושארים `null` כשמדובר במחיקה קשה (הרשומה לא שורדת, אי אפשר להצביע אליה).
- **חשוב:** לפני שליחת הודעת ביטול על תור, תמיד לבדוק גם `starts_at >= new Date()` (לא רק `status === "scheduled"`) — אין בסכימה סטטוס "הסתיים" נפרד, אז תור היסטורי נשאר `scheduled` לנצח ועלול לגרום להודעת "בוטל" מטעה על משהו שכבר קרה, אם שוכחים את הבדיקה הזו (זו הייתה תקלה אמיתית שתוקנה ב-`deleteWorkDayAction`/`deleteAllWorkDaysAction`/`cancelAppointmentAction`).
- `account/appointments` **כבר** מסנן `starts_at >= now` — הלקוח אף פעם לא רואה תורים שהתאריך שלהם עבר; אין צורך בשינוי נוסף כדי לממש את זה.
- **בקשת ביטול מהלקוח** (US-008, `CancellationRequest`) — לקוח שולח בקשה מ-`account/appointments` (`RequestCancellationButton`). **ההתנהגות תלויה במדיניות "דורש אישור" (ראו למטה):** כשהיא דלוקה, הבקשה ממתינה עד שהספר מאשר/דוחה ב-`/admin/cancellation-requests` (badge מספר ממתינות ב-`/admin`) — רק אישור משנה את `Appointment.status` ל-`cancelled` בפועל, דחייה משאירה את התור פעיל, והלקוח מקבל הודעה על ההחלטה (`type: cancellation_decision`). כשהיא כבויה, `requestCancellationAction` מבטלת את התור **מיידית** בלי ליצור `CancellationRequest` כלל — אותה תוצאה כמו ביטול ישיר ע"י הספר. `CancellationRequest.appointment_id` הוא `@unique` בסכימה — רק שורה אחת אי-פעם לכל תור, אז בקשה שנדחתה מתעדכנת בחזרה ל-`pending` בבקשה נוספת במקום ליצור שורה שנייה.
- **מדיניות "דורש אישור"** (US-018, `AppSettings`, `apps/web/src/lib/actions/settings.ts`) — מתג יחיד וגלובלי (`getRequiresApproval()`/`setRequiresApprovalAction()`) שנקרא גם בקביעת תור וגם בבקשת ביטול; לא לפי יום/לקוח/שירות. מוגדר ב-`/admin/settings` (`ApprovalToggle`). ברירת מחדל: כבוי.
- **בקשות תורים** (US-019/US-020, `BookingRequest`) — כשהמדיניות דלוקה, `bookAppointmentAction` יוצרת את ה-`Appointment` (סטטוס `scheduled`, תופס את השעה מיד) **וגם** `BookingRequest` (`pending`) לצידו, ומחזירה `pendingApproval: true` ללקוח (מסך "הבקשה שלך נשלחה לאישור הספר" ב-`account/book`) במקום את התראת "נקבע תור חדש" הרגילה למנהל. הספר מאשר/דוחה ב-`/admin/booking-requests` (badge ב-`/admin`, `getPendingBookingRequestCount()`): אישור לא נוגע בתור; דחייה הופכת אותו ל-`cancelled` (ומפעילה `notifyWaitlistOfFreedSlot` אם השעה עדיין עתידית) ושולחת ללקוח הודעת `booking_decision`.
- **התראות מנהל** (US-021, `notifyAdmin.ts`, `adminNotifications.ts`, `/admin/notifications`) — כשהמדיניות כבויה, כל תור שלקוח קובע לעצמו (`notifyAdminsOfNewBooking`) יוצר `Notification` מסוג `appointment_booked` לכל מנהל (בתוך האפליקציה בלבד, בלי SMS); תור ידני שהספר קובע לא מפעיל את זה. badge ב-`/admin` סופר לפי `read_at IS NULL`; `markAdminNotificationsReadAction` היא "סמן הכל כנקרא" (bulk `updateMany`) — אין סימון פר-שורה.
- **רשימת המתנה** (US-022–US-025, `WaitlistEntry`, `apps/web/src/lib/actions/waitlist.ts`) — כללית, לא לפי תאריך/שירות; `user_id` הוא `@unique` אז הצטרפות חוזרת היא no-op. `joinWaitlistAction`/`leaveWaitlistAction`/`isOnWaitlist` בצד הלקוח (`account/book`, `LeaveWaitlistButton` ב-`/account`); `getWaitlistEntries`/`removeWaitlistEntryAction` בצד הספר (`/admin/waitlist`) — הסרה ידנית, בלי הודעה ללקוח. **שלושה** טריגרים נפרדים להודעה (`type: waitlist_slot_available`, דרך helper משותף `notifyAllWaitlistEntries`): (1) `notifyWaitlistOfFreedSlot` — כל ביטול תור עתידי (ביטול ישיר ע"י הספר, אישור/ביטול-מיידי של בקשת ביטול, דחיית בקשת תור); (2) `notifyWaitlistOfExtendedHours` — כש-`updateWorkDayHoursAction` **מרחיבה** יום שכבר פתוח (טווח חדש רחב מהישן); (3) `notifyWaitlistOfNewWorkDay` — כש-`createWorkDayAction` פותחת יום חדש **לגמרי** (תוקן 2026-07-26 — עד אז זה היה חסר: לקוח שהצטרף לרשימת ההמתנה כש**אין אף יום פתוח** מעולם לא קיבל התראה, כי פתיחת היום הראשון אינה "הרחבה" של כלום). ב-`account/book` מצב "אין ימים פתוחים" מנוסח כ"התרע/י לי כשייפתחו תאריכים לקביעת תורים" (לא "רשימת המתנה" גנרית) — אותו מנגנון בדיוק, רק ניסוח ממוקד למקרה הזה.
- **חסימת יום מקביעת תורים חדשים** (`WorkDay.is_blocked`, נוסף 2026-07-26) — הטוגל (`BlockDayToggle`) קיים בשני מקומות: הגרסה המלאה (עם טקסט הסבר) ב-`/admin/day/[id]`, וגרסה קומפקטית (`compact` prop, נוסף 2026-07-26) ממש מתחת לקישור "ניהול היום" בכל שורת יום ברשימת "ימי עבודה פתוחים" במסך הראשי של `/admin` — שתיהן קוראות לאותה `setWorkDayBlockedAction`, אין לוגיקה כפולה. חוסם קביעה/שינוי תור **של לקוחות** בלבד — התורים הקיימים לא נפגעים, וקביעת תור ידנית ע"י הספר (`CreateManualAppointmentForm`) עדיין עובדת. נאכף בשלוש שכבות: `getOpenDates()` (לא מציגה יום חסום ללקוח בכלל), `bookAppointmentAction`/`rescheduleAppointmentAction` (זורקות `DAY_BLOCKED` כרשת ביטחון גם אם המסך אצל הלקוח לא עדכני). badge "חסום" מוצג ליד היום ברשימת "ימי עבודה פתוחים" ב-`/admin`. שונה במפורש מ-`BlockedTime` (חוסם טווח שעות בתוך יום, לא את כל היום) ומ"מחיקת יום" (hard delete בלתי הפיך) — שלוש דרכים נפרדות ושונות לגמרי לטפל ביום, אל תתבלבלו ביניהן.
- **מתג כיבוי גלובלי לקביעת תור טלפונית (IVR)** (`AppSettings.ivr_enabled`, נוסף 2026-08-09, בקשה ישירה) — אותו דפדוף בדיוק כמו "דורש אישור" (`getIvrEnabled`/`setIvrEnabledAction` ב-`apps/web/src/lib/actions/settings.ts`, טוגל `IvrToggle` ב-`/admin/settings`). ברירת מחדל: פעיל (`true`). כשכבוי, `startCall()` (`lib/ivr/flow.ts`) בודק את המתג כדבר הראשון — **לפני** `identifyCaller`/כל כתיבה ל-DB — ועונה למתקשר "לא ניתן לקבוע תורים כרגע דרך הטלפון" ומנתקת מיד; לא נוצר `CallState` כלל, כך שאין מה ל-`continueCall()` לנקות. שונה לגמרי מ`BlockedPhoneNumber`/`identity.outcome === "blocked"` (חסימה פר-מספר טלפון) — זה חוסם את כל הקו לכולם, בלי קשר לזהות המתקשר.
- **חסימת שעות שעברו** (FR-28) — `getSlotsForDate` מסננת שעות עם `d < now` לפני שהן מוצגות ללקוח; `bookAppointmentAction`/`rescheduleAppointmentAction` בודקות שוב `starts_at < new Date()` בתוך הטרנזקציה עצמה (זורקות `PAST_SLOT`) כרשת ביטחון למקרה שהמסך אצל הלקוח לא עדכני. הבדיקה **לא** בתוך `findAvailableSlots`/`isSlotAvailable` עצמן (`apps/web/src/lib/availability.ts`) — הן נשארות טהורות/דטרמיניסטיות ומכוסות ב-11 הטסטים הקיימים; הסינון לפי "עכשיו" הוא רק בשכבת ה-action.
- **הודעות כלליות** (US-009, `Announcement`) — הספר מפרסם ב-`/admin/announcements`; מוצגות ללקוח ב-`/account` (הכי חדשה קודם). ללא SMS/Notification per-customer — ה-PRD דורש רק תצוגה באפליקציה, לא שידור טקסטים. כרטיס ההודעה אצל הלקוח (2026-07-26): רקע גרדיאנט אלכסוני `bg-gradient-to-bl from-barber-teal to-cream` (טורקיז בפינה הימנית-עליונה נמס לקרם בפינה השמאלית-תחתונה — אותה זוגיות צבעים כמו רקע הלוגו, ראו "לוגו" למעלה, אבל אלכסוני במקום אנכי ובלי `/50` כי כאן יש טקסט על גביו). הטקסט בכרטיס `text-ink` (כהה) ולא `text-cream-text` (לבן) כמו קודם — לבן היה נעלם על הקצה הבהיר של הגרדיאנט.
- **ספרי משנה** (`Barber`, נוסף 2026-08-03) — הספר (admin היחיד שמתחבר) יכול להוסיף ספרים שעובדים תחתיו דרך `/admin/barbers` (שם בלבד, בלי login נפרד — `Barber` היא ישות "שם + יומן" גרידא, לא חשבון `User`). לכל `Barber` יומן `WorkDay` נפרד לגמרי (`WorkDay.barber_id`, אילוץ ייחודיות `[barber_id, work_date]` — שני ספרים יכולים לפתוח את אותו תאריך במקביל). `Barber.is_primary` מסמן את הספר המקורי/הראשי (מ-seed, `id: "primary"`) שמציע את כל 6 השירותים; ספר-משנה (`is_primary: false`) מוגבל לשלושה שירותים קבועים בלבד — `SUB_BARBER_SERVICE_NAMES` ב-`packages/shared` (תספורת מבוגר, תספורת + זקן, תספורת ילד) — לא ניתן להגדרה פר-ספר, זה כלל קבוע. הלקוח בוחר ספר כצעד ראשון ב-`account/book` (מדלג אוטומטית אם יש רק ספר פעיל אחד — כלומר לפני הוספת ספר-משנה ראשון, ה-flow זהה לגמרי למה שהיה) ואז ממשיך לתאריך/שירות/שעה כרגיל, הכל מסונן דרך `getOpenDates(barber_id)`/`getServices(barber_id)`. שינוי מועד תור (`RescheduleButton`) **יכול** להעביר תור לספר אחר, בתנאי שהשירות הקיים של התור מוצע גם על ידו — נאכף בשרת (`SERVICE_NOT_OFFERED`) בנוסף לסינון ב-UI. השבתת ספר (`is_active`, לא מחיקה — `WorkDay.barber_id` הוא `onDelete: Restrict`) מסתירה אותו מבוררי הלקוח אבל משאירה את היומן/התורים שלו נגישים לניהול אצל האדמין (`/admin?barber=<id>`); הספר הראשי לעולם לא ניתן להשבתה. רשימת ההמתנה (`WaitlistEntry`) ו-`AppSettings.requires_approval` **לא** הפכו למודעים-לספר — נשארו כלליים/גלובליים כפי שהיו, בכוונה (לא התבקש שינוי בהיקף שלהם).
- **`apps/worker`** — לא עוד placeholder: `node-cron` (כבר היה תלות מוצהרת מ-Phase 1) מריץ כל דקה `sendDueReminders()` (`apps/worker/src/reminders.ts`) שמאתר תורים `scheduled` עם חשבון מקושר שמתחילים בתוך `APPOINTMENT_REMINDER_LEAD_MINUTES` (120 דק', `packages/shared`) וללא `Notification` מסוג `appointment_reminder` קיים עדיין — האידמפוטנטיות מסתמכת רק על הבדיקה הזו (אין דגל "תזכורת נשלחה" נפרד בסכימה). נבדק ידנית קצה-לקצה (יצירת תור זמני 30 דק' קדימה, הרצה כפולה, מחיקה) — נשלחת פעם אחת בלבד. השרת דורש `apps/worker/.env` (מקומי, לא ב-git כמו שאר קבצי ה-.env) עם `DATABASE_URL`; `pnpm --filter @barberbook/worker dev` (או `pnpm worker` מהשורש) מריץ אותו עם `--env-file=.env`.
- `formatIsraelDate`/`formatIsraelTime` הועברו מ-`apps/web/src/lib/notifyCustomer.ts` ל-`packages/shared` כדי ש-`apps/worker` (חבילה נפרדת, בלי גישה ל-`apps/web`) יוכל להשתמש בהן גם כן.
- **PWA אמיתי עם אפשרות התקנה** (2026-08-04, `@serwist/next`) — `apps/web/src/app/sw.ts` הוא מקור ה-service worker (Serwist, לא next-pwa — לא תחזוקתי מספיק מול Next 16); `next.config.ts` עוטף אותו ב-`withSerwist` שמייצר `public/sw.js` בזמן build (git-ignored, ראו `.gitignore`). `public/site.webmanifest` תוקן ממדגם placeholder (`MyWebSite`) לערכי מותג אמיתיים (שם, `theme_color: #508186`, `background_color: #fdf8f0`, אייקונים `192/512` עם `purpose: "any maskable"`). הרישום בפועל בצד הלקוח הוא `<SerwistProvider swUrl="/sw.js" disable={NODE_ENV !== "production"}>` ב-`app/layout.tsx` — Serwist **לא** מזריק סקריפט רישום אוטומטי (בניגוד ל-next-pwa), חובה `SerwistProvider` מפורש. `<InstallPrompt/>` (`apps/web/src/components/InstallPrompt.tsx`) תופס `beforeinstallprompt` ומציג באנר התקנה מעוצב (`rounded-xl border-barber-teal`); ב-iOS (אין `beforeinstallprompt`) מציג הנחיה טקסטואלית "שיתוף ← הוסף למסך הבית" במקום. דחייה נשמרת ב-`localStorage` כדי לא להטריד שוב.
  - **גוֹצְ'ה קריטי ל-deploy:** Next.js 16 בררת המחדל היא Turbopack גם ל-`next build`, ו-Serwist (webpack-based) מתנגש איתו. `apps/web/package.json`'s `"build"` script שונה ל-`next build --webpack` בגלל זה. **תמיד להריץ `pnpm build` (או `pnpm --filter @barberbook/web build`) — לעולם לא `next build`/`pnpm exec next build` ישירות** (זה ידלג על הדגל ויכשל). **עדכון 2026-08-05: אותה בעיה קיימת גם ב-`dev`, לא רק ב-`build`** — בניגוד למה שהונח כאן קודם ("Serwist מכבה את עצמו מחוץ ל-production, זו רק אזהרה לא מזיקה"), בפועל `next dev` (טורבופאק כברירת מחדל) **קורס עם שגיאה** ("This build is using Turbopack, with a `webpack` config and no `turbopack` config") ברגע ריצה ראשון, לא רק מדפיס אזהרה. `apps/web/package.json`'s `"dev"` script שונה בהתאם ל-**`next dev --webpack`**.
- **התראות Push אמיתיות למנהל (2026-09-06, `web-push`)** — נפרד לגמרי מ-"התראות מנהל" (`Notification`/`/admin/notifications` badge, US-021 למעלה) שהוא in-app בלבד: זה מנגנון Web Push אמיתי, מציג התראת מכשיר/דפדפן גם כשהאפליקציה סגורה. נוסף אחרי שהמשתמשת דיווחה בבדיקות קבלה שאינה מקבלת שום התראה בפועל — התברר שהמנגנון הקודם היה in-app בלבד. מודל `PushSubscription` חדש (`user_id`, `endpoint` ייחודי, `p256dh`/`auth`) — מכשיר/דפדפן אחד לכל שורה, אדמין יכול להירשם ממספר מכשירים. מפתחות VAPID ב-`.env` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`, ראו `.env.example` והוראות deploy ב-`docs/DEPLOY.md`) — בהיעדרן `sendPushToAdmins()` (`apps/web/src/lib/push.ts`) היא no-op שקטה, שום flow קיים לא נשבר. `apps/web/src/app/sw.ts` מטפל ב-`push`/`notificationclick` (בנוסף ללוגיקת ה-precache הרגילה של Serwist). `<PushNotificationToggle/>` (`apps/web/src/components/PushNotificationToggle.tsx`) ב-`/admin/notifications` — הרשמה/ביטול חד-פעמיים למכשיר הנוכחי (`subscribeToPushAction`/`unsubscribeFromPushAction`, `apps/web/src/lib/actions/push.ts`), עם טיפול נפרד ב-iOS (Apple מחייבת שם התקנה בפועל למסך הבית לפני שWeb Push עובד בכלל — Android/Desktop לא צריכים התקנה). שלוש נקודות שליחה, שתיים מהן חדשות (לא היה שום דבר — לא in-app ולא push — קודם): `notifyAdminsOfNewBooking` (קיים, נוסף רק push) + שתי פונקציות חדשות `notifyAdminsOfBookingRequest`/`notifyAdminsOfCancellationRequest` (שתיהן `apps/web/src/lib/notifyAdmin.ts`) שנקראות מ-`booking.ts`/`bookViaPhone.ts`/`cancellationRequests.ts` בדיוק בענף ה-"דורש אישור" — קודם לכן בקשת תור/ביטול ממתינה לא יצרה שום `Notification` בכלל, רק ספרה ב-badge שנראה רק אם פותחים את `/admin`. שני ערכי `NotificationType` חדשים בהתאם: `booking_request_pending`/`cancellation_request_pending`.
- **Push גם ללקוחות + התראות מנהל על שינויים (2026-09-21/22, נבדק ע"י המשתמשת במכשיר אמיתי בשרת הפיתוח — הכפתור והתראות עובדים; תרחישים פרטניים ייתכן שלא כולם נבדקו):** אותו מנגנון Web Push וטבלת `PushSubscription` — `subscribeToPushAction` פתוחה לכל משתמש מחובר (לא רק אדמין), עם אימות `endpoint` מול allowlist של שירותי push אמיתיים (`apps/web/src/lib/pushEndpoint.ts`, מונע SSRF כי השרת שולח POST לכתובת) ותקרת 10 מכשירים למשתמש. `<PushNotificationToggle audience="customer"/>` ב-`/account`. **קוד השליחה עבר ל-`packages/db/src/push.ts`** (`sendPushToAdmins`/`sendPushToUser`/`sendPushToCustomers`, מיוצאים מ-`@barberbook/db`; `web-push` תלות של `packages/db`) כדי ש-`apps/web` וגם `apps/worker` ישתמשו באותו קוד; הפונקציות לא זורקות לעולם (כשל push לא מפיל קביעה/ביטול), no-op שקטה בלי VAPID, ורושמות `[push] delivery failed <status>` לכשל שאינו 404/410. `prisma` הועבר ל-`packages/db/src/client.ts` (`index.ts` מייצא מחדש) כדי למנוע import מעגלי. **ללקוח:** `sendCustomerNotification` שולחת גם push — מכסה שינוי/ביטול תור ע"י הספר (כולל מחיקת יום/יומן/ספר), החלטות על בקשות תור/ביטול ורשימת ההמתנה (שעות שהורחבו / יום חדש — רק לרשימת ההמתנה); `adminRescheduleAppointmentAction` עברה ל-`sendCustomerNotification`. **תור שהתפנה** (`notifyWaitlistOfFreedSlot(starts_at, service, owner_user_id)`, החלטת המשתמשת 2026-09-22): רשימת ההמתנה מקבלת כרגיל (שורת `Notification` + push) **וגם כל לקוח אחר שהפעיל push** מקבל את אותה הודעה עם השעה; בעל התור שהתפנה מוחרג (ידע כבר), ואיש לא מקבל פעמיים. **הודעה חדשה מהספר** → push לכל מנויי הלקוחות בלבד (בלי שורת `Notification`, ללא push על עריכה/מחיקה). **תזכורת לפני תור:** `apps/worker/src/reminders.ts` שולח עכשיו גם push — ה-worker צריך את משתני `VAPID_*` ב-`apps/worker/.env` (ב-Docker `env_file: .env` משותף, אין צורך בשינוי); בשרת הפיתוח רץ תחת pm2 בשם `barberbook-worker` (`pnpm exec tsx --env-file=.env src/index.ts` מתוך `apps/worker`). **לספר:** `notifyAdmin.ts` עם helper אחד (`notifyAdmins`) — תור חדש (אתר + IVR), בקשת תור/ביטול ממתינות, `notifyAdminsOfCustomerReschedule`, `notifyAdminsOfCustomerCancellation` (ביטול מיידי כשהמדיניות כבויה) ו-`notifyAdminsOfNewCustomer` (`NotificationType.customer_registered`, migration `20260922003000` — נקרא מ-`registerUserCore` ולכן מכסה גם הרשמה דרך הטלפון). **באג שתוקן:** `adminNotifications.ts` סינן רק `appointment_booked`, ולכן בקשות ממתינות לא הופיעו בפיד/ב-badge — עכשיו `ADMIN_NOTIFICATION_TYPES`. **החלטות שסוכמו:** העברת תור (ע"י לקוח/ספר) *לא* מודיעה על השעה הישנה שהתפנתה; הצטרפות/עזיבת רשימת המתנה לא מודיעה לספר. **פתוח:** SMS עדיין `NoopSmsProvider` (איפוס סיסמה לא שולח קוד — יטופל בנפרד); `pm2 save` לא הורץ, אז ה-worker לא ישרוד אתחול של השרת.
- **סימון תור שנקבע בטלפון (IVR) אצל הספר (2026-09-22, נפרס בשרת הפיתוח, נבדק ע"י `tsc`/טסטים בלבד — טרם נבדק עם שיחת IVR אמיתית):** `Appointment.booked_via_ivr` (Boolean, ברירת מחדל `false`, migration `20260922120000`) נקבע ב-`bookAppointmentCore(..., viaIvr)` — רק `ivr/bookViaPhone.ts` מעביר `true`. `getAppointmentsForWorkDay` מחזיר `booked_via_ivr` ו-`phone_number` (הטלפון נחשף **רק** לתורים שנקבעו בטלפון, לא בהדפסות/ייצוא), ו-`QuickDayAppointments` (משמש גם את דף הבית וגם את `/admin/day/[id]`) מציג "נקבע בטלפון (IVR) · <טלפון>" וכפתור "חיוג" (`tel:`). **תורים שנקבעו בטלפון לפני 2026-09-22 לא מסומנים** (לא נשמר מידע כזה קודם). לא סומן בדפי בקשות-אישור/ביטול ובהתראת המנהל על תור חדש — אפשר להוסיף.
- **כניסה עם קוד SMS (2026-09-22, כבויה כברירת מחדל — ראו "איפה עצרנו" למעלה ו-`docs/SMS-LOGIN.md`):** `lib/loginMode.ts` (`isSmsLoginEnabled()`), `lib/actions/smsLogin.ts` (שלבים send/verify/signup), `lib/smsLoginCore.ts` (קודי HMAC חד-פעמיים, טבלה `login_codes`, migration `20260922130000`), `login/SmsLoginForm.tsx`, `login/admin` (כניסת מנהל בסיסמה), `getOtpSmsProvider()` נפרד מ-`getSmsProvider()` (התראות נשארות בלי SMS), `Sms019Provider` (`packages/shared/src/sms019.ts`, לא נבדק מול חשבון), ניקוי קודים ישנים ב-worker. במצב `sms_code`: `/register`/`/forgot-password`/`/reset-password` מפנים ל-`/login`, `loginAction` מקבלת רק מנהל, `/admin` ללא סשן מפנה ל-`/login/admin`. **`/login` הוא `force-dynamic`** (הצורה תלויה ב-env בזמן ריצה).
- **ניקוי Dependabot (2026-09-06)** — `pnpm-workspace.yaml`'s `overrides` תוקן ל-`browserslist`/`deepmerge-ts` (שני alerts בחומרה גבוהה, שניהם build/dev-time בלבד — לא runtime). בנוסף עודכנו ללא בעיה: `next`, `react`/`react-dom`/`@types/react`/`@types/react-dom`, `@types/node`, `tsx`, `jose` (5→6, נבדק smoke-test על `signSession`/`verifySessionToken`), `zod` (3→4, נבדק smoke-test על כל סכימות `validation.ts`). **שלושה עדכונים נדחו בכוונה אחרי שנבדקו בפועל ונמצאו שוברים:** `@prisma/client`/`prisma` ל-7.x (מסיר תמיכה ב-`datasource { url = env(...) }` לגמרי — דורש `prisma.config.ts` + driver adapter, מיגרציה אמיתית לא bump), `typescript` ל-7.x (שובר את כל טיפוסי ה-Prisma הנוכחיים + `@typescript-eslint` עדיין לא תומך, תלוי בעדכון Prisma קודם), `eslint` ל-10.x (`eslint-plugin-react` בתוך `eslint-config-next` קורס בפועל על API שהוסר). שלושתם נשארו כ-PR פתוח ב-GitHub עם הסבר בתגובה — לא למחוק/למזג בלי לבדוק מחדש שהתלויות שלהם התעדכנו.

- **מסך `/admin` הראשי עוצב מחדש (2026-09-21, בקשה ישירה של המשתמשת)** — שלוש מטרות: לחסוך ניווט לפעולות דחופות, להציג את תורי היום הרלוונטי ישירות, ולאפשר קביעת תור ידני/ביטול בלי לצאת מהמסך הראשי. **תפריט:** `בקשות תורים`/`בקשות ביטול`/`התראות` הוצאו מ-`AdminMenu` (נשארו רק `לקוחות חסומים`/`רשימת המתנה`/`הודעות כלליות`/`הגדרות`/`ניהול ספרים`) והפכו לשלושה כפתורים גדולים מוערמים וממורכזים (`w-64 mx-auto`) עם באדג' הספירה הקיים, מתחת לבורר הספרים. **תצוגת "היום הרלוונטי":** `getWorkDaysAdmin` (`lib/actions/workdays.ts`) סונן עכשיו לפי `ends_at >= now()` ולא לפי תאריך בלבד — יום שהסתיימו שעותיו (אבל התאריך שלו עדיין "היום") כבר לא נחשב "פתוח" ונעלם גם מהתצוגה המהירה וגם מרשימת "ימי עבודה פתוחים" למטה (לא נמחק מה-DB, רק לא מוצג); `workDays[0]` אחרי הסינון הזה הוא תמיד היום הפתוח האמיתי הבא. **רכיב משותף חדש** `apps/web/src/app/admin/QuickDayAppointments.tsx` — מרנדר את ציר-הזמן של יום (`buildDayTimeline`) עם כפתור "ביטול תור" לכל תור, ו"קביעת תור ידני" לכל שעה פנויה (פותח `CreateManualAppointmentForm` inline עם השעה ממולאת מראש — הרכיב קיבל פרופס אופציונליים חדשים `initialStartsAt`/`onCancel` לשם כך). נעשה בו שימוש חוזר בשני מקומות: במסך הראשי (ליד "היום הפתוח הקרוב", בלי כפתור העברה) וב-`/admin/day/[id]` (עם `showMoveButton` — מחליף שם את הרינדור הידני הקודם של הציר, כולל `MoveAppointmentButton`). **מיקום/עיצוב כפתור מחיקת יומן:** `DeleteAllWorkDaysButton` הוזז מ"היסטוריה וגיבוי" לשורה אחת עם כפתור "תפריט" (משמאל לו, מול הצד) ועוצב באותה מידה/גופן בדיוק (`rounded-full border px-4 py-2 text-sm font-medium`) רק באדום במקום טורקיז. **עיצוב הרשימה:** כרטיס הרשימה עטוף באותו סגנון כרטיס לבן כמו "פתיחת יום עבודה חדש" (`border-barber-teal bg-white rounded-xl border p-4`); שלושת כפתורי הפעולה ליד השורות (ביטול תור / קביעת תור ידני / העברת תור) אוחדו לעיצוב "כפתור קטן" אחיד (`bg-barber-teal text-cream-text rounded-full px-3 py-1 text-xs font-medium`), כולל "ניהול היום"; הוסר padding אופקי לא-אחיד ששבר את היישור של הכפתורים בין שורת "פנוי" לשורת תור תפוס; שעות פנויות מוצגות באדום מודגש (`font-bold text-red-600`) כולל המילה "פנוי" (במקור: שחור+טורקיז, שונה לאדום אחיד לפי בקשה).

**טרם קיים קוד עבורו:** שום דבר מה-PRD הנוכחי. הכל ב-US-001 עד US-025 ו-FR-1 עד FR-35 ממומש. **חסימת יום מקביעת תורים** (ראו למעלה) ו**ספרי משנה** (ראו למעלה) הן תוספות מעבר ל-PRD המקורי — לא ממוספרות כ-US, נוספו לפי בקשה ישירה של המשתמשת (2026-07-26 ו-2026-08-03 בהתאמה).

**קביעת תור טלפונית (IVR, 2026-08-03 תכנון / 2026-08-04 מימוש מול ימות המשיח — קוד
עובר build/lint/test, לא נבדק מול שיחה אמיתית):** ראו `docs/# IVR BarberBook.txt`
(סטטוס מעודכן בראש המסמך). **הספק הוחלף מ-Twilio לימות המשיח (2026-08-04)** — Twilio
התברר כלא מציע בכלל מספרי טלפון ישראליים, לא עניין של אישור/regulatory bundle כמו
שהונח בתכנון המקורי. לוגיקת העסק **נשארה בשימוש בלי שינוי**, תלוית-ספק-אפס:
`bookAppointmentCore` (`lib/actions/bookingCore.ts`), `registerUserCore`
(`lib/actions/registerCore.ts`), ומכונת המצבים של תסריט השיחה ב-`lib/ivr/flow.ts` (רק
שינוי שמות פרמטרים). **שכבת האינטגרציה הספציפית ל-Twilio נמחקה** (`twiml.ts`,
`verifySignature.ts`, `apps/web/src/app/api/ivr/{voice,gather}/route.ts`, תלות
`twilio` ב-`package.json`) **והוחלפה בשכבה מול ימות המשיח:** `lib/ivr/yemotResponse.ts`
(בונה מחרוזת פקודות טקסטואלית, לא XML), `lib/ivr/verifyWebhookSecret.ts` (אין מנגנון
חתימה מתועד כמו `X-Twilio-Signature` אצל Yemot — האבטחה היא סוד ב-URL עצמו, ראו החלטה
#17 במסמך), ו-route יחיד `apps/web/src/app/api/ivr/yemot/[secret]/route.ts`. **עדכון
2026-08-05:** קו ימות המשיח נרכש (`0772248273`), ו-`.env` מלא עם שלושת המשתנים
(`YEMOT_PHONE_NUMBER`/`YEMOT_WEBHOOK_SECRET`/`PUBLIC_BASE_URL` — האחרון דרך דומיין
ngrok סטטי חינמי לבדיקות, `marlin-capitol-carat.ngrok-free.dev`, עד שיירכש דומיין
אמיתי). נמצא מקור קהילתי מפורט משמעותית (freeivr.co.il `post/76`) שאישר/תיקן כמה
פרטי תחביר: `read=` לזיהוי דיבור משתמש במילת המפתח `voice` (לא `Speech` כפי שהונח
קודם), רשימת התווים האסורים בטקסט דינמי היא רק נקודה+מקף, וברירת המחדל היא בקשות
GET (לא POST). לפי זה תוקנו שני באגים אמיתיים בקוד: `yemotResponse.ts`'s
`sayAndGatherDigits`/`sayAndGatherSpeech` בנו את מחרוזת `read=` עם פרמטרים בסדר
שגוי, ו-`flow.ts`'s `weekdayDate` בנה תאריך בפורמט "5.8" שה-`sanitize()` (בצדק) קטע
ל-"58" חסר משמעות. **עדכון 2026-08-08:** השלוחה הוגדרה בממשק ימות, ובוצעה שיחת
בדיקה אמיתית ראשונה שעברה בהצלחה עד הצעת התור הקרוב ביותר (זיהוי מתקשר → רישום
בפועל ב-DB → בחירת ספר → בחירת שירות), פותרת סופית את GET מול POST (**GET**) ואת
פורמט `ApiPhone` (**מקומי**) — עדיין לא אומתה הכתיבה בפועל של תור (המתקשרת ניתקה
לפני אישור שעה). **אותו עדכון, הרחבת פיצ'ר:** נוספה בחירת טווח שעות (בוקר/צהריים/
ערב, `getDayPeriods`) כשמסרבים להצעת התור הקרוב ביותר או כשיש יותר מ-9 שעות פנויות
ביום — ראו `lib/ivr/flow.ts`'s `renderTimeOrPeriodStep`. **עדכון נוסף, אותו יום:
מעבר שלם על איכות הדיבור (TTS) לפי משוב המשתמשת משיחות אמיתיות חוזרות** —
`weekdayDate` תוקן (התאריך נקרא "9/8" כ"9 חלקי 8", הוחלף בפורמט מילולי "9
באוגוסט"); כל ניסוח עם "/" למגדר (`את/ה`, `תרצה/י`, `תקבל/י`) נוסח מחדש
גם הוא מאותה סיבה; נוסף ניקוד לתסריט (חלקית — "מעולה" הוחזר לבלי ניקוד אחרי
שנשמע פחות טוב מנוקד/עם מתג); כל סימני הדגש הוסרו אחרי שגרמו לעיוות ("תור"
נשמע "תוור"); נוסף מנגנון הפסקה בין משפטים (`yemotResponse.ts`'s
`buildSegments` — קטעי `t-` נפרדים מחוברים ב-`.`, המפריד התיעודי בין
"אנונסים" אצל Yemot) בכל המקומות שמשפט שלם רץ ישר לתוך הבא; נוספה
`speakTime` (`flow.ts`) שממירה שעה ל-12 שעות ומוסיפה "ו-X דקות" בעברית
טבעית במקום "13:25" גולמי; ונוספה הגבלת רשימת השירותים בטלפון (IVR בלבד,
לא נוגע ב-DB/אפליקציה) לשלושה: תספורת מבוגר / תספורת + זקן / תספורת ילד.
לפי משוב המשתמשת אחרי הבדיקה האחרונה: "נשמע יותר טוב". ראו סדר העבודה
בסעיף 9 של המסמך. **עדכון 2026-08-09, שני שיפורי תסריט נוספים לפי משוב
מבדיקות נוספות:** (1) נוסף משפט זיהוי קבוע בתחילת כל שיחה, לפני כל דבר
אחר — "הגעתם למערכת קביעת התורים של מספרת יוסי" (`WELCOME_GREETING`
ב-`flow.ts`). (2) בחירת "יום אחר" (שלב 5) כשאין אף תאריך פתוח נוסף מלבד
זה שכבר הוצע כבר לא מנתקת את השיחה כאילו זו זמינות-אפס אמיתית (החלטה
#15) — במקום זה מודיעה "אין כרגע תאריכים פתוחים נוספים, נסו שוב מאוחר
יותר" וחוזרת להציע מחדש את השעה הפנויה הקרובה ביותר (`renderDayPickStep`
נופלת חזרה ל-`renderSlotOfferStep`, מחשבת זמינות מחדש ולא מסתמכת על
ערכים ישנים — עדיין נופלת נכון לניתוק האמיתי של החלטה #15 אם גם השעה
שכבר הוצעה נעלמה בינתיים). `pnpm build`/`tsc --noEmit`/`pnpm test`
(15/15) עוברים נקי; **לא נבדק עדיין מול שיחה אמיתית**.

**הערת בדיקה:** US-018 עד US-023 (מדיניות אישור, בקשות תורים, התראות מנהל, הצטרפות/ניהול רשימת המתנה) נבדקו ידנית בדפדפן ע"י המשתמשת ב-2026-07-20/21. US-024 (התפנות תור) עבד בפועל באותה בדיקה כתופעת לוואי (בקשת תור שנדחתה שחררה שעה). חסימת שעות שעברו (FR-28) ו-US-025 (הודעת הרחבת שעות) נכתבו אחרי אותה בדיקה — עברו `tsc`, את 11 הטסטים הקיימים (`pnpm test`), ואימות לוגיקה ידני מול הסכימה/DB, אבל **לא עברו עדיין בדיקה ידנית בדפדפן** על ה-flow המלא (למשל: לקוח שרואה בפועל ש-09:00 נעלם מרשימת השעות אחרי שהשעה עברה; לקוח ברשימת המתנה שמקבל בפועל SMS/Notification אחרי שהספר הרחיב יום).
