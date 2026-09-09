#!/usr/bin/env bash
# Run on the VPS from the preparation worktree after fetching the admin release.
set -Eeuo pipefail
umask 077
prep_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd /var/www/kampuslearn
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$(git rev-parse '1899db8961829f9881c303b56c055a3bb9dbd6b5^{commit}')"
target=$(git rev-parse "${1:-origin/feat/student-dashboard-redesign}^{commit}")
git merge-base --is-ancestor HEAD "$target"
git cat-file -e "$target:backend/src/routes/admin_console.js"
git cat-file -e "$target:backend/src/services/deleteContent.js"
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
backup="$HOME/kampuslearn-backups/content-delete-$stamp"
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
  echo 'No database migrations were run.'
  exit 1
}
trap rollback ERR
pm2 stop kampuslearn-web
pm2 stop kampuslearn-api
mv frontend/.next "$backup/previous-next"
git switch -c "deploy/content-delete-$stamp" "$target"

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
echo 'Content delete deployed. Sign in as Super Admin to verify Content details.'
echo 'No academic data was imported or changed by this deployment.'
echo "Previous build retained at: $backup"
git log -1 --oneline
pm2 list
