# Opt-in routing verification — 2026-10-28

The operator approved this change after Google rejected automated-browser sign-in.
It is installed and validated, but completed Google sign-in and authenticated file
operations are still awaiting the operator's normal-browser tests.

## Browser links

- Enable (30 minutes): https://drive.sudarshanrajagopalan.one/__migration-preview/enable
- Check route: https://drive.sudarshanrajagopalan.one/__migration-preview/status
- Disable: https://drive.sudarshanrajagopalan.one/__migration-preview/disable

An exact routing cookie selects `k8s-preview-20b42a8`. Missing, invalid or incorrectly
cased values select `docker`. This preference is not authentication or private
access control. Anyone deliberately opting in must still pass normal API auth.
No browser session, password or OAuth token was copied, printed or exported.

## Applied change

- Only `/home/surajadmin/drive/gateway/nginx.conf` was changed and Drive Nginx was
  gracefully reloaded. The single-file bind mount's inode was preserved.
- Original backup: `~/migration-audit/drive-opt-in-20b42a8/original.conf`.
- Original SHA-256: `fcf608df772bb88d41f5ec33857526f1cc1e5ff75fbe968ae393a6c93a98dbed`.
- Candidate/tests/scripts: `~/migration-audit/drive-opt-in-20b42a8/deploy/canary/`.
- Existing proxy targets/prefix handling remain unchanged for default traffic.
- Opted-in traffic uses `http://10.43.53.78:80`, including OAuth entry/callback.
  This supersedes the abandoned browser-interception harness.

## Passed

- 39 isolated fixture cases: default, wrong-case/invalid and valid cookies;
  GET/POST/PUT/DELETE; methods, request bodies, query strings, API prefix handling,
  Host/protocol headers, error propagation, cache controls, opt-out and invalid
  control-endpoint methods. Fixtures never contacted production services and were
  stopped/retained afterward.
- A fixture failure caught Nginx's default absolute HTTP redirect; enable/disable
  now use explicit relative redirects so HTTPS and Secure cookies are preserved.
- Exact candidate syntax validated with the production gateway's Nginx 1.29.4
  binary using a temporary regular file before changing the active config.
- Active config validated again before graceful reload. A short generation-ready
  wait observed the old 404 once, then the new status endpoint became available.
- Local origin AND public HTTPS checks: alternating cookie/no-cookie HTML requests
  select the right route without a shared-cache hit; default asset identifiers
  match the captured pre-change baseline.
- All nine preview JS/CSS assets match direct Kubernetes bytes by SHA-256.
- Both routes return API health 200, unauthenticated /api/auth/me 401, and the
  expected Google 307 redirect with the correct callback origin/path. OAuth state,
  client IDs, full Location headers and auth cookies were not logged.
- Enable/disable return relative 303 redirects with private/no-store responses and
  Secure, HttpOnly, SameSite=Lax, host-only cookies with the expected expiry.
- Rollback --check confirms the original backup and active candidate checksums.
  The gateway rollback was prepared, NOT exercised against live traffic. The
  earlier Kubernetes failed-readiness rollout/undo test is separate evidence.
- Repository lint remains clean with zero warnings.

## Unchanged

All eight original application containers retain their image IDs and start times.
Only the Drive gateway's Nginx workers reloaded; no container restart or redeploy.
Cloudflared stayed active with start time 2026-10-27 16:58:57 IST. Public Thirty,
Portfolio and MinIO health returned 200. No shared tunnel restart, Outpost change,
backend/DB/storage migration or production workflow change occurred.

## Rollback

Inspect first; --check makes no changes. --apply restores the saved bytes in place
and reloads only Drive Nginx. It refuses to overwrite an unexpected newer config.

```sh
bash ~/migration-audit/drive-opt-in-20b42a8/deploy/canary/rollback.sh --check
# Only when rollback is intended:
bash ~/migration-audit/drive-opt-in-20b42a8/deploy/canary/rollback.sh --apply
```

No global cutover has occurred. The operator should first confirm the status page
reports k8s-preview-20b42a8, complete sign-in, and test only a clearly designated
non-sensitive fixture folder/file. Do not delete or modify existing user data.
