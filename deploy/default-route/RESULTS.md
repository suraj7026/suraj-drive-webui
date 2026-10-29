# Default traffic cutover — 2026-10-29

**Kubernetes is now the default for Drive WebUI and gateway traffic.**
Cutover reload: 2026-10-29 15:24:53 UTC. No preview cookie is required.
Status: https://drive.sudarshanrajagopalan.one/__migration-preview/status
Expected response: `k8s-20b42a8`.

## Authorization and functional gate

The operator explicitly approved the default cutover, then confirmed successful
Google sign-in and test upload/download in the opted-in Kubernetes preview.
That confirmation is operator-reported evidence; no authenticated browser session
was imported and those operations are not claimed as automated tests. Google had
rejected the earlier automated browser, which was abandoned rather than bypassed.

## Current path and release

Cloudflare -> existing Docker edge at localhost:4080 -> Kubernetes gateway
10.43.53.78:80 -> Kubernetes frontend / existing main-host Docker backend.
Namespace retains the historical name `drive-web-preview`; both pods run on
surajhomeserver2. The Docker edge and backend are deliberately still in use.

Source: `20b42a80c059976117fe7a7b3d96a74b48071e9d`
Publication: https://github.com/suraj7026/suraj-drive-webui/actions/runs/40716493286

```text
ghcr.io/suraj7026/drive-webui@sha256:93ab2543c0731231c994f1ee60ee5b6f32310f556c650503675c9710bb36e491
ghcr.io/suraj7026/drive-gateway@sha256:2ca54f1c38941ce5a7a9a356798e3b97630eee3fddd62ccfff9eb990a0190f0b
```

No new application image or pod rollout was introduced at cutover. The exact
candidate already validated by the operator now receives default traffic.

## Passed

- Preflight: both cluster nodes Ready; both application pods Ready, zero restarts;
  active edge config matched the recorded canary checksum.
- 40 isolated default-route cases: no/old/invalid/Docker cookies all target K8s;
  GET/POST/PUT/DELETE bodies, full URI/query strings, public Host/HTTPS identity,
  upstream 401/503 preservation, no-store, and retirement of the old opt-in links.
- The shared fixture runner also passed the original 39 canary cases.
- Candidate validated with the production gateway's Nginx binary before writing
  the active file; validated again before graceful reload. Bind-mount inode kept.
- Three complete post-cutover rounds, spaced ten seconds apart, passed against
  localhost:4080 and public HTTPS without requiring a cookie: login content,
  all nine asset digests matching direct K8s bytes, API health 200, unauthenticated
  denial 401, protected-page redirect, Google 307/callback configuration, route
  markers, cookie variants and absence of shared-cache HTML hits.
- Both pods remained Ready with zero restarts afterward; observed usage was
  frontend 4m CPU/61Mi memory and gateway 1m/8Mi. This is not a load test.
- Edge status counts in the observed post-cutover window: 128 2xx, 24 3xx, 6 4xx
  (tests include intentional unauthenticated checks), and zero 5xx.
- Original eight Docker container image IDs/start times unchanged by exact diff.
- Cloudflared's active state/start time and config checksum unchanged by exact
  comparisons. Thirty, Portfolio and MinIO public health checks returned 200.
- Repository lint passed with zero warnings; shell scripts passed bash -n.

## Preserved rollback

Audit directory: `~/migration-audit/drive-default-20b42a8`.
`before.conf` is the exact prior canary configuration (normal traffic on Docker).
Original Docker-only config remains at
`~/migration-audit/drive-opt-in-20b42a8/original.conf`.

```sh
bash ~/migration-audit/drive-default-20b42a8/deploy/default-route/rollback.sh --check
# If explicitly restoring the previous canary/default Docker routing:
bash ~/migration-audit/drive-default-20b42a8/deploy/default-route/rollback.sh --apply
# If explicitly restoring all traffic to the original Docker setup:
bash ~/migration-audit/drive-default-20b42a8/deploy/default-route/rollback.sh --legacy
```

Rollback --check passed. Routing rollback was prepared but NOT executed against
live production after cutover. Installation had an automatic restore trap for
post-check failure; it was not triggered. No old container/image/volume was removed.
The old preview fault-injection helper is now disabled in maintained source because
its namespace serves production. Older audit copies are historical: do not run them.

## Still outstanding

- Replace the Compose release workflow with reviewed, scoped K8s release automation
  before merging main. Main/production workflow were not changed or triggered here.
- Direct Cloudflare-to-K8s routing and eventual removal of the Docker edge require
  separate approval/access; no shared tunnel restart occurred.
- Longer-term monitoring, capacity/load validation and optional availability work.
- Backend and other application migrations remain separate. No Outpost, database,
  MinIO, Ollama or resume-worker modification occurred.

The old enable/disable links now just expire the obsolete routing cookie; they no
longer select Docker. Use the ordinary public Drive URL for normal access.
