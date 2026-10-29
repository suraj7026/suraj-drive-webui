#!/usr/bin/env bash
set -Eeuo pipefail
base=$(cd -- "$(dirname -- "$0")" && pwd)
audit="$HOME/migration-audit/drive-default-20b42a8"
active="$HOME/drive/gateway/nginx.conf"
backup="$audit/before.conf"
expected=a6e5ad0ba446cb4c9f467b57102f2448b6693f870cfb2f22c132808394b78055
hash() { sha256sum "$1" | cut -d ' ' -f 1; }
mkdir -p "$HOME/.local/state"
exec 9>"$HOME/.local/state/drive-gateway-cutover.lock"
flock -n 9
test ! -L "$active"
test "$(hash "$active")" = "$expected"
test "$(hash "$backup")" = "$expected"
inode=$(stat -c %i "$active")
rollback() {
  code=$1
  trap - ERR INT TERM HUP
  echo 'Default-route validation failed; restoring the preceding opt-in config (default Docker).' >&2
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
  if test "$(curl -fsS --max-time 3 http://127.0.0.1:4080/__migration-preview/status)" = k8s-20b42a8; then ready=true; break; fi
  sleep 1
done
test "$ready" = true
for round in 1 2 3; do
  node "$base/live-check.mjs"
  if test "$round" -lt 3; then sleep 10; fi
done
trap - ERR INT TERM HUP
printf 'Kubernetes is now the default behind the retained Docker edge proxy.\n'
