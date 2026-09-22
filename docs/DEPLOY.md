# פריסה לפרודקשן — שרת חדש עם Docker

מדריך שלב-אחר-שלב להרצת BarberBook על השרת החדש, מ-`git clone` ריק ועד קישור
HTTPS חי. כל הפקודות רצות **בשרת עצמו** (SSH), לא במחשב המקומי. מבוסס על
`Dockerfile`, `docker-compose.yml` ו-`nginx/templates/` שבשורש הריפו.

לפני שמתחילים: ודאו שהדומיין (`DOMAIN`) כבר מצביע (רשומת DNS מסוג A) לכתובת ה-IP
של השרת החדש — בלי זה שלב הנפקת ה-SSL (שלב 2) ייכשל.

---

## שלב 0 — הכנת השרת

```bash
# Docker + Compose plugin (Debian/Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# להתנתק ולהתחבר מחדש כדי שחברות הקבוצה תיכנס לתוקף, ואז:
docker --version
docker compose version
```

## שלב 1 — קלונינג + `.env`

```bash
git clone https://github.com/galim25/gali.git barberbook
cd barberbook
cp .env.example .env
```

ערכו את `.env` (`nano .env`) ומלאו **ערכים אמיתיים חדשים**, לא את אלה מהשרת
הישן:

| משתנה | ערך |
|---|---|
| `SESSION_SECRET` | מחרוזת אקראית ארוכה חדשה — `openssl rand -base64 48` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | בחרו סיסמה חדשה וחזקה |
| `DATABASE_URL` | `postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@postgres:5432/<POSTGRES_DB>?schema=public` — שימו לב: המארח הוא `postgres` (שם השירות ב-compose), **לא** `localhost` |
| `DOMAIN` | הדומיין האמיתי, למשל `booking.yossi-barber.co.il` |
| `NODE_ENV` | `production` |
| `ADMIN_SEED_PASSWORD` | *(אופציונלי)* סיסמת אדמין ראשונית לבחירתכם — אם משאירים ריק, `pnpm db:seed` (שלב 3) יגריל אחת ותדפיס אותה פעם אחת בלבד |
| `YEMOT_WEBHOOK_SECRET` / `YEMOT_PHONE_NUMBER` | אותם ערכים כמו בשרת הישן |
| `PUBLIC_BASE_URL` | `https://<DOMAIN>` — **לא** דומיין ה-ngrok הישן |

**אין** להעתיק את `COOKIE_SECURE="false"` מהשרת הישן ל-`.env` החדש — משאירים
אותו לא מוגדר עד שלב 2 מסתיים (HTTPS אמיתי), אחרת עוגיית ההתחברות תישלח בלי
`Secure` גם כש-HTTPS כבר עובד.

## שלב 1.5 — בדיקה מוקדמת בלי דומיין (אופציונלי)

אם עוד אין דומיין (עדיין לא נרכש / DNS לא הופיע), אפשר להריץ ולבדוק את
המערכת כבר עכשיו דרך `http://<IP-של-השרת>:3000` — בדיוק כמו שהשרת הישן עבד
לפני שהיה לו דומיין. מדלגים על `nginx`/`certbot` (הם דורשים `DOMAIN` אמיתי)
ומעלים רק את שלושת השירותים האחרים, עם קובץ override שחושף את הפורט:

```bash
# ב-.env: להשאיר DOMAIN ריק/placeholder, ולוודא
COOKIE_SECURE="false"   # כמו בשרת הישן — בלי HTTPS העוגיה Secure תיזרק בשקט

docker compose -f docker-compose.yml -f docker-compose.preview.yml up -d postgres web worker
docker compose exec web pnpm --filter @barberbook/db run migrate
docker compose exec web pnpm --filter @barberbook/db run seed
```

ואז לפתוח `http://<IP>:3000` בדפדפן. ודאו שפורט 3000 פתוח בפיירוול/בקבוצת
האבטחה של הספק (כמו שפורט 39000 היה פתוח בשרת הישן).

