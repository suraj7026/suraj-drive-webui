# Drive default-route cutover

The operator approved making Kubernetes the default and explicitly confirmed that
Google sign-in and test upload/download operations succeeded in the opt-in preview.
That is operator-reported functional validation, not an automated authenticated test.

## Approved design

Keep Cloudflare's existing localhost:4080 origin and the running Docker edge Nginx.
Make that edge forward all application requests to the tested Kubernetes gateway
at 10.43.53.78:80, regardless of missing, old, invalid or legacy-routing cookies.
The namespace retains its historical name `drive-web-preview` even when serving
production. Do not recreate or rename workloads during this cutover.

The old enable/disable links now only clear the obsolete routing cookie. Neither
selects Docker after cutover. The status endpoint reports k8s-20b42a8. Keep private,
no-store responses during this transition; do not depend on cookie-varying CDN
caches. No silent fallback to Docker may mask a failed Kubernetes request.

Back up the exact active canary config and preserve the original Docker-only config.
Validate fixture routes, verbs, bodies and cookies; test with the running Nginx
binary; write the active single-file bind mount in place; validate and gracefully
reload ONLY Drive Nginx. Automatically restore the preceding canary on failed
post-cutover checks. rollback.sh also supports an explicit Docker-only restoration.

## Boundaries and unfinished work

This moves default WebUI/gateway traffic to Kubernetes but retains Docker as an
edge proxy and rollback environment. Backend, PostgreSQL, MinIO and other services
remain unchanged. No Cloudflare restart, Outpost change, storage migration, image/
volume deletion, replica increase, HPA or production-workflow modification.

Release automation is NOT migrated. The publication branch remains unmerged because
main still triggers Compose. No cluster-admin or deploy credential is issued to CI.
Direct Cloudflare-to-Kubernetes routing and removal of the Docker edge remain future,
separately approved work. Do not run the historical canary install/rollback scripts
against the new default config; their checksums intentionally reject that drift.

## Validation commands

```sh
bash deploy/canary/test-fixtures.sh \
  "$PWD/deploy/default-route/nginx.conf" \
  "$PWD/deploy/default-route/fixture-check.mjs"
node deploy/default-route/live-check.mjs
```

Run live checks from the main host, where the Kubernetes ClusterIP is reachable.
See RESULTS.md for actual application and validation evidence.
