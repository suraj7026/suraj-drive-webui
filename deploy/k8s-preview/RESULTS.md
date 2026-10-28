# Private preview verification — 2026-10-28

Application source: `20b42a80c059976117fe7a7b3d96a74b48071e9d`
Publication: https://github.com/suraj7026/suraj-drive-webui/actions/runs/40716493286
Namespace: `drive-web-preview`; worker: `surajhomeserver2`
Private gateway: `http://10.43.53.78`; public origin remains `localhost:4080`.
The approved [opt-in route](../canary/RESULTS.md) sends only cookie-selected requests
through that existing gateway to Kubernetes; default traffic remains on Docker.

## Deployed images

```text
ghcr.io/suraj7026/drive-webui@sha256:93ab2543c0731231c994f1ee60ee5b6f32310f556c650503675c9710bb36e491
ghcr.io/suraj7026/drive-gateway@sha256:2ca54f1c38941ce5a7a9a356798e3b97630eee3fddd62ccfff9eb990a0190f0b
```

Both Pod imageIDs match these published digests. Both have one Ready replica on
the worker, with zero restarts. Observed memory after the updated rollout: frontend
45 MiB, gateway 7 MiB (not a load/capacity test).

## Passed

- Publication: zero-warning lint, seven regression tests, TypeScript, runtime npm
  and development dependency audit (zero findings), Docker builds, isolated
  HTTP/proxy tests, non-root and no embedded .env.
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
- Live rollback drill on the preceding 36062af candidate: a new frontend revision with an invalid readiness path
  returned 404 and could not replace the healthy replica. A 35-second rollout
  timeout was expected. The existing replica continued serving login. Rollout undo
  restored the previous healthy template; the full smoke test passed afterwards.

## Unchanged / not claimed

All eight original production application Docker image IDs/start times remain
unchanged from 2026-10-27. Public Thirty, Drive login, Portfolio and MinIO health
checks returned 200 after preview deployment. Latest production WebUI deploy run
remains 35459377795; neither main nor its workflow was changed. Outpost untouched.

No global production routing cutover, shared-tunnel restart, backend replacement, database
migration, storage movement, duplicate resume consumer, deletion of old production
containers/images/volumes, or CI deployment credential provisioning occurred.

Completed OAuth in the preview, authenticated browsing, real upload/download
operations and load behavior remain unverified. The operator reported successful
sign-in in another browser, which does not establish private-preview validation.
The browser-interception approach was abandoned after Google rejected the automated
browser. The approved opt-in gateway route now enables ordinary-browser validation.
No existing browser sessions or cookies were imported.

The five prior development dependency findings are resolved. The updated candidate
passed the full npm audit, publication and private rollout, then repeated smoke,
network-policy and runtime-hardening checks. This audit is not a container/OS
vulnerability certification. Existing backend readiness/source/rollback blockers
remain relevant to any future backend migration.
