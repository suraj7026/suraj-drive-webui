#!/usr/bin/env bash
set -Eeuo pipefail
base=$(cd -- "$(dirname -- "$0")" && pwd)
active="$HOME/drive/gateway/nginx.conf"
audit="$HOME/migration-audit/drive-default-20b42a8"
legacy="$HOME/migration-audit/drive-opt-in-20b42a8/original.conf"
hash() { sha256sum "$1" | cut -d ' ' -f 1; }
mkdir -p "$HOME/.local/state"
exec 9>"$HOME/.local/state/drive-gateway-cutover.lock"
flock -n 9
test "$(hash "$audit/before.conf")" = a6e5ad0ba446cb4c9f467b57102f2448b6693f870cfb2f22c132808394b78055
test "$(hash "$legacy")" = fcf608df772bb88d41f5ec33857526f1cc1e5ff75fbe968ae393a6c93a98dbed
test "$(hash "$active")" = "$(hash "$base/nginx.conf")" || {
  echo 'Active config differs from this release; inspect before overwriting.' >&2
  exit 1
}
case "${1:-}" in
  --check) echo 'Active default config and both rollback snapshots match; no changes made.'; exit 0 ;;
  --apply) restore="$audit/before.conf" ;;
  --legacy) restore="$legacy" ;;
  *) echo 'Use --check, --apply (previous canary/default Docker), or --legacy (all Docker)' >&2; exit 1 ;;
esac
inode=$(stat -c %i "$active")
cp "$restore" "$active"
test "$(stat -c %i "$active")" = "$inode"
docker exec surajdrive-gateway nginx -t
docker exec surajdrive-gateway nginx -s reload
printf 'Selected rollback config restored in place; only Drive Nginx reloaded.\n'