**מה לא ניתן לבדוק בשלב הזה:** שיחת ימות המשיח אמיתית (`PUBLIC_BASE_URL`
חייב להיות HTTPS ציבורי אמיתי) ו-HTTPS עצמו — שניהם ממתינים לדומיין.

**כשהדומיין מוכן:** להפסיק את הקומפוזיציה הזו (`docker compose -f
docker-compose.yml -f docker-compose.preview.yml down`), למלא `DOMAIN`
ב-`.env`, ולהמשיך משלב 2 הרגיל למטה (שמעלה גם את `nginx`/`certbot` בלי קובץ
ה-override, ופותח 80/443 במקום 3000).

## שלב 2 — עליית nginx + הנפקת תעודת SSL אמיתית (bootstrap)

זה השלב המסובך היחיד: `nginx` לא יכול לעלות בלי תעודה שכבר קיימת בנתיב שהוא
מצפה לה, ו-`certbot` לא יכול להנפיק תעודה בלי ש-`nginx` כבר רץ ומגיש את
ה-ACME challenge. פותרים עם תעודה זמנית-עצמית ("dummy") שמוחלפת מיד:

```bash
# תעודה זמנית עצמית, רק כדי ש-nginx יסכים לעלות בכלל
DOMAIN=$(grep '^DOMAIN=' .env | cut -d= -f2 | tr -d '"')
docker compose run --rm --entrypoint sh certbot -c "
  mkdir -p /etc/letsencrypt/live/$DOMAIN &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj '/CN=localhost'
"

# מעלים את כל השירותים — nginx כבר יעלה תקין עם התעודה הזמנית
docker compose up -d

# מנפיקים תעודה אמיתית מ-Let's Encrypt (דורש שה-DNS כבר מצביע לשרת!)
docker compose run --rm --entrypoint sh certbot -c "
  rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf &&
  certbot certonly --webroot -w /var/www/certbot \
    -d $DOMAIN --email <המייל_שלכם> --agree-tos --no-eff-email
"

# טוענים מחדש את nginx כדי שישתמש בתעודה האמיתית
docker compose exec nginx nginx -s reload
```

ה-`certbot` שכבר רץ כשירות ב-`docker compose up` (שלב הקודם) ידאג לחידוש
אוטומטי מכאן והלאה — אין צורך בפעולה ידנית נוספת.

## שלב 3 — מסד נתונים: מיגרציה + seed נקי

**החלטה שסוכמה מראש: אין ייבוא נתונים מהשרת הישן** — לקוחות/תורים/הגדרות של
הימות מתחילים מאפס בשרת החדש.

```bash
docker compose exec web pnpm --filter @barberbook/db run migrate
docker compose exec web pnpm --filter @barberbook/db run seed
```

פלט ה-seed ידפיס את סיסמת האדמין החד-פעמית (אם לא נקבע `ADMIN_SEED_PASSWORD`
ב-`.env`) — שמרו אותה במקום בטוח, היא לא תודפס שוב.

## שלב 4 — הפעלת `COOKIE_SECURE`

עכשיו ש-HTTPS אמיתי עובד (בדקו ב-דפדפן: `https://<DOMAIN>` נטען בלי אזהרת
תעודה):

```bash
sed -i '/^COOKIE_SECURE=/d' .env   # מסירים override אם קיים — ברירת המחדל
                                     # (NODE_ENV=production) כבר true
docker compose up -d web            # מפעילים מחדש עם ה-.env המעודכן
```

## שלב 5 — הפניית ימות המשיח לדומיין החדש

1. ודאו ש-`PUBLIC_BASE_URL` ב-`.env` (שלב 1) כבר מוגדר לדומיין האמיתי, לא
   ל-ngrok.
2. היכנסו לפאנל הניהול של ימות המשיח ועדכנו שם את כתובת ה-`api_link`/callback
   של השלוחה לכתובת החדשה: `https://<DOMAIN>/api/ivr/yemot/<YEMOT_WEBHOOK_SECRET>`.
3. בצעו שיחת בדיקה אמיתית מהטלפון.

