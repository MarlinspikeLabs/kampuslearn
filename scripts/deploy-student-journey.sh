#!/usr/bin/env bash
# Run on the VPS, after fetching the reviewed commit into the preparation worktree.
set -Eeuo pipefail
cd /var/www/kampuslearn

if test -n "$(git status --porcelain)"; then
  echo 'Deployment stopped: the serving checkout has uncommitted changes.' >&2
  exit 1
fi
if test "$(git rev-parse HEAD)" != "$(git rev-parse '445f982^{commit}')"; then
  echo 'Deployment stopped: expected the current connected-entry release 445f982.' >&2
  exit 1
fi
target=$(git rev-parse "${1:-origin/feat/student-dashboard-redesign}^{commit}")
git merge-base --is-ancestor HEAD "$target"
git cat-file -e "$target:backend/src/routes/student.js"
git cat-file -e "$target:frontend/app/onboarding/page.js"
git diff --exit-code HEAD "$target" -- frontend/package.json frontend/package-lock.json backend/package.json backend/package-lock.json
test -f frontend/.next/BUILD_ID
test -d frontend/node_modules
test -d backend/node_modules
test -f backend/.env

previous_branch=$(git branch --show-current)
previous_commit=$(git rev-parse HEAD)
stamp=$(date +%Y%m%d-%H%M%S)
backup="$HOME/kampuslearn-backups/student-journey-$stamp"
mkdir -p "$backup"
chmod 700 "$backup"
printf '%s\n' "$previous_commit" > "$backup/previous-commit.txt"
printf '%s\n' "$previous_branch" > "$backup/previous-branch.txt"

rollback() {
  trap - ERR
  set +e
  echo 'Deployment failed. Restoring the previous frontend and API code.'
  pm2 stop kampuslearn-web
  pm2 stop kampuslearn-api
  if test -d "$backup/previous-next"; then
    if test -e frontend/.next; then mv frontend/.next "$backup/failed-next"; fi
    mv "$backup/previous-next" frontend/.next
  fi
  if test -n "$previous_branch"; then git switch "$previous_branch"; else git switch --detach "$previous_commit"; fi
  pm2 restart kampuslearn-api
  pm2 restart kampuslearn-web
  echo "Rollback attempted. Diagnostic files: $backup"
  echo 'The additive student_settings table is retained; no accounts or saved choices are deleted.'
  exit 1
}
trap rollback ERR
pm2 stop kampuslearn-web
pm2 stop kampuslearn-api
mv frontend/.next "$backup/previous-next"
git switch -c "deploy/student-journey-$stamp" "$target"

node backend/scripts/migrate-student-settings.cjs
(
  cd frontend
  NEXT_PUBLIC_API_URL=/api NODE_OPTIONS=--max-old-space-size=768 npm run build
)
pm2 restart kampuslearn-api
pm2 restart kampuslearn-web

healthy=0
for attempt in $(seq 1 15); do
  if curl --fail --silent --max-time 5 http://127.0.0.1:5000/api/health |
    node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{process.exit(JSON.parse(s).database==='connected'?0:1)}catch{process.exit(1)}})"; then
    if curl --fail --silent --output /dev/null --max-time 5 http://127.0.0.1:3001/onboarding; then healthy=1; break; fi
  fi
  sleep 2
done
test "$healthy" -eq 1
# 401 confirms the newly mounted student endpoint exists and rejects anonymous access.
test "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 http://127.0.0.1:5000/api/student/settings)" = '401'
for route in / /login /register /dashboard /learn /profile; do
  curl --fail --silent --output /dev/null --max-time 10 "http://127.0.0.1:3001$route"
done
trap - ERR
echo 'Student onboarding and redesigned dashboard deployed.'
echo "Previous build retained at: $backup"
git log -1 --oneline
pm2 list
