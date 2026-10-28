#!/usr/bin/env bash
# Explicitly operator-run; never invoked by the publication workflow.
set -Eeuo pipefail
base=$(cd -- "$(dirname -- "$0")" && pwd)
audit="$HOME/migration-audit/drive-opt-in-20b42a8"
active="$HOME/drive/gateway/nginx.conf"
backup="$audit/original.conf"
expected=fcf608df772bb88d41f5ec33857526f1cc1e5ff75fbe968ae393a6c93a98dbed
hash() { sha256sum "$1" | cut -d ' ' -f 1; }
test ! -L "$active"
test "$(hash "$active")" = "$expected"
test "$(hash "$backup")" = "$expected"
test -s "$audit/baseline-assets.json"
inode=$(stat -c %i "$active")
rollback() {
  code=$1
  trap - ERR INT TERM HUP
  echo 'Canary validation failed; restoring original Drive gateway config.' >&2
  cp "$backup" "$active"
  docker exec surajdrive-gateway nginx -t
  docker exec surajdrive-gateway nginx -s reload
  exit "$code"
}
trap 'rollback "$?"' ERR
trap 'rollback 130' INT TERM HUP
cp "$base/nginx.conf" "$active"
test "$(stat -c %i "$active")" = "$inode"
docker exec surajdrive-gateway nginx -t
docker exec surajdrive-gateway nginx -s reload
ready=false
for attempt in $(seq 1 10); do
  if test "$(curl -fsS --max-time 3 http://127.0.0.1:4080/__migration-preview/status)" = docker; then ready=true; break; fi
  sleep 1
done
test "$ready" = true
node "$base/live-check.mjs" verify "$audit/baseline-assets.json"
trap - ERR INT TERM HUP
printf 'Validated opt-in config installed in place; only Drive Nginx was gracefully reloaded.\n'