## שלב 6 — בדיקת קבלה

- [ ] `https://<DOMAIN>` נטען עם מנעול תקין (בלי אזהרת דפדפן)
- [ ] הרשמת לקוח חדש + התחברות
- [ ] קביעת תור מקצה לקצה (בחירת ספר/שירות/תאריך/שעה)
- [ ] כניסת אדמין (`/admin`) עם הסיסמה משלב 3, פתיחת יום עבודה
- [ ] שיחת ימות המשיח אמיתית עד קביעת תור בפועל
- [ ] `docker compose logs worker --tail 50` — מוודאים שהתזכורות (`node-cron`)
      רצות בלי שגיאות

## שלב 7 — גיבויים

```bash
# גיבוי ידני חד-פעמי לבדיקה:
docker compose exec postgres pg_dump -U <POSTGRES_USER> <POSTGRES_DB> | gzip > backup-$(date +%F).sql.gz
```

מומלץ להוסיף את זה כ-cron יומי בשרת (`crontab -e`) לפני שסומכים על המערכת
בפרודקשן באמת — לא הוגדר עדיין באופן אוטומטי.

## שלב 8 — כיבוי השרת הישן

רק **אחרי** ששלב 6 עבר במלואו ומספר ימים של שימוש אמיתי בשרת החדש עברו בלי
תקלות: `pm2 stop barberbook-web` בשרת הישן (`161.97.89.252`), ולבסוף לשקול
ביטול/שחרור השרת עצמו מול הספק.

---

## תחזוקה שוטפת

- **עדכון קוד:** `git pull && docker compose build && docker compose up -d`
- **לוגים:** `docker compose logs -f web` / `worker` / `nginx`
- **מיגרציה חדשה של סכימה:** `docker compose exec web pnpm --filter @barberbook/db run migrate`
  (לא `pnpm db:migrate` — תיקון 2026-09-22: תיקיית העבודה במיכל `web` היא `apps/web`, שאין
  בו script כזה; ה-alias הזה קיים רק ב-`package.json` הראשי. אושר בפועל בפרודקשן.)

### הפעלת התראות Push למנהל (נוסף 2026-09-06)

פיצ'ר חדש: התראת מכשיר אמיתית (לא רק badge בתוך האפליקציה) לספר על כל תור
חדש/בקשת תור/בקשת ביטול — ראו את הקטע המתאים ב-`.env.example`. **חשוב לגבי
הסדר:** `web-push` (הכלי ליצירת המפתחות) ו-`NEXT_PUBLIC_VAPID_PUBLIC_KEY`
(שנטמע בזמן build) שניהם לא קיימים עדיין בקונטיינר הישן — צריך לבנות מחדש
*לפני* שאפשר בכלל ליצור מפתחות בתוכו. הכי פשוט: יוצרים את המפתחות מחוץ
לדוקר לגמרי (בכל מחשב עם Node, כולל המחשב האישי) עם:

```bash
npx web-push generate-vapid-keys
```

מעתיקים את "Public Key"/"Private Key" מהפלט אל `.env` בשרת (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`/
`VAPID_PRIVATE_KEY`, ראו `.env.example` להסבר המלא + `VAPID_SUBJECT`) **לפני** ה-build, ואז:

```bash
git pull
docker compose build web
docker compose up -d web
docker compose exec web pnpm --filter @barberbook/db run migrate   # מוסיף את טבלת push_subscriptions
```

לאחר מכן, בכניסה כמנהל אל `/admin/notifications`, יופיע כפתור "הפעלת
התראות" — לחיצה עליו (בכל מכשיר שרוצים לקבל בו התראות, בנפרד) מבקשת הרשאה
מהדפדפן. **חשוב לאייפון:** Apple מאפשרת Web Push רק לאפליקציה שהותקנה
בפועל למסך הבית (שיתוף ← הוסף למסך הבית) — בלי זה הכפתור באייפון יסביר
זאת במקום להפעיל. באנדרואיד/מחשב זה עובד גם בלי התקנה.
