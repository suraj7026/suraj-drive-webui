#!/usr/bin/env bash
set -Eeuo pipefail
base=$(cd -- "$(dirname -- "$0")" && pwd)
active="$HOME/drive/gateway/nginx.conf"
backup="$HOME/migration-audit/drive-opt-in-20b42a8/original.conf"
hash() { sha256sum "$1" | cut -d ' ' -f 1; }
test "$(hash "$backup")" = fcf608df772bb88d41f5ec33857526f1cc1e5ff75fbe968ae393a6c93a98dbed
test "$(hash "$active")" = "$(hash "$base/nginx.conf")" || {
  echo 'Active config differs from this canary; inspect before overwriting.' >&2
  exit 1
}
if test "${1:-}" = --check; then
  echo 'Backup and active-candidate checksums match; rollback is prepared, not executed.'
  exit 0
fi
test "${1:-}" = --apply || { echo 'Use --check or explicitly --apply' >&2; exit 1; }
inode=$(stat -c %i "$active")
cp "$backup" "$active"
test "$(stat -c %i "$active")" = "$inode"
docker exec surajdrive-gateway nginx -t
docker exec surajdrive-gateway nginx -s reload
printf 'Original Drive gateway restored in place; routing cookie is now ignored.\n'
