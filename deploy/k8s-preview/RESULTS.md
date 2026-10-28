# Private preview verification — 2026-10-28

Application source: `36062af5f87e9267617b0dfe323e594ec65f83f3`
Publication: https://github.com/suraj7026/suraj-drive-webui/actions/runs/40713735660
Namespace: `drive-web-preview`; worker: `surajhomeserver2`
Private gateway: `http://10.43.53.78`; production remains `localhost:4080`.

## Deployed images

```text
ghcr.io/suraj7026/drive-webui@sha256:8a50c982ca7acf13c1d5245d05b133d96a083c4ee6d7dce65a73a9982d02ddb9
ghcr.io/suraj7026/drive-gateway@sha256:7ff128bba2c63bf156990a784c332c07847b5f974842854feb1e89c4bd0f5438
```

Both Pod imageIDs match these published digests. Both have one Ready replica on
the worker, with zero restarts. Observed idle memory: frontend 40–49 MiB, gateway
8 MiB (not a load/capacity test). Both cluster nodes remain Ready.

## Passed

- Publication: zero-warning lint, seven regression tests, TypeScript, runtime npm
  audit, Docker builds, isolated HTTP/proxy tests, non-root and no embedded .env.
- Server-side admission dry-run, Restricted Pod Security, resource quotas and
  scoped deployer permissions; deployer cannot read secrets.
- Worker application-pod DNS and connectivity to the existing main-host API.
- Main host -> gateway ClusterIP -> frontend login page and all nine referenced
  JS/CSS assets, with successful status and expected media types.
- Gateway `/healthz` 200; proxied backend `/api/health` 200 and expected JSON.
- Unauthenticated `/api/auth/me` returns 401; `/archive` redirects to `/login`.
- Google login entry returns 307 to accounts.google.com with the expected public
  callback origin/path. OAuth state, cookies and client IDs were not printed.
  An initial smoke assertion incorrectly expected 302; comparison with the
  unchanged Docker gateway and backend source established 307 as the real contract.
  The strict assertion was corrected to 307, not replaced by a broad success range.
- Frontend UID 1001, no service-account token, no /app/.env, root filesystem rejects
  writes with EROFS, /tmp remains writable, installed Next.js reports 16.4.3.
- Frontend -> gateway connection is rejected while host -> gateway and frontend ->
  API succeed, consistent with the intended default-deny network policies.
- Live rollback drill: a new frontend revision with an invalid readiness path
  returned 404 and could not replace the healthy replica. A 35-second rollout
  timeout was expected. The existing replica continued serving login. Rollout undo
  restored the previous healthy template; the full smoke test passed afterwards.

## Unchanged / not claimed

All eight original production application Docker image IDs/start times remain
unchanged from 2026-10-27. Public Thirty, Drive login, Portfolio and MinIO health
checks returned 200 after preview deployment. Latest production WebUI deploy run
remains 35459377795; neither main nor its workflow was changed. Outpost untouched.

No production routing cutover, shared-tunnel restart, backend replacement, database
migration, storage movement, duplicate resume consumer, deletion of old production
containers/images/volumes, or CI deployment credential provisioning occurred.

Completed OAuth, authenticated browsing, real upload/download operations and load
behavior remain unverified. Runtime dependency audit has zero findings; the full
build/development dependency audit still lists @babel/core (low), brace-expansion,
browserslist, js-yaml and zod (high). Review them separately rather than claiming a
fully vulnerability-free supply chain. Existing backend readiness/source/rollback
blockers remain relevant to any future backend migration.
