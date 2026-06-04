#!/usr/bin/env bash
# New deploy (2026-06-04): pull PREBUILT static site from the `dist` branch and
# atomically activate it. NO build on the VPS. Single-flight, healthcheck, rollback.
set -euo pipefail

exec 9>/run/1001sovet-pull-deploy.lock
flock -n 9 || { echo "another deploy is already running"; exit 0; }

REPO_URL="https://github.com/filippmiller/sovetydoma.git"
BRANCH="dist"
SRC="/opt/1001sovet-dist"
BASE="/var/www/1001sovet-releases"
CURRENT_JSON="/var/www/1001sovet-current/build.json"
LOG="[1001sovet-deploy]"

mkdir -p "$SRC" "$BASE"
if [ ! -d "$SRC/.git" ]; then
  rm -rf "$SRC"
  git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$SRC"
fi

cd "$SRC"
git remote set-url origin "$REPO_URL"
git fetch --depth=1 origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH" >/dev/null 2>&1
git reset --hard "origin/$BRANCH" >/dev/null 2>&1

TARGET_SHA="$(node -e "try{console.log(require('$SRC/build.json').sha||'')}catch(e){}" 2>/dev/null || true)"
CURRENT_SHA=""
[ -f "$CURRENT_JSON" ] && CURRENT_SHA="$(node -e "try{console.log(require('$CURRENT_JSON').sha||'')}catch(e){}" 2>/dev/null || true)"

if [ -n "$TARGET_SHA" ] && [ "$CURRENT_SHA" = "$TARGET_SHA" ]; then
  echo "$LOG already active $TARGET_SHA"
  exit 0
fi

echo "$LOG activating prebuilt $TARGET_SHA (current: ${CURRENT_SHA:-none})"
REL="rel-${TARGET_SHA:0:8}-$(date -u +%Y%m%d%H%M%S)"
mkdir -p "$BASE/$REL"
cp -a "$SRC"/. "$BASE/$REL/"
rm -rf "$BASE/$REL/.git"
chown -R 1001:1001 "$BASE/$REL"

[ -f "$BASE/$REL/index.html" ] || { echo "$LOG ERROR: no index.html in $REL, refusing"; rm -rf "$BASE/$REL"; exit 1; }

PREV="$(readlink /var/www/1001sovet-current 2>/dev/null || true)"
/opt/deploy/activate.sh "$REL"

sleep 2
CODE="$(curl -s -k -o /dev/null -w '%{http_code}' -H 'Host: 1001sovet.ru' https://127.0.0.1/ 2>/dev/null || echo 000)"
if [ "$CODE" != "200" ]; then
  echo "$LOG HEALTHCHECK FAILED ($CODE) — rolling back to ${PREV:-none}"
  if [ -n "$PREV" ]; then ln -sfn "$PREV" /var/www/1001sovet-current; nginx -t && systemctl reload nginx; fi
  exit 1
fi
echo "$LOG active $REL (healthcheck $CODE)"
