# BarberBook — מערכת ניהול תורים למספרה

אפליקציה לניהול תורים עבור ספר עצמאי. לקוחות קובעים, משנים ומבקשים לבטל תורים בעצמם (באפליקציה או בטלפון) לפי הזמינות שהספר מגדיר; הספר מנהל את היומן במלואו מתוך מסך ניהול.

> **עודכן לאחרונה: 2026-10-06** — המסמך סודר מחדש לפי קטגוריות ועודכן מול הקוד וההיסטוריה (62 commits). הגרסה הקודמת (לא מסודרת) נשמרה ב-`docs/archive/CLAUDE.md.bak-2026-10-06`.

## תוכן עניינים

1. [מסמכי מקור](#1-מסמכי-מקור)
2. [🔖 מצב נוכחי ופתוח — קראו קודם](#2--מצב-נוכחי-ופתוח--קראו-קודם)
3. [מוצר: משתמשים, שירותים, מחוץ לסקופ](#3-מוצר-משתמשים-שירותים-מחוץ-לסקופ)
4. [ארכיטקטורה ותשתית](#4-ארכיטקטורה-ותשתית)
5. [מודל נתונים](#5-מודל-נתונים)
6. [חוקי עסק קריטיים](#6-חוקי-עסק-קריטיים)
7. [פיצ'רים — צד לקוח](#7-פיצרים--צד-לקוח)
8. [פיצ'רים — צד ספר (`/admin`)](#8-פיצרים--צד-ספר-admin)
9. [התראות (In-app, Push, SMS)](#9-התראות-in-app-push-sms)
10. [כניסה והתחברות](#10-כניסה-והתחברות)
11. [קביעת תור טלפונית (IVR)](#11-קביעת-תור-טלפונית-ivr)
12. [אבטחה והרשאות](#12-אבטחה-והרשאות)
13. [עיצוב (Design System)](#13-עיצוב-design-system)
14. [תחזוקה, תלויות ובדיקות](#14-תחזוקה-תלויות-ובדיקות)

---

## 1. מסמכי מקור

קראו את הקבצים המלאים לפני שינויים משמעותיים — הסיכום כאן חלקי בכוונה.

| קובץ | תוכן |
|---|---|
| `docs/# PRD BarberBook.txt` | דרישות מוצר: User Stories (US-001..US-025 מקוריים + **US-026..US-034 תוספות**), Functional Requirements (FR-1..FR-35 + **FR-36..FR-46**). הערה בראשו: "SMS" בהתראות = התראה באפליקציה + Push |
| `docs/# ERD BarberBook.txt` | מודל נתונים — Mermaid + טבלאות שדות (**עודכן 2026-10-06** מול `schema.prisma`) |
| `docs/# STACK BarberBook.txt` | ארכיטקטורת מערכת |
| `docs/# IVR BarberBook.txt` | קביעת תור טלפונית (ימות המשיח): סיכום מצב עדכני בראש המסמך, 21 החלטות, תסריט שיחה מלא — **קראו במלואו לפני שממשיכים את הפיצ'ר** |
| `docs/SMS-LOGIN.md` | כניסת לקוחות עם קוד SMS — עיצוב, הגנות, ספק 019sms, תרחישי הדלקה/כיבוי |
| `docs/DEPLOY.md` | פריסה לפרודקשן עם Docker (כולל bootstrap של SSL, הערת `NEXT_PUBLIC_*` ותקלת 2026-10-06) |
| `scripts/deploy.sh` | סקריפט עדכון קוד בפרודקשן: pull → build → החלפת קונטיינרים → migrate → בדיקת תקינות |
| `security/*.md`, `privacy/*.md` | ממצאי ביקורת אבטחה (תשתית/תוכנה/סוכן) ותיקון 13 לחוק הגנת הפרטיות |
| `.claude/skills/barberbook-design/SKILL.md` | כללי עיצוב — לטעון לפני כל שינוי UI |

---

## 2. 🔖 מצב נוכחי ופתוח — קראו קודם

### מה חי ועובד
- **כל ה-PRD (US-001..US-025, FR-1..FR-35) ממומש.** תוספות מעבר ל-PRD (לא ממוספרות, נוספו לפי בקשה ישירה): חסימת יום, ספרי משנה, IVR, Push, כניסה בקוד SMS, אנשי קשר, תור ידני לפי משך.
- **כניסת לקוחות עם קוד SMS — 🟢 חי בשרת הפיתוח** (מ-2026-09-22), במקום סיסמה/הרשמה. נבדק קצה-לקצה בדפדפן כולל SMS אמיתי דרך 019sms. פירוט בסעיף 10 ו-`docs/SMS-LOGIN.md`.
- **Push ללקוחות ולמנהל** — נבדק במכשיר אמיתי בשרת הפיתוח. בפרודקשן (Docker) תוקן 2026-10-05 (ראו הכלל על `NEXT_PUBLIC_*` בסעיף 4).
- **אנשי קשר של הספר** (2026-10-05) — שמות לקוחות כפי ששמורים בטלפון של הספר, מוצגים בכל מסכי `/admin` (סעיף 8).
- **מתג "התראה כשמתפנה תור"** ללקוח ברשימת ההמתנה (2026-10-06) — ראו סעיף 9.

### פתוח / לא נבדק
- **פרודקשן אמיתי (Docker, `yossibarberbook.co.il`):** כניסה בקוד SMS **לא נפרסה** לפי המידע האחרון (2026-09-22) — דורשת `pnpm db:migrate` (migrations `20260922130000_add_login_codes` ואילך) והגדרת `CUSTOMER_LOGIN_MODE`/`SMS_PROVIDER`/פרטי 019sms ב-`.env` שם. מצב ההעברה לשרת החדש מתועד ב-`docs/DEPLOY.md`; לאמת מול השרת לפני הנחות.
- **IVR:** נבדק מול שיחות אמיתיות כולל **כתיבת תור בפועל** (2026-08-08). **לא נבדק:** סימון "נקבע בטלפון" אצל הספר (רק `tsc`/טסטים), שילוב IVR + כניסת SMS, והפניית ה-`api_link` בימות המשיח לדומיין האמיתי בפרודקשן (DEPLOY שלב 5) — לא אומת שבוצעה.
- **worker:** `pnpm build` (`tsc`) + `node dist/index.js` לא עובד (ראו סעיף 4) — רץ דרך `tsx`. בשרת הפיתוח רץ תחת pm2 בשם `barberbook-worker`; **`pm2 save` לא הורץ**, אז לא ישרוד אתחול שרת.
- **איפוס סיסמה** (`forgotPasswordAction`) לא שולח כלום ב-`password` mode (`getSmsProvider()` הוא Noop). ב-`sms_code` mode הוא סגור ממילא.
- **אין revocation לסשן** בעת reset סיסמה (JWT stateless) — דורש החלטה אדריכלית (ראו סעיף 12).
- **בדיקה ידנית בדפדפן שטרם נעשתה:** FR-28 (שעה שעברה נעלמת מהרשימה), US-025 (הודעת הרחבת שעות אמיתית), מתג `notify_freed_slots`.
- **שיפורים לא-חוסמים לכניסת SMS** (הגבלת קו נייח, WebOTP, ניקוי קוד הרשמה/סיסמה ישן): סעיף 5 ב-`docs/SMS-LOGIN.md`.
- **סימון "נקבע בטלפון"** לא מוצג בדפי בקשות-אישור/ביטול ובהתראת המנהל על תור חדש (אפשר להוסיף). תורי IVR לפני 2026-09-22 לא מסומנים.
- **שלוש שדרוגי תלויות נדחו בכוונה** (Prisma 7, TypeScript 7, ESLint 10) — ראו סעיף 14.

---

## 3. מוצר: משתמשים, שירותים, מחוץ לסקופ

### משתמשים
- **לקוח** — נכנס עם טלפון (+ קוד SMS, או סיסמה במצב `password`), קובע תורים לעצמו ולילדיו, משנה תור, שולח בקשת ביטול (טעונה אישור הספר כשהמדיניות דלוקה), מקבל תזכורות והודעות.
- **מנהל מערכת (הספר)** — פותח ימי עבודה (תאריך, שעת התחלה/סיום, הפסקות), רואה ומנהל את כל היומן, קובע תורים ידנית, מבטל/מוחק תורים וימים (עם אזהרת אישור), מפרסם הודעות כלליות, מאשר/דוחה בקשות, מנהל ספרי משנה, חסימות ורשימת המתנה.

**שם המנהל.** השם המוצג ("היי [שם]") הוא `User.full_name` של חשבון ה-administrator. **התחברות המנהל אחת ויחידה** — אין ריבוי חשבונות admin. כרגע "יוסי הספר". למסירה לספר אחר: לשנות `ADMIN_FULL_NAME` ב-`packages/db/prisma/seed.ts` ולהריץ `pnpm db:seed` (אידמפוטנטי — `upsert` לפי `phone_number`, מעדכן גם חשבון קיים וגם את `Barber` הראשי). זה נפרד מזהות ה"ספר" ביומן (ספרי משנה — סעיף 8).

### שירותים ומשכי זמן (קבועים ב-PRD, לא להמציא ערכים אחרים)
מקור יחיד: `SERVICE_DEFINITIONS` ב-`packages/shared/src/index.ts`.

| שירות | משך | הערות |
|---|---|---|
| תספורת מבוגר | 10 דק' | מוצע גם לספר-משנה וב-IVR |
| תספורת + זקן | 15 דק' | מוצע גם לספר-משנה וב-IVR |
| תספורת ילד | 10 דק' | `is_child_service` → נדרש שם ילד; מוצע גם לספר-משנה וב-IVR |
| הסרת שיער בלייזר | 10 דק' | ספר ראשי בלבד, לא ב-IVR |
| חלאקה | 15 דק' | ספר ראשי בלבד, לא ב-IVR |
| תספורת מבוגר + טיפול לייזר | 20 דק' | ספר ראשי בלבד, לא ב-IVR |

בנוסף, 3 **שירותים מוסתרים לתור ידני** (`Service.is_manual_only`, "תור ידני 5/10/15 דק'") — לא חלק מהקטלוג ללקוח/IVR (סעיף 8).

### מחוץ לסקופ
תשלום/סליקת אשראי, מערכת נאמנות, דירוגים/ביקורות, ריבוי סניפים/מספרות, צ'אט לקוח-ספר. (ריבוי **ספרים** באותה מספרה כן קיים.)

---

## 4. ארכיטקטורה ותשתית

```
Browser / Mobile Web (PWA)
   → Nginx (HTTPS)
   → Next.js App Container (מסכי לקוח, מסכי ניהול, Server Actions, API ל-IVR, Auth)
   → PostgreSQL
   ↑
Worker Container — תזכורות לפני תור (in-app + push, בלי SMS), ניקוי קודי כניסה ישנים
```

**מונוריפו pnpm:** `apps/web` (Next.js 16) · `apps/worker` (node-cron) · `packages/db` (Prisma + `web-push`) · `packages/shared` (קבועים, SMS providers, עזרי זמן). `packages/*` נצרכים כמקור TS ישיר (בלי build step משלהם).

### הרצה ו-build
- **`pnpm dev` / `pnpm build` בלבד — לעולם לא `next build`/`next dev` ישירות.** Next 16 משתמש ב-Turbopack כברירת מחדל ו-Serwist (webpack) מתנגש איתו; `apps/web/package.json` מגדיר `next dev --webpack` ו-`next build --webpack`. בלי הדגל `dev` קורס ("This build is using Turbopack, with a `webpack` config…").
- `pnpm test` (בתוך `apps/web`) — `node --import tsx --test src/**/*.test.ts`. טסטים קיימים: `availability`, `dayTimeline`, `contacts`, `pushEndpoint`, `sms019`, `smsLoginCore`.
- **worker:** `pnpm build`/`node dist/index.js` לא עובד כי `packages/*` הם TS גולמי ו-Node CommonJS לא מפענח אותם. מריצים דרך `pnpm exec tsx --env-file=.env src/index.ts` (בלי `--watch` לריצה ארוכה); `pnpm worker` מהשורש = `tsx watch` לפיתוח. דורש `apps/worker/.env` עם `DATABASE_URL` (+ `VAPID_*` לפוש). זה dev-runtime ולא בינארי מקומפל — וזה בסדר, גם ב-Docker.
- **תיקון timezone:** Server Components רצים בשעון השרת, לא בישראל. כל תצוגת זמן חייבת `ISRAEL_TIME_ZONE` מפורש; `zonedTimeToUtc()` (`packages/shared`) ממיר שעון קיר ישראלי (כולל שעון קיץ/חורף, בלי ספריית tz) ל-UTC לכל טפסי הניהול. `formatIsraelDate`/`formatIsraelTime` ב-`packages/shared` (משותפים ל-web ול-worker).
- `runSerializable()` ב-`apps/web/src/lib/serializableTransaction.ts` (לא בקובץ `"use server"`) — טרנזקציות Serializable לקביעה/שינוי תור.

### Docker ופריסה (נוסף 2026-08-31)
`Dockerfile` יחיד בשורש (targets `web`/`worker`, חולקים שלבי deps/build), `docker-compose.yml` (postgres · web · worker · nginx · certbot), `nginx/templates/default.conf.template` (HTTPS + headers בסיסיים, בלי CSP — ראו הערה בקובץ), `docker-compose.preview.yml`. בסיס Node 22 (נדרש ל-pnpm 11.15). מדריך מלא ב-`docs/DEPLOY.md`.

> **עדכון קוד בפרודקשן — תמיד דרך `bash scripts/deploy.sh` (נוסף 2026-10-06), לא `git pull && docker compose build && up -d` ידני.** הסקריפט: בדיקות מקדימות (קיום `.env`, אין שינויים מקומיים ב-git, אין קבצי `.env*` נוספים בתיקייה) ← `git pull --ff-only` ← `docker compose build web worker` ← `up -d --force-recreate web worker` ← השוואת מספר ה-migrations בקונטיינר מול הקוד ← `migrate` (ומאמת "N migrations found" = מספר התיקיות) ← בדיקת `/login` (200) — ועוצר בשגיאה ברורה בשלב הראשון שנכשל.
> **למה:** תקלה אמיתית ב-2026-10-06 — אחרי `build` הקונטיינר `web` לא הוחלף והמשיך להגיש בנייה ישנה ופגומה (מסך "ניהול יום" קרס), ו-`migrate` שרץ בתוכו ראה רק migrations ישנים, הדפיס "No pending migrations" ודילג בשקט על החדשה (`/account` קרס אחרי כניסת לקוח). בנוסף `.dockerignore` מוציא עכשיו כל `.env*` מה-build context (קובץ `.env_old` תועד כמי שהועתק לאימג'); גיבויי `.env` — מחוץ לתיקיית הפרויקט.
> **תיקיית העבודה במיכל `web` היא `apps/web`**, לכן ידנית: `docker compose exec web pnpm --filter @barberbook/db run migrate` (לא `pnpm db:migrate`).

> **🔴 כלל חובה לכל `NEXT_PUBLIC_*`:** `next build` מטמיע אותם **בזמן build**, ו-`env_file: .env` ב-compose הוא runtime בלבד (ו-`.dockerignore` מוציא `.env` מה-build context). לכן כל `NEXT_PUBLIC_*` חדש חייב `ARG`+`ENV` בשלב `build` ב-`Dockerfile` **וגם** `build.args` בשירות `web` ב-`docker-compose.yml`; ושינוי ערך מחייב `docker compose build` ולא רק `up -d`.
> **התקלה שזה מנע (תוקן 2026-10-05):** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` התקמפל כ-`undefined` בפרודקשן → `<PushNotificationToggle/>` החזיר `null` → כפתור "הפעלת התראות" לא הוצג → אין שורות `PushSubscription` → `sendPushTo*` שתקו. הצד השרתי היה תקין כל הזמן.

### PWA (2026-08-04, `@serwist/next`)
- `apps/web/src/app/sw.ts` — מקור ה-service worker (Serwist, לא next-pwa); `next.config.ts` עוטף ב-`withSerwist` ומייצר `public/sw.js` בזמן build (git-ignored). ה-SW מטפל גם ב-`push`/`notificationclick`.
- רישום בפועל: `<SerwistProvider swUrl="/sw.js" disable={NODE_ENV !== "production"}>` ב-`app/layout.tsx` — Serwist **לא** מזריק סקריפט רישום אוטומטי.
- `public/site.webmanifest`: ערכי מותג (`theme_color #508186`, `background_color #fdf8f0`, אייקונים 192/512 `any maskable`).
- `<InstallPrompt/>` — תופס `beforeinstallprompt` ומציג באנר התקנה; ב-iOS (אין `beforeinstallprompt`) מציג הנחיית "שיתוף ← הוסף למסך הבית" מותאמת לדפדפן (ספארי: כפתור בסרגל; כרום/Edge/פיירפוקס ל-iOS: בשורת הכתובת). זיהוי iOS משותף ב-`apps/web/src/lib/ios.ts`, כולל iPadOS 13+ שמזדהה כ-Mac (`maxTouchPoints > 1`) — לא לזהות iOS לפי user agent בלבד במקום אחר. דחייה נשמרת ב-`localStorage`.
- `color-scheme` מוגדר light-only כדי למנוע היפוך אוטומטי של Android לכהה.

### משתני סביבה עיקריים
ראו `.env.example` (לעולם לא לקרוא `.env` — סעיף 12): `DATABASE_URL`, `SESSION_SECRET`, `COOKIE_SECURE`, `CUSTOMER_LOGIN_MODE`, `SMS_PROVIDER` (+ פרטי 019sms), `YEMOT_PHONE_NUMBER`/`YEMOT_WEBHOOK_SECRET`/`PUBLIC_BASE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`, `FIGMA_ACCESS_TOKEN`.

---

## 5. מודל נתונים

מקור האמת: `packages/db/prisma/schema.prisma`; תיעוד מלא: `docs/# ERD BarberBook.txt`. שמות שדות snake_case, 1:1 מול ה-ERD.

**ישויות:** `User` (role: customer/administrator) · `Barber` (`is_primary`, `is_active`) · `Service` (`duration_minutes`, `is_child_service`, `is_manual_only`) · `WorkDay` (`barber_id`, `is_blocked`) · `WorkBreak` · `BlockedTime` · `Appointment` (status: scheduled/cancelled; attendee_type: self/child/other; `booked_via_ivr`) · `CancellationRequest` · `BookingRequest` · `AppSettings` (סינגלטון: `requires_approval`, `ivr_enabled`) · `WaitlistEntry` (`notify_freed_slots`) · `Notification` · `PushSubscription` · `Announcement` · `BlockedPhoneNumber` · `PasswordResetCode` · `LoginCode` · `ContactName`.

**Migrations (בסדר כרונולוגי):** `init` → `service_name_unique` → `add_is_child_service` → `add_blocked_phone_numbers` → `add_notifications_and_waitlist` → `add_approval_toggle` → `add_work_day_is_blocked` → `add_barbers_table` + `barber_id_required` (2026-08-03) → `add_ivr_enabled` → `add_push_subscriptions_and_notification_types` (09-06) → `add_customer_registered_notification_type` → `add_appointment_booked_via_ivr` → `add_login_codes` (09-22) → `add_contact_names` + `add_manual_only_services` (10-05) → `add_waitlist_notify_freed_slots` (10-06).

### הערות מודל חשובות
- `Appointment.booked_by_user_id` אופציונלי — תור ידני יכול להתקיים בלי חשבון משתמש.
- אין ישות `Child` — פרטי הילד ברמת התור (`attendee_name`, `attendee_type`).
- **שלוש פעולות נפרדות על תור/יום — אל תתבלבלו:**
  1. **ביטול תור בודד** (`cancelAppointmentAction`) — soft: `status = cancelled`, הרשומה נשארת.
  2. **מחיקת יום/יומן** (`deleteWorkDayAction`/`deleteAllWorkDaysAction`) — hard delete אמיתי (cascade), לא ארכיון.
  3. **חסימת יום** (`WorkDay.is_blocked`, `setWorkDayBlockedAction`) — לא מוחקת ולא מבטלת; חוסמת רק קביעה/שינוי **חדשים של לקוחות**; הפיכה (טוגל). שונה גם מ-`BlockedTime` (טווח שעות בתוך יום).
- לכל תור: בקשת ביטול (`CancellationRequest`) אחת לכל היותר — `appointment_id @unique`, לכן בקשה שנדחתה חוזרת ל-`pending` בבקשה נוספת במקום שורה חדשה; ובקשת תור (`BookingRequest`) אחת לכל היותר.
- `BookingRequest` אינה "כוונה": ה-`Appointment` נוצר מיד כ-`scheduled` ותופס את השעה; דחייה → `cancelled` ושחרור השעה; אישור לא נוגע בתור. אין `booking_request_id` ב-`Notification` — `booking_decision` מצביעה על `appointment_id`.
- `AppSettings` — שורה יחידה קבועה (`id = "singleton"`, get-or-create ב-`settings.ts`); הגדרות גלובליות נוספות = עמודות נוספות באותה שורה, לא key-value.
- `WaitlistEntry` כללית במכוון (לא לפי תאריך/שירות); `user_id @unique` → הצטרפות חוזרת = no-op.
- `WorkDay`: ייחודיות `[barber_id, work_date]` — שני ספרים יכולים לפתוח את אותו תאריך. `Barber ← WorkDay` הוא `onDelete: Restrict`.
- `LoginCode` ו-`ContactName` מפתחים לפי **מספר טלפון** ולא `User` (משתמש חדש עדיין לא קיים; איש קשר יכול להיות מספר שטרם נרשם).
- אין סטטוס "הסתיים" לתור — תור היסטורי נשאר `scheduled` לנצח (ראו הכלל על בדיקת `starts_at >= now` בסעיף 6).

---

## 6. חוקי עסק קריטיים

- **זמינות:** ללקוח מוצגות רק שעות פנויות בתוך ימי עבודה שהספר פתח. אסור חפיפה בין תורים, ואסורה שעה שכבר עברה (גם בתוך יום פתוח שטרם הסתיים).
  - `findAvailableSlots`/`isSlotAvailable` (`apps/web/src/lib/availability.ts`): רשת קבועה של 10 דקות מתחילת היום, מתיישרת מחדש בדיוק לסוף כל תור/הפסקה/חסימה (בלי מרווח) — כדי לא להציג שתי אפשרויות בפער קטן מ-10 דק'. פונקציות **טהורות ודטרמיניסטיות**; סינון "שעה שעברה" רק בשכבת ה-action.
  - **חסימת שעות שעברו (FR-28):** `getSlotsForDate` מסננת `d < now`; `bookAppointmentAction`/`rescheduleAppointmentAction` בודקות שוב בתוך הטרנזקציה (`PAST_SLOT`) כרשת ביטחון.
- **שינוי תור** מותר רק לשעה פנויה שעוד לא עברה; שולח הודעה. אפשר לעבור לספר אחר אם הוא מציע את שירות התור (`SERVICE_NOT_OFFERED` נאכף בשרת).
- **מדיניות "דורש אישור"** (`AppSettings.requires_approval`, ברירת מחדל כבויה) קובעת גלובלית את קביעת תור חדש **וגם** בקשת ביטול:
  - דלוקה: קביעה נשמרת כ-`BookingRequest` ממתין (התור כבר תופס את השעה); ביטול נשמר כ-`CancellationRequest` ממתינה — רק החלטת הספר קובעת.
  - כבויה: שניהם קורים **מיידית**. אל תניחו שביטול/קביעה תמיד דורשים אישור — בדקו `getRequiresApproval()`.
- **חסימת יום** נאכפת בשלוש שכבות: `getOpenDates()` (לא מציגה), `bookAppointmentAction`/`rescheduleAppointmentAction` (זורקות `DAY_BLOCKED`). לא חל על קביעה ידנית של הספר.
- **חסימת מספרי טלפון** (`BlockedPhoneNumber`) נאכפת בהרשמה, בכניסה (שליחת קוד ואימות), בקביעה ובשינוי תור — גם למספרים שטרם נרשמו.
- **הודעת ביטול על תור — תמיד לבדוק `starts_at >= new Date()`** ולא רק `status === "scheduled"` (תקלה אמיתית שתוקנה ב-`deleteWorkDayAction`/`deleteAllWorkDaysAction`/`cancelAppointmentAction`: תור היסטורי עלול לגרום להודעת "בוטל" מטעה).
- מחיקת יום/תור דורשת הודעת אזהרה ואישור מפורש.
- איפוס סיסמה — קוד חד-פעמי ב-SMS, לא מייל (רלוונטי רק במצב `password`).
- הרשאות: מסכי ניהול רק ל-`administrator`; לקוח לא מחובר לא יכול לערוך תורים. `account/appointments` מסנן `starts_at >= now` — הלקוח לא רואה תורי עבר.

---

## 7. פיצ'רים — צד לקוח

### קביעת תור (`account/book`)
זרימה: **ספר** (מדולג אוטומטית אם יש רק ספר פעיל אחד) ← **שירות** (שירות ילד → שם ילד, ללא צ'ק-בוקס) ← **תאריך** ← **שעה** ← **סיכום** ← אישור.
- הכל מסונן דרך `getOpenDates(barber_id)`/`getServices(barber_id)`.
- **מ-2026-10-05, בחירת שעה לא קובעת מיד:** צעד `summary` מציג כרטיס "סיכום פרטי התור" (ספר, שירות, ילד, תאריך, שעה — בעיצוב גרדיאנט כמו כרטיסי ההודעות ב-`/account`, שורות `תווית: ערך` ב-RTL) עם "אישור" (רק הוא קורא ל-`bookAppointmentAction`) ו"ביטול" (חזרה להתחלה, `bookAnother`). אפשר לקבוע תור נוסף באותה זרימה.
- **מצב "אין ימים פתוחים":** מנוסח "התרע/י לי כשייפתחו תאריכים לקביעת תורים" — אותו מנגנון רשימת המתנה, ניסוח ממוקד.
- כשהמדיניות דלוקה: מסך "הבקשה שלך נשלחה לאישור הספר" (`pendingApproval: true`).

### ניהול תורים (`account/appointments`)
- **שינוי מועד** (`RescheduleButton`) — לשעה פנויה בלבד; מותר גם לספר אחר.
- **ביטול:** כשהמדיניות דלוקה — `RequestCancellationButton` שולח `CancellationRequest` (הספר מאשר/דוחה; רק אישור מבטל בפועל, דחייה משאירה את התור; ההחלטה → הודעה `cancellation_decision`). כשכבויה — `requestCancellationAction` מבטלת **מיידית** בלי ליצור `CancellationRequest`.
- **גם בזמן ההמתנה לאישור תור** (מ-2026-10-05) הלקוח יכול לשנות מועד או לבטל: שינוי מועד משאיר את ה-`BookingRequest` ב-`pending` לשעה החדשה (הספר מקבל התראה "עדיין ממתין לאישורך"); ביטול מיידי בלי אישור ספר — `requestCancellationAction` **מוחקת** את ה-`BookingRequest` (`deleteMany` מותנה ב-`pending`; אין סטטוס `withdrawn`) ומבטלת את התור. `decideBookingRequest` משתמשת ב-`updateMany` מותנה ב-`pending` כדי לא לקרוס אם הלקוח ביטל באותו רגע.

### דף הבית (`/account`)
הודעות כלליות של הספר (חדשה קודם), תיבת רשימת המתנה (כולל `LeaveWaitlistButton` ומתג `FreedSlotNotifyToggle`), הפעלת Push (`<PushNotificationToggle audience="customer"/>`).
- **הודעות כלליות** (`Announcement`, US-009): מפורסמות ב-`/admin/announcements`; תצוגה באפליקציה + Push לכל מנויי הלקוחות (בלי שורת `Notification`, בלי SMS; ללא Push על עריכה/מחיקה). כרטיס ההודעה: `bg-gradient-to-bl from-barber-teal to-cream`, טקסט `text-ink` (לבן נעלם על הקצה הבהיר).

### רשימת המתנה (US-022..US-025, `waitlist.ts`)
כללית, לא לפי תאריך/שירות. צד לקוח: `joinWaitlistAction`/`leaveWaitlistAction`/`isOnWaitlist`/`getMyWaitlistEntry`/`setNotifyFreedSlotsAction`. צד ספר: `getWaitlistEntries`/`removeWaitlistEntryAction` (`/admin/waitlist`; הסרה ידנית בלי הודעה ללקוח). פירוט הטריגרים — סעיף 9.

### לוח שנה — שני מימושים נפרדים
- **לקוח** (`DateCalendar` בתוך `account/book/page.tsx`): רשת חודשית RTL (יום ראשון מימין); רק תאריכים מ-`getOpenDates()` לחיצים (עיגול טורקיז), השאר דהויים; ניווט חודשים רק בין חודשים שיש בהם תאריך פתוח. שעות פנויות — כפתורי פיל `rounded-full`.
- **אדמין** (`AdminDateCalendar` ב-`admin/OpenWorkDayForm.tsx`): אותו עיצוב, **לוגיקה הפוכה** — כל תאריך עתידי לחיץ, חוץ מעבר ותאריכים שכבר קיימים כיום פתוח; ניווט חופשי קדימה, חסום אחורה מהחודש הנוכחי. **תבנית UI לשימוש חוזר:** שדה קומפקטי (נראה כ-`<input>`, מציג התאריך או "בחרו תאריך") שבלחיצה פותח את הלוח כפופאפ מתחתיו (`calendarOpen`); בחירה סוגרת אותו.

---

## 8. פיצ'רים — צד ספר (`/admin`)

כל המסכים תחת `requireAdmin()` + matcher ב-`proxy.ts` (סעיף 12).

### מסך ראשי (עוצב מחדש 2026-09-21)
- **תפריט** (`AdminMenu`): לקוחות חסומים · רשימת המתנה · הודעות כלליות · הגדרות · ניהול ספרים · אנשי קשר. **שלושה כפתורים גדולים מוערמים** (`w-64 mx-auto`) עם badge ספירה: בקשות תורים · בקשות ביטול · התראות.
- **"היום הרלוונטי":** `getWorkDaysAdmin` מסנן לפי `ends_at >= now()` (לא לפי תאריך בלבד) — יום ששעותיו הסתיימו נעלם מהתצוגה המהירה וגם מרשימת "ימי עבודה פתוחים" (לא נמחק מה-DB). `workDays[0]` = היום הפתוח האמיתי הבא.
- **`QuickDayAppointments`** (`admin/QuickDayAppointments.tsx`) — רכיב משותף למסך הראשי ול-`/admin/day/[id]` (עם `showMoveButton`): ציר זמן (`buildDayTimeline`) עם "ביטול תור" לכל תור ו"קביעת תור ידני" לכל שעה פנויה (פותח `CreateManualAppointmentForm` inline עם `initialStartsAt`/`onCancel`). **מ-2026-10-05 טווחים פנויים מפוצלים לשעות בודדות** (`splitFreeSegments`, רשת 10 דקות כמו אצל לקוח, כל שעה מוצגת בזמן ההתחלה שלה).
- כפתורי פעולה קטנים אחידים: `bg-barber-teal text-cream-text rounded-full px-3 py-1 text-xs font-medium`. שעה פנויה: `text-ink font-bold` עם המילה "פנוי" בלבד באדום (`text-red-600`).
- `DeleteAllWorkDaysButton` באותה שורה עם "תפריט", אותו מידות, באדום.

### ימי עבודה
- פתיחת יום (תאריך, שעות, הפסקות דינמיות); **עדכון שעות** של יום פתוח (נחסם אם יש תור/הפסקה/חסימה מחוץ לטווח החדש); צפייה בתורי יום (`/admin/day/[id]`).
- **העברת תור** (`MoveAppointmentButton`) לשעה אחרת באותו יום — `Notification`+Push (בלי SMS) ללקוח עם חשבון (תור ידני ללא חשבון מועבר בלי הודעה).
- **ביטול תור בודד** (`CancelAppointmentButton`, US-017) — שולח `Notification`+Push ללקוח מקושר, ומפעיל התראת רשימת המתנה אם השעה עתידית.
- **מחיקת יום/כל היומן** (US-012) — עם עותק הדפסה/PDF אופציונלי לפני (`/admin/day/[id]/print`, `/admin/print-all`) והודעת ביטול לכל לקוח עם תור פעיל עתידי בטווח.
- **חסימת יום** (`BlockDayToggle`, שתי גרסאות — מלאה עם הסבר ב-`/admin/day/[id]`, `compact` מתחת ל"ניהול היום" בכל שורה ברשימה; שתיהן קוראות ל-`setWorkDayBlockedAction`) + badge "חסום".
- עמודי הדפסה/ייצוא נשארים `bg-white`/`text-gray-*` פשוטים בכוונה (עיצוב להדפסה, לא ממותג).

### קביעת תור ידני
**ללא בחירת שירות** (מ-2026-10-05): הספר בוחר שם (בלי טלפון) + משך (5/10/15 דק', `MANUAL_APPOINTMENT_DURATIONS`). כל משך ממופה לשירות מוסתר (`Service.is_manual_only`, נוצרים ב-migration `add_manual_only_services` וב-seed) כדי ש-`Appointment.service_id` יישאר חובה וכל חישובי המשך/העברה יעבדו. `getServices` מסנן אותם; `bookAppointmentCore` דוחה אותם כרשת ביטחון. תור ידני אינו מפעיל התראת מנהל.

### בקשות, הגדרות וחסימות
- **בקשות תורים** (`/admin/booking-requests`, US-019/US-020): אישור לא נוגע בתור; דחייה → `cancelled` + `notifyWaitlistOfFreedSlot` (אם עתידית) + `booking_decision` ללקוח. badge: `getPendingBookingRequestCount()`.
- **בקשות ביטול** (`/admin/cancellation-requests`, US-008).
- **הגדרות** (`/admin/settings`): `ApprovalToggle` (`requires_approval`), `IvrToggle` (`ivr_enabled`).
- **לקוחות חסומים** (`/admin/blocked-customers`, US-014).
- **הודעות כלליות** (`/admin/announcements`).

### ספרי משנה (`Barber`, 2026-08-03; `/admin/barbers`)
- הספר (ה-admin היחיד) מוסיף ספרים עובדים: **שם בלבד, בלי login נפרד** — `Barber` הוא "שם + יומן", לא `User`. לכל ספר `WorkDay` נפרד.
- `Barber.is_primary` = הספר המקורי (`id: "primary"` מה-seed) שמציע את כל 6 השירותים; ספר-משנה מוגבל ל-3 קבועים — `SUB_BARBER_SERVICE_NAMES` (לא ניתן להגדרה פר-ספר; `isServiceAllowedForBarber`).
- **השבתה** (`is_active`, `setBarberActiveAction`) מסתירה מבוררי הלקוח ושומרת את היומן נגיש לאדמין (`/admin?barber=<id>`). **מחיקה** (`deleteBarberAction`, `DeleteBarberButton`) — hard delete: מוחקת את כל ימי העבודה של הספר (עם אפשרות להודיע ללקוחות על תורים עתידיים) ואז את ה-`Barber`, בטרנזקציה. **הספר הראשי לא ניתן להשבתה ולא למחיקה.**
- `WaitlistEntry` ו-`AppSettings.requires_approval` **אינם** מודעים-לספר — נשארו גלובליים בכוונה.

### אנשי קשר (`ContactName`, 2026-10-05; `/admin/contacts`)
הספר רואה כל לקוח **לפי השם ששמור אצלו בטלפון** (נופל לשם שהלקוח נרשם איתו), עם מספר הטלפון וכפתורי חיוג/SMS/וואטסאפ — בכל מסכי `/admin` (תורי יום, בקשות תורים/ביטול, רשימת המתנה, חסומים, ייצוא יום).
- **רכיבים:** `CustomerContact` + `ContactActions` (`components/CustomerContact.tsx`, כולל ✎ לעריכה ידנית), `getContactNameMap` (`lib/contactNames.ts`, server-only), `lib/contacts.ts` (`normalizeIsraeliPhone`, `whatsappUrl`, `parseVCards` — קורא .vcf כולל שורות מקופלות ו-QUOTED-PRINTABLE של עברית), `lib/actions/contacts.ts`.
- **שלושה מקורות (`ContactNameSource`):** `import` (ייבוא .vcf — מסונן בדפדפן מול `getKnownCustomerPhones()`, כך שרק לקוחות/חסומים קיימים נשלחים לשרת), `picker` (Android Contact Picker — נשמר גם למספר שטרם נרשם, ודורס), `manual` (עריכה ידנית). **ייבוא חוזר לעולם לא דורס שורת `manual`.** שם ריק מוחק (חזרה לשם הרשום).
- חשיפת הטלפון בייצוא/הדפסה: ראו הערת IVR בסעיף 11 — בהדפסות לא נחשף.

---

## 9. התראות (In-app, Push, SMS)

### שלושה ערוצים נפרדים
1. **In-app** — `Notification` (פיד + badge). `sendCustomerNotification` (`lib/notifyCustomer.ts`) היא **המקום היחיד שכותב `Notification` ללקוח** ושולחת גם Push; `appointment_id`/`cancellation_request_id` נשארים `null` במחיקה קשה.
2. **Web Push אמיתי** (`web-push`, מ-2026-09-06 למנהל, מ-2026-09-21/22 גם ללקוחות) — מציג התראת מכשיר גם כשהאפליקציה סגורה.
3. **SMS** — **התראות (ביטול/שינוי/תזכורת) נשארות בלי SMS** (עולה כסף). SMS נשלח רק לקודי כניסה, דרך `getOtpSmsProvider()` (נפרד מ-`getSmsProvider()` שנשאר Noop).

### מנגנון Push
- מודל `PushSubscription` (`user_id`, `endpoint` ייחודי, `p256dh`/`auth`) — מכשיר אחד לשורה; תקרת 10 מכשירים למשתמש; `subscribeToPushAction` פתוחה לכל משתמש מחובר, עם אימות `endpoint` מול allowlist של שירותי push אמיתיים (`lib/pushEndpoint.ts` — מונע SSRF).
- **קוד השליחה ב-`packages/db/src/push.ts`** (`sendPushToAdmins`/`sendPushToUser`/`sendPushToCustomers`, מיוצאים מ-`@barberbook/db`) כדי ש-web וגם worker ישתמשו באותו קוד. הפונקציות **לא זורקות לעולם**, no-op שקטה בלי VAPID, ורושמות `[push] delivery failed <status>` לכשל שאינו 404/410. `prisma` ב-`packages/db/src/client.ts` (מניעת import מעגלי).
- `<PushNotificationToggle audience="customer" | admin/>` ב-`/account` וב-`/admin/notifications`; ב-iOS נדרשת התקנה למסך הבית לפני ש-Web Push עובד (Android/Desktop לא).
- ה-worker צריך את `VAPID_*` ב-`apps/worker/.env` (ב-Docker `env_file` משותף).

### התראות לספר (`notifyAdmin.ts`, helper אחד `notifyAdmins`)
תור חדש (אתר + IVR) · בקשת תור ממתינה · בקשת ביטול ממתינה · שינוי מועד ע"י לקוח (`notifyAdminsOfCustomerReschedule`) · ביטול מיידי ע"י לקוח כשהמדיניות כבויה (`notifyAdminsOfCustomerCancellation`) · לקוח חדש (`notifyAdminsOfNewCustomer` → `customer_registered`, נקרא מ-`registerUserCore` ולכן מכסה גם הרשמה בטלפון).
- `NotificationType`: `appointment_reminder`, `appointment_changed`, `cancellation_decision`, `appointment_booked`, `waitlist_slot_available`, `booking_decision`, `booking_request_pending`, `cancellation_request_pending`, `customer_registered`.
- כשהמדיניות כבויה כל תור שלקוח קובע יוצר `appointment_booked` לכל מנהל (תור ידני — לא). badge ב-`/admin` סופר `read_at IS NULL`; `markAdminNotificationsReadAction` = "סמן הכל כנקרא" (`updateMany`), אין סימון פר-שורה. `adminNotifications.ts` מסנן לפי `ADMIN_NOTIFICATION_TYPES` (באג שתוקן: בעבר סינן רק `appointment_booked` ולכן בקשות ממתינות לא הופיעו).

### התראות ללקוח
שינוי/ביטול תור ע"י הספר (כולל מחיקת יום/יומן/ספר) · החלטה על בקשת תור/ביטול · רשימת המתנה · **תזכורת לפני תור** (worker, `reminders.ts`: כל דקה, תורים `scheduled` עם חשבון שמתחילים בתוך `APPOINTMENT_REMINDER_LEAD_MINUTES` = 120 דק' וללא `Notification` מסוג `appointment_reminder` — האידמפוטנטיות מסתמכת רק על הבדיקה הזו; Notification+Push).

### רשימת המתנה — שלושה טריגרים (`notifyAllWaitlistEntries`, `type: waitlist_slot_available`)
1. **`notifyWaitlistOfFreedSlot(starts_at, service, owner_user_id)`** — תור עתידי שהתפנה: ביטול ישיר ע"י הספר, אישור/ביטול מיידי של בקשת ביטול, דחיית בקשת תור, **וגם העברת תור (ע"י לקוח או ספר) — השעה הישנה שהתפנתה** (נוסף 2026-10-05, commit `542d4e0`; מותנה בכך שהשעה הישנה עתידית ושונתה בפועל; כשל התראה נרשם בלוג ולא מכשיל את ההעברה). בעל התור מוחרג. **נשלח רק לחברי הרשימה שהשאירו דלוק `WaitlistEntry.notify_freed_slots`** (ברירת מחדל `true`; מתג "התראה כשמתפנה תור" ב-`/account`, `FreedSlotNotifyToggle`) — **שונה 2026-10-06**: עד אז נשלח גם לכל לקוח עם Push, וזה בוטל.
2. **`notifyWaitlistOfExtendedHours`** — `updateWorkDayHoursAction` **מרחיבה** יום פתוח.
3. **`notifyWaitlistOfNewWorkDay`** — `createWorkDayAction` פותחת יום חדש לגמרי (תוקן 2026-07-26: בלעדיו לקוח שהצטרף כשאין אף יום פתוח לא קיבל התראה).

המתג `notify_freed_slots` חל **רק** על תור שהתפנה; יום חדש/הרחבת שעות נשלחים לכל הרשימה (זו הסיבה להיות בה). הצטרפות/עזיבת רשימה לא מודיעה לספר.

---

## 10. כניסה והתחברות

### שני מצבים (`CUSTOMER_LOGIN_MODE`, `lib/loginMode.ts`, `isSmsLoginEnabled()`)
| מצב | מתי | חוויה |
|---|---|---|
| `password` (ברירת מחדל בקוד) | משתנה לא מוגדר/אחר, או אין ספק SMS תקף | הרשמה/כניסה ישנות: שם + טלפון + סיסמה; איפוס סיסמה (SMS מדומה) |
| `sms_code` (**חי בשרת הפיתוח**) | `CUSTOMER_LOGIN_MODE="sms_code"` **וגם** `SMS_PROVIDER` הוא `019` או `mock` | טלפון → קוד 6 ספרות ב-SMS → (מספר חדש בלבד) שם מלא → כניסה |

הדלקת הדגל בלי ספק תקף **לא** מפעילה את המצב (מונע נעילת לקוחות בחוץ). **`/login` הוא `force-dynamic`** (הצורה תלויה ב-env בזמן ריצה).

### מצב `sms_code`
- זרימה: `smsLoginAction` (`lib/actions/smsLogin.ts`, שלבים `send`/`verify`/`signup`); לוגיקת הקודים ב-`lib/smsLoginCore.ts` (לא `"use server"`); UI ב-`login/SmsLoginForm.tsx`.
- קודים: `randomInt`, נשמר רק HMAC-SHA256 עם `SESSION_SECRET` בטבלה `login_codes`, חד-פעמי, תוקף `LOGIN_CODE_TTL_MINUTES` (10), `LOGIN_CODE_MAX_ATTEMPTS` (5) ואז נעילה, קוד חדש מבטל ישנים. ה-SMS מציב את **הקוד בתחילת ההודעה** כדי שיופיע בבאנר ההתראה.
- מספר חדש עובר לשלב שם עם **הוכחה חתומה** (JWT 10 דק') — העובדה "המספר הזה הוא/לא לקוח" לא נחשפת לפני שהוכח שהמספר שלו. נוצר `User` עם סיסמה אקראית לא-שמישה (כמו לקוחות IVR) + התראת "לקוח חדש" לספר.
- מגבלות קצב (`rateLimit.ts`, in-memory): שליחה — 3 ל-15 דק' למספר, 10 לשעה ל-IP, **100 לשעה גלובלית** (תקרת עלות מול SMS-pumping); אימות — 10 ל-15 דק' למספר.
- נסגר במצב זה: `/register`, `/forgot-password`, `/reset-password` מפנים ל-`/login` (ב-`proxy.ts`) וה-actions מסרבות גם בקריאה ישירה; `loginAction` מקבלת רק מנהל; `/admin` ללא סשן מפנה ל-`/login/admin`.
- ה-worker מוחק קודים שפג תוקפם מעל יממה (cron יומי 03:17, `cleanup.ts`).
- **ספק:** `Sms019Provider` (`packages/shared/src/sms019.ts`; `POST https://019sms.co.il/api`, Bearer token, `source` עד 11 תווים, מאושר `BarberBook`); ימות המשיח נפסל (אין endpoint נקי ל-SMS בודד). החלפת ספק = מימוש `SmsProvider` + `case` ב-`getOtpSmsProvider()`.

### המנהל — תמיד עם סיסמה
`/login/admin` קיים בשני המצבים; מספר המנהל פשוט/ידוע ולכן **אסור** לאפשר לו כניסה בקוד/טלפון בלבד. למספר מנהל, שלב ה"שליחה" מדמה הצלחה בלי לשלוח וליצור קוד.

### סשן "זכור אותי" (sliding, 2026-08-09)
`proxy.ts` מרעננת את עוגיית הסשן (`signSession` עם `iat`/`exp` חדשים) בכל בקשה מאומתת ל-`/account/*`/`/admin/*` — חלון 30 יום מתחדש מכל ביקור; רק חוסר פעילות מעל 30 יום או logout מפורש מנתקים. `cookieSecure()` ב-`jwt.ts` (edge-safe, בלי `server-only`) כדי ש-`proxy.ts` ישתמש בו.
**`COOKIE_SECURE`** (`.env`) עוקף את ברירת המחדל (`NODE_ENV === "production"`) לדגל `Secure`: `next start` תמיד production, וללא HTTPS אמיתי הדפדפן זורק בשקט עוגיית `Secure` — כניסה "לא עובדת" בלי שגיאה. להשאיר `false` כל עוד HTTP גולמי (IP:פורט), ו-`true`/ללא משתנה כשיש HTTPS.

---

## 11. קביעת תור טלפונית (IVR)

ספק: **ימות המשיח** (הוחלף מ-Twilio ב-2026-08-04 — Twilio לא מציע מספרים ישראליים). קו `0772248273`. מסמך מלא: `docs/# IVR BarberBook.txt`. **סטטוס:** נבדק מול שיחות אמיתיות כולל כתיבת תור (2026-08-08) ונחשב פונקציונלי; פתוח רק ליטוש נוסח וחיבור ה-`api_link` לדומיין בפרודקשן.

### ארכיטקטורה
- לוגיקת עסק תלוית-ספק-אפס, משותפת עם האפליקציה: `bookAppointmentCore` (`lib/actions/bookingCore.ts`), `registerUserCore` (`registerCore.ts`), מכונת מצבים של השיחה ב-`lib/ivr/flow.ts` (`startCall`/`continueCall`, `CallState`).
- שכבת ימות: `lib/ivr/yemotResponse.ts` (מחרוזת פקודות טקסטואלית, לא XML), `verifyWebhookSecret.ts` (אין חתימה כמו Twilio — האבטחה היא **סוד ב-URL**, החלטה #17 במסמך), `identifyCaller.ts`, `bookViaPhone.ts`, `callState.ts`, `publicUrl.ts`, ו-route יחיד `app/api/ivr/yemot/[secret]/route.ts`.
- סביבה: `YEMOT_PHONE_NUMBER`/`YEMOT_WEBHOOK_SECRET`/`PUBLIC_BASE_URL` (בבדיקות דרך דומיין ngrok סטטי עד שיירכש דומיין).

### פרטי תחביר שאומתו בשיחה אמיתית (2026-08-08)
בקשות **GET** (לא POST); `ApiPhone` בפורמט **מקומי**; `read=` לזיהוי דיבור משתמש במילת המפתח `voice`; בטקסט דינמי אסורים רק נקודה+מקף; סדר פרמטרי `read=` קריטי (`sayAndGatherDigits`/`sayAndGatherSpeech`). מקור קהילתי: freeivr.co.il post/76.

### תסריט ו-TTS (לפי משוב משיחות אמיתיות)
- משפט פתיחה קבוע בכל שיחה: "הגעתם למערכת קביעת התורים של מספרת יוסי" (`WELCOME_GREETING`).
- בחירת טווח שעות (בוקר/צהריים/ערב, `getDayPeriods`, `renderTimeOrPeriodStep`) כשמסרבים להצעה הקרובה או כשיש יותר מ-9 שעות פנויות.
- **TTS:** תאריך מילולי ("9 באוגוסט", לא "9/8" שנקרא "9 חלקי 8" ולא "5.8" שה-`sanitize()` קוטע ל"58"); בלי "/" למגדר (`את/ה`) — ניסוח מחדש; ניקוי חלקי (נוסף ניקוד ל"סיום"/"מספרה" 2026-10-05; "מעולה" ללא ניקוד); בלי סימני דגש (עיוות "תוור"); `buildSegments` — הפסקה בין משפטים (קטעי `t-` מחוברים ב-`.`); `speakTime` — שעה ל-12 שעות + "ו-X דקות".
- **רשימת שירותים בטלפון מוגבלת ל-3:** תספורת מבוגר / תספורת + זקן / תספורת ילד (IVR בלבד).
- בחירת "יום אחר" כשאין תאריך נוסף — לא מנתקת (החלטה #15): מודיעה וחוזרת להצעת השעה הקרובה (`renderDayPickStep` → `renderSlotOfferStep`, מחשבת זמינות מחדש); רק אם גם השעה שהוצעה נעלמה — ניתוק.

### מתג כיבוי גלובלי (`AppSettings.ivr_enabled`, 2026-08-09)
`getIvrEnabled`/`setIvrEnabledAction` (`settings.ts`), `IvrToggle` ב-`/admin/settings`, ברירת מחדל פעיל. כשכבוי, `startCall()` בודק אותו **ראשון — לפני `identifyCaller`/כל כתיבה ל-DB** — עונה "לא ניתן לקבוע תורים כרגע דרך הטלפון" ומנתק; לא נוצר `CallState`. שונה מחסימה פר-מספר (`identity.outcome === "blocked"`) — זה חוסם את כל הקו.

### סימון "נקבע בטלפון" אצל הספר (2026-09-22)
`Appointment.booked_via_ivr` (נקבע ב-`bookAppointmentCore(..., viaIvr)`; רק `bookViaPhone.ts` מעביר `true`). `getAppointmentsForWorkDay` מחזיר `booked_via_ivr` ו-`phone_number` (הטלפון נחשף **רק** לתורי IVR, לא בהדפסות/ייצוא), ו-`QuickDayAppointments` מציג "נקבע בטלפון (IVR) · <טלפון>" וכפתור "חיוג" (`tel:`).

---

## 12. אבטחה והרשאות

### כללים לסוכן הקוד
- **לעולם אל תקרא/תדפיס `.env`/`apps/worker/.env`/`~/.ssh`/`~/.aws`** — נאכף ע"י `permissions.deny` וגם ע"י PreToolUse hook חוסם (`.claude/hooks/block-secrets.sh`, `exit 2`) ב-`.claude/settings.json`.
- שאילתות DB תמיד דרך Prisma — לעולם לא `$queryRaw`/`$executeRaw` עם קלט לא-סניטייז.
- כל mutation שמקבל id חייב לבדוק בעלות/הרשאה בשרת (דפוס `booked_by_user_id !== session.sub` ב-`booking.ts`/`cancellationRequests.ts`) — לא לסמוך על כך שה-UI לא מציג כפתור.
- ברירת מחדל סגורה: פעולת אדמין חדשה חייבת `requireAdmin()`/`requireAdminSession()`.
- אל תדפיסו OTP/סיסמה/טוקן ל-console — `MockSmsProvider` (`packages/shared/src/sms.ts`) כבר עושה redact לקודים; לא לרשום טלפון/תוכן הודעה בלוג.
- זרימות אימות (login, reset, שליחה/אימות קוד) עוברות דרך `lib/rateLimit.ts` (in-memory, per-process — מוגבל בפריסה מרובת-אינסטנסים; ראו הערה בקובץ). כל endpoint חדש שמנחש credential חייב rate limit דומה.
- ידוע ופתוח: אין revocation לסשן קיים בעת reset סיסמה (JWT stateless). בשילוב הסשן ה-sliding (סעיף 10), טוקן שממשיך להיות בשימוש הופך בפועל לבלתי-מוגבל בזמן.
- ממצאי ביקורת: `security/` (`INFRA`, `SOFTWARE`, `AGENT-HARDENING`), `privacy/`. סוכן `.claude/agents/security-reviewer.md` זמין.

### גישה ל-`/admin` — שתי הגנות בו-זמנית, לעולם לא רק אחת
1. **`apps/web/src/proxy.ts`** — רץ ב-edge *לפני* כל קוד עמוד, על `/admin/:path*` (matcher); מונע גישה ע"י הקלדת URL גם אם עמוד ישכח לבדוק.
2. **`requireAdmin()`** (`lib/auth/session.ts`) — נקרא בתוך כל `page.tsx` תחת `/admin`.

כל עמוד/נתיב ניהול חדש (כולל דינמיים כמו `/admin/day/[id]`) **חייב** גם להיכלל ב-matcher וגם לקרוא ל-`requireAdmin()` — אף אחד אינו תחליף לשני. (Next.js 16 החליף `middleware.ts` ב-`proxy.ts` — קובץ `middleware.ts` לצד `proxy.ts` יקריס את השרת.)

---

## 13. עיצוב (Design System)

אין קובץ עיצוב נפרד מלבד `.claude/skills/barberbook-design/SKILL.md` — הכללים כאן הם המקור. **לטעון את ה-skill לפני כל שינוי UI.**

### ערכת נושא
**ערכת נושא בהירה אחת גלובלית** לכל האפליקציה (לקוח + `/admin`) מ-2026-07-25. מקור: קובץ פיגמה קהילתי ("Hair Salon | Barber Shop…", file key `RLOrFLhV7pQErRxAUiA3do`) שהותאם עם לוגו "Yossi Barber". `/admin` היה על ערכה כהה נפרדת — בוטלה, כי הלוגו החדש (שחור+זהב) לא קריא על רקע כהה; הטוקנים הכהים הוסרו לגמרי. **חריג יחיד:** עמודי הדפסה/ייצוא נשארים לבנים פשוטים.

### פלטת צבעים (`globals.css`)
| טוקן | HEX | תפקיד |
|---|---|---|
| `cream` | `#fdf8f0` | רקע גלובלי |
| `barber-teal` | `#508186` | מותג ראשי — כותרות, מסגרות, כפתורים, קישורים |
| `barber-teal-dark` | `#3d666a` | לשימוש עתידי (hover/pressed), לא פעיל |
| `ink` | `#1f2421` | טקסט ראשי |
| `slate-muted` | `#7c7c7c` | טקסט משני/placeholder |
| `cream-text` | `#fffcf7` | טקסט על רקע `barber-teal` מלא |

### מוסכמות רכיבים
- שדות טקסט: `rounded-xl`, `border-barber-teal`, רקע לבן.
- כפתור ראשי: `rounded-full bg-barber-teal text-cream-text`. משני: `rounded-full` עם מסגרת בלבד (`border-barber-teal text-barber-teal`).
- כרטיסי מידע: `rounded-xl border-barber-teal bg-white`.
- כפתורי מחיקה/הרס: אותה צורה אבל `text-red-600`/`border-red-600` (`rounded-full` לבודד, `rounded-xl` לפאנל אישור עם כמה כפתורים).
- **כותרות** (`<h1>`, גם `PageHeader`): `text-center`. כשיש כפתור "חזרה" (`forgot-password`/`reset-password`) — `div` שקוף `w-[22px]` בצד הנגדי כדי שהכותרת תהיה ממורכזת ביחס לכל השורה.
- **פונט:** Rubik (`next/font/google`, `hebrew`+`latin`) גלובלי ב-`app/layout.tsx` על `<html>` — לא להוסיף שוב בעמודים. חריג ישן: `app/(auth)/login/page.tsx` דורס ל-`Heebo` (לא טופל).

### לוגו
קובץ יחיד: `apps/web/public/logo-cropped.png` — האמנות בלבד, רקע שקוף אמיתי. הוסרו: `logo.svg` הישן, `<Logo/>`, `admin-logo*.svg`.
- **למה PNG ולא SVG:** ה-SVG המקורי השתמש ב-`<mask>`/`<pattern>`/`<image>` מקוננים — נראה תקין ב-Chromium שולחני אך **לא הופיע בדפדפן נייד אמיתי** (WebKit/Safari). הפתרון: רינדור חד-פעמי ברזולוציה כפולה עם alpha אמיתי ושטיחה ל-PNG. **אם הלוגו משתנה — ליצור PNG חדש באותה שיטה מקובץ המקור; לא לחזור ל-SVG מבוסס mask ולא לערוך PNG ידנית.**
- **קומפוננטים (לא אוחדו, חיים בחלקים שונים של העץ):** `<BrandHero />` (לקוח), `<AdminBrandHero />` (`/admin`, מוזרם דרך `topBanner` של `PageHeader`). שניהם: גרדיאנט `from-barber-teal/50 to-cream`, `-mx-6`, בלי תיבה/מסגרת, גובה `90px` ורוחב `auto`.
- **מיקום: בראש העמוד**, מיד אחרי `<BsdBar/>`. כל עמוד לקוח חדש **חייב** `<BrandHero />` אחרי `<BsdBar/>`; כל עמוד `/admin` חדש **חייב** `topBanner={<AdminBrandHero/>}` ב-`<PageHeader/>`.

### "בס"ד" — `BsdBar`
רכיב אחד משותף (`components/BsdBar.tsx`) בכל עמוד: ילד ראשון תחת `<main>`, `sticky top-0`, `-mx-6 -mt-6` (שובר את `p-6` של ה-`<main>`). ב-`/admin` מגיע דרך `<PageHeader title? topBanner? />` שמחזיר fragment `<><BsdBar/>{topBanner}{title && <h1>}</>` (בלי `div` עוטף, כדי שה-`-mx-6 -mt-6` יעבדו). כרגע כל עמודי `/admin` מעבירים `<AdminBrandHero/>`.

### חיבור לפיגמה
`FIGMA_ACCESS_TOKEN` ב-`.env` (לא ב-git). רשימת frames: `GET https://api.figma.com/v1/files/{key}?depth=2`; תמונות: `GET /v1/images/{key}?ids=<node-ids>&format=png`. אין סקריפט קבוע (נעשה ad-hoc בשיחה); אם יחזור — להפוך לסקריפט ב-`scripts/`.

---

## 14. תחזוקה, תלויות ובדיקות

### Dependabot
`.github/dependabot.yml` פעיל. ניקוי 2026-09-06: `pnpm-workspace.yaml` `overrides` ל-`browserslist`/`deepmerge-ts`; עודכנו `next`, `react*`, `@types/*`, `tsx`, `jose` 5→6 (smoke-test על `signSession`/`verifySessionToken`), `zod` 3→4 (smoke-test על סכימות `validation.ts`); 2026-09-21 תוקנו `sharp` (libheif RCE) ו-`js-yaml`.
**שלושה עדכונים נדחו בכוונה אחרי שנבדקו ונמצאו שוברים** (נשארו כ-PR פתוח ב-GitHub עם הסבר — לא למחוק/למזג בלי לבדוק שהתלויות התעדכנו):
- `@prisma/client`/`prisma` → 7.x: מסיר `datasource { url = env(...) }` — דורש `prisma.config.ts` + driver adapter (מיגרציה אמיתית).
- `typescript` → 7.x: שובר טיפוסי Prisma + `@typescript-eslint` לא תומך; תלוי בעדכון Prisma קודם.
- `eslint` → 10.x: `eslint-plugin-react` (בתוך `eslint-config-next`) קורס על API שהוסר.

### אימות שינויים
- `pnpm test` (בתוך `apps/web`), `tsc --noEmit` (web, worker), `pnpm build`.
- בדיקות ידניות בדפדפן ע"י המשתמשת: US-018..US-023 (2026-07-20/21); US-024 עבד כתופעת לוואי. שאר הפריטים הלא-מאומתים — בסעיף 2.
- מצב git: ה-worktree מכיל לרוב שינויים שטרם נעשה להם commit — להריץ `git status`/`git diff` לפני שמניחים שמשהו בהיסטוריה.
