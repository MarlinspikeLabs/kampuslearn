#!/usr/bin/env bash
# Run on the VPS from the preparation worktree after fetching the admin release.
set -Eeuo pipefail
umask 077
prep_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd /var/www/kampuslearn
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$(git rev-parse 'e60d6bf396dc1bac92c247604857e7c15d536c22^{commit}')"
target=$(git rev-parse "${1:-origin/feat/student-dashboard-redesign}^{commit}")
git merge-base --is-ancestor HEAD "$target"
git cat-file -e "$target:backend/src/routes/admin_console.js"
git cat-file -e "$target:backend/src/services/courseDefaults.js"
test "$(git -C "$prep_root" rev-parse HEAD)" = "$target"
test -z "$(git -C "$prep_root" status --porcelain)"
git diff --exit-code HEAD "$target" -- frontend/package.json frontend/package-lock.json backend/package.json backend/package-lock.json
test -f frontend/.next/BUILD_ID
test -d frontend/node_modules
test -d backend/node_modules
test -f backend/.env

previous_branch=$(git branch --show-current)
previous_commit=$(git rev-parse HEAD)
stamp=$(date +%Y%m%d-%H%M%S)
backup="$HOME/kampuslearn-backups/course-upload-$stamp"
mkdir -p "$backup"
printf '%s\n' "$previous_commit" > "$backup/previous-commit.txt"
printf '%s\n' "$previous_branch" > "$backup/previous-branch.txt"
rollback(){
  trap - ERR
  set +e
  echo 'Deployment failed. Restoring the previous frontend and API.'
  pm2 stop kampuslearn-web
  pm2 stop kampuslearn-api
  if test -d "$backup/previous-next"; then
    if test -e frontend/.next; then mv frontend/.next "$backup/failed-next"; fi
    mv "$backup/previous-next" frontend/.next
  fi
  if test -n "$previous_branch"; then git switch "$previous_branch"; else git switch --detach "$previous_commit"; fi
  pm2 restart kampuslearn-api
  pm2 restart kampuslearn-web
  echo "Rollback attempted. Backup: $backup"
  echo 'The additive course seed-tracking table may remain; existing academic records were not reseeded.'
  exit 1
}
trap rollback ERR
pm2 stop kampuslearn-web
pm2 stop kampuslearn-api
mv frontend/.next "$backup/previous-next"
git switch -c "deploy/course-upload-$stamp" "$target"

node backend/scripts/migrate-course-defaults.cjs

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
    if curl --fail --silent --output /dev/null --max-time 5 http://127.0.0.1:3001/admin; then healthy=1; break; fi
  fi
  sleep 2
done
test "$healthy" -eq 1
test "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 http://127.0.0.1:5000/api/admin-console/overview)" = '401'
trap - ERR
echo 'Course and upload update deployed. New departments receive editable starter courses.'
echo 'Next: apply the Nginx fix and run backend/scripts/seed-course-defaults.cjs --dry-run, then --apply.'
echo "Previous build retained at: $backup"
git log -1 --oneline
pm2 list
