#!/usr/bin/env bash
set -Eeuo pipefail
base=$(cd -- "$(dirname -- "$0")" && pwd)
config=${1:-$base/nginx.conf}
check=${2:-$base/fixture-check.mjs}
tag="drive-canary-fixture-$(date +%s)"
node_image=node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914
nginx_image=nginxinc/nginx-unprivileged@sha256:e2a8fca8aa356d66159aaf8a877a9c126773635adf210503eefaaeaffeed6ad7
node --input-type=module - "$base" "$config" <<'NODE'
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2];
const text = fs.readFileSync(process.argv[3], 'utf8');
assert.equal(text.split('listen 80;').length, 2);
assert.equal(text.split('http://10.43.53.78:80').length, 2);
fs.writeFileSync(base + '/fixture-nginx.conf', text.replace('listen 80;', 'listen 8080;').replace('http://10.43.53.78:80', 'http://drive-preview-fixture:8080'));
NODE
docker network create --internal "$tag" >/dev/null
cleanup() {
  for name in "$tag-gateway" "$tag-upstreams"; do
    if docker container inspect "$name" >/dev/null 2>&1; then docker stop --time 15 "$name" >/dev/null; fi
  done
}
trap cleanup EXIT
docker run -d --name "$tag-upstreams" --network "$tag" \
  --network-alias surajdrive-frontend --network-alias surajdrive-backend --network-alias drive-preview-fixture \
  --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges \
  --memory=64m --cpus=0.25 -v "$base/fixture.mjs:/fixture.mjs:ro" "$node_image" node /fixture.mjs >/dev/null
docker run -d --name "$tag-gateway" --network "$tag" \
  --read-only --cap-drop ALL --security-opt no-new-privileges --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --memory=128m --cpus=0.25 -v "$base/fixture-nginx.conf:/etc/nginx/conf.d/default.conf:ro" "$nginx_image" >/dev/null
ready=false
for attempt in $(seq 1 30); do
  if docker exec "$tag-gateway" wget -q -T 2 -O /dev/null http://127.0.0.1:8080/__migration-preview/status; then ready=true; break; fi
  sleep 1
done
test "$ready" = true
docker run --name "$tag-check" --network "$tag" \
  --user 1000:1000 --read-only --cap-drop ALL --security-opt no-new-privileges \
  --memory=128m --cpus=0.25 -v "$check:/check.mjs:ro" "$node_image" node /check.mjs "http://$tag-gateway:8080"
printf 'Stopped fixtures retained under %s; no live backend requests were made.\n' "$tag"
