#!/usr/bin/env bash
# Production deploy (Docker). Run on the prod server from anywhere:
#   bash /root/barberbook/scripts/deploy.sh
#
# Does pull → build → recreate → migrate, and stops on the first check that fails.
# The checks exist because of a real incident (2026-10-06): after `docker compose build`
# the running `web` container was not replaced, so it kept serving a stale, broken build,
# and `migrate` run inside it only saw the old migration files, reported "No pending
# migrations" and silently skipped the new one. See docs/DEPLOY.md, "עדכון קוד".
set -euo pipefail

cd "$(dirname "$0")/.."

step() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }

step "1/6 בדיקות מקדימות"
[ -f .env ] || fail "אין קובץ .env בתיקייה $(pwd)"
if ! git diff --quiet || ! git diff --cached --quiet; then
  git status --short
  fail "יש שינויים מקומיים בקבצים של git — לא ממשיכים (git pull עלול להתנגש)"
fi
stray_env=$(ls -A | grep -E '^\.env' | grep -vxE '\.env|\.env\.example' || true)
if [ -n "$stray_env" ]; then
  fail "קבצי סודות נוספים בתיקיית הפרויקט: $stray_env — להעביר אותם מחוץ לתיקייה (למשל ל-/root/) ולהריץ שוב"
fi
ok "תיקייה נקייה"

step "2/6 git pull"
before=$(git rev-parse --short HEAD)
git pull --ff-only
after=$(git rev-parse --short HEAD)
git log --oneline -1
[ "$before" = "$after" ] && echo "(אין commits חדשים — ממשיכים בכל זאת לבנייה)"

step "3/6 בנייה (web + worker)"
docker compose build web worker

step "4/6 החלפת הקונטיינרים"
docker compose up -d --force-recreate web worker

# The exact failure mode we hit: a container still running the previous image.
repo_migrations=$(ls packages/db/prisma/migrations | grep -c '^2')
container_migrations=$(docker compose exec -T web sh -c 'ls /repo/packages/db/prisma/migrations | grep -c "^2"')
if [ "$container_migrations" != "$repo_migrations" ]; then
  fail "הקונטיינר רואה $container_migrations migrations אבל בקוד יש $repo_migrations — הקונטיינר לא עלה מהבנייה החדשה"
fi
ok "הקונטיינר רץ מהבנייה החדשה ($repo_migrations migrations)"

step "5/6 migrate"
migrate_out=$(docker compose exec -T web pnpm --filter @barberbook/db run migrate 2>&1) || {
  echo "$migrate_out"
  fail "migrate נכשל"
}
echo "$migrate_out" | grep -E 'migrations found|Applying migration|No pending|successfully applied' || true
found=$(echo "$migrate_out" | grep -oE '[0-9]+ migrations found' | grep -oE '^[0-9]+' || true)
[ "$found" = "$repo_migrations" ] || fail "migrate מצא ${found:-?} migrations, בקוד יש $repo_migrations"
ok "מסד הנתונים מעודכן"

step "6/6 בדיקת תקינות"
for i in $(seq 1 30); do
  status=$(docker compose exec -T web node -e \
    "fetch('http://localhost:3000/login').then(r=>console.log(r.status)).catch(()=>console.log(0))" 2>/dev/null || echo 0)
  [ "$status" = "200" ] && break
  sleep 2
done
[ "$status" = "200" ] || fail "דף הכניסה לא עונה (סטטוס $status) — לבדוק: docker compose logs web --since 5m"
ok "האתר עונה"
docker compose ps web worker

printf '\n\033[1;32mהפריסה הושלמה: %s\033[0m\n' "$after"
echo "בטלפון: לסגור ולפתוח מחדש את האפליקציה, כדי שלא תישאר טעונה גרסה ישנה."
