#!/usr/bin/env bash
# LUDO 3D - one-shot publisher: creates carsaimz/ludo3d and pushes this project.
# The GitHub token is read from the environment and is NEVER written to disk.
#
#   GH_TOKEN=github_pat_xxxx bash scripts/publish.sh
#
# Fine-grained PAT needs: Administration (read/write) + Contents (read/write)
# with access to "All repositories".
set -euo pipefail

: "${GH_TOKEN:?export GH_TOKEN=<your fine-grained PAT> first}"
OWNER="carsaimz"
REPO="ludo3d"
BRANCH="main"

cd "$(dirname "$0")/.."

api() { curl -sS -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" "$@"; }

echo "== checking $OWNER/$REPO =="
STATUS=$(api -o /dev/null -w "%{http_code}" "https://api.github.com/repos/$OWNER/$REPO" || true)
if [ "$STATUS" = "200" ]; then
  echo "repo already exists"
elif [ "$STATUS" = "404" ]; then
  echo "== creating repo =="
  api -X POST https://api.github.com/user/repos \
    -d "{\"name\":\"$REPO\",\"description\":\"LUDO 3D - realistic 3D Ludo (Three.js) with P2P online multiplayer, offline bots, PT/EN/ES/FR i18n and beta APK builds via GitHub Actions\",\"private\":false,\"auto_init\":false}" \
    -o /dev/null -w "create:%{http_code}\n"
else
  echo "unexpected status $STATUS - token may be invalid or missing permission"; exit 1
fi

git init -q 2>/dev/null || true
git config user.name "carsaimz"
git config user.email "carsaimz@users.noreply.github.com"
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$OWNER/$REPO.git"
git add -A
git commit -q -m "LUDO 3D v1.0.0-beta: 3D board, dice without cup, bots, P2P online, i18n (pt/en/es/fr), beta APK CI" || echo "nothing to commit"
git branch -M "$BRANCH"
echo "== pushing =="
git push -u "https://x-access-token:$GH_TOKEN@github.com/$OWNER/$REPO.git" HEAD:"refs/heads/$BRANCH"
echo "done: https://github.com/$OWNER/$REPO"
