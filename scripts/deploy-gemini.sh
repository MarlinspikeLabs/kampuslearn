#!/usr/bin/env bash
# Run on the VPS from the preparation worktree after configuring Gemini there.
set -Eeuo pipefail
umask 077
prep_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
config_source="$prep_root/backend/.env.gemini"
test -f "$config_source"
test ! -L "$config_source"
cd /var/www/kampuslearn
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$(git rev-parse 'abc1825d893662a193c67873672bec4685c748f5^{commit}')"
target=$(git rev-parse "${1:-origin/feat/student-dashboard-redesign}^{commit}")
git merge-base --is-ancestor HEAD "$target"
git cat-file -e "$target:backend/src/services/ai/gemini.js"
git cat-file -e "$target:backend/migrations/20260907_gemini.sql"
test "$(git -C "$prep_root" rev-parse HEAD)" = "$target"
test -z "$(git -C "$prep_root" status --porcelain)"
git diff --exit-code HEAD "$target" -- frontend/package.json frontend/package-lock.json backend/package.json backend/package-lock.json
test -f frontend/.next/BUILD_ID
test -d frontend/node_modules
test -d backend/node_modules
test -f backend/.env

# Validate configuration without sending a provider request or printing the key.
NODE_PATH=/var/www/kampuslearn/backend/node_modules node "$prep_root/backend/scripts/check-gemini.cjs"
previous_branch=$(git branch --show-current)
previous_commit=$(git rev-parse HEAD)
stamp=$(date +%Y%m%d-%H%M%S)
backup="$HOME/kampuslearn-backups/gemini-$stamp"
mkdir -p "$backup"
printf '%s\n' "$previous_commit" > "$backup/previous-commit.txt"
printf '%s\n' "$previous_branch" > "$backup/previous-branch.txt"
had_config=0
if test -f backend/.env.gemini; then cp backend/.env.gemini "$backup/previous-gemini-env"; had_config=1; fi
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
  if test "$had_config" -eq 1; then cp "$backup/previous-gemini-env" backend/.env.gemini;
  elif test -f backend/.env.gemini; then mv backend/.env.gemini "$backup/failed-gemini-env"; fi
  if test -n "$previous_branch"; then git switch "$previous_branch"; else git switch --detach "$previous_commit"; fi
  pm2 restart kampuslearn-api
  pm2 restart kampuslearn-web
  echo "Rollback attempted. Backup: $backup"
  echo 'The additive AI tables and columns are retained; no accounts or materials are deleted.'
  exit 1
}
trap rollback ERR
pm2 stop kampuslearn-web
pm2 stop kampuslearn-api
mv frontend/.next "$backup/previous-next"
git switch -c "deploy/gemini-$stamp" "$target"
install -m 600 "$config_source" backend/.env.gemini
node backend/scripts/migrate-gemini.cjs
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
    if curl --fail --silent --output /dev/null --max-time 5 http://127.0.0.1:3001/ai-chat; then healthy=1; break; fi
  fi
  sleep 2
done
test "$healthy" -eq 1
test "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 http://127.0.0.1:5000/api/ai/usage)" = '401'
trap - ERR
echo 'Gemini tutor code deployed. Sign in and send a study question to verify the complete flow.'
echo 'Run the material indexer after installing pdftotext to enable course excerpts.'
echo "Previous build retained at: $backup"
git log -1 --oneline
pm2 list
