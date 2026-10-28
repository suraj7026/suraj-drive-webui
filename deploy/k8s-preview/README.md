# Drive web tier — private Kubernetes preview

This is an actual isolated deployment, **not a public production cutover**.
Namespace: `drive-web-preview`; node: `surajhomeserver2`; one frontend and one
Nginx gateway. The existing main-host Docker API remains the only backend.
Outpost, databases, object storage, production containers, routes and existing
production workflows are not modified.

## Runtime design

- Immutable GHCR images from successful publication run 40713735660. Both digests
  were verified anonymously accessible before deployment; no pull secret needed.
- Restricted Pod Security admission, non-root UIDs, RuntimeDefault seccomp,
  read-only root filesystems, dropped capabilities, no privilege escalation and
  no service-account-token mounts. Only bounded temporary/cache volumes are writable.
- Resource requests/limits, startup/readiness/liveness probes, 30-second graceful
  termination, one surge replica and zero unavailable replicas on rolling updates.
- Namespace quota permits four rollout pods but no PVCs, NodePorts or LoadBalancers.
- Default-deny ingress/egress. DNS and main-host API TCP/4001 are allowed; the gateway
  additionally reaches the frontend. Main-host origin traffic reaches the gateway.
  Kubernetes' implicit same-node/kubelet allowances still apply; this is not a
  substitute for host firewall hardening.
- Selectorless backend Service plus EndpointSlice points to `192.168.1.37:4001`.
  The endpoint's `ready: true` is operator configuration, not a backend health check.
  Live API health is explicitly checked by smoke.mjs.
- `web-deployer` can patch only these two named Deployments and observe this
  namespace. It cannot read secrets. No deploy token or cluster-admin credential
  was issued to CI. Bootstrap/network/service changes remain operator-managed.

## Current validation/access

From the main host (add `$HOME/.local/bin` to PATH for kubectl):

```sh
node deploy/k8s-preview/smoke.mjs http://10.43.53.78
kubectl exec -i -n drive-web-preview deployment/drive-webui -- \
  node --input-type=module < deploy/k8s-preview/egress-check.mjs
```

From a workstation, an optional private inspection tunnel is:

```sh
ssh -N -L 14080:10.43.53.78:80 surajadmin@surajhomeserver
```

Then open `http://localhost:14080/login`. The compiled API URL and OAuth callback
still use the existing production domain. This tunnel is **not** a complete private
OAuth/authenticated-file-flow test. Do not export production session cookies into
logs or claim authenticated operations have been validated through this tunnel.

## Reproducible operator application

Inspect manifests and current images first. Only this namespace is in scope.
Create the namespace if absent, apply bootstrap.yaml, server-dry-run the rendered
resources, apply NetworkPolicies before workloads, then apply the kustomization.
Do not replace immutable image references with latest or candidate tags.

```sh
kubectl apply --dry-run=server -f deploy/k8s-preview/bootstrap.yaml
kubectl apply -f deploy/k8s-preview/bootstrap.yaml
kubectl apply --dry-run=server -k deploy/k8s-preview
kubectl apply -n drive-web-preview -f deploy/k8s-preview/network-policy.yaml
kubectl apply -k deploy/k8s-preview
kubectl rollout status -n drive-web-preview deployment/drive-webui --timeout=240s
kubectl rollout status -n drive-web-preview deployment/drive-gateway --timeout=240s
```

`rollback-check.sh` is an explicit **preview-only fault injection**, not an ordinary
health check: it makes a surge replica fail readiness, confirms the original still
serves, and restores the prior Deployment revision even on an error. Do not adapt
it to production without separate approval. The existing Docker origin remains
`localhost:4080`; no rollback involves deleting its containers/images/volumes.

## Still gated

Controlled completed OAuth and authenticated browse/upload/download tests, review
of source-versus-running-backend drift, approval for public routing and the shared
Cloudflare restart, and eventual scoped deployment-pipeline replacement. The legacy
API's `/api/ready` still returns 401. Five development-tool dependency advisories
remain (four high, one low); production dependency audit is clean. No HPA or data
migration is included.

**Do not merge this branch casually:** pushing/merging to main triggers the existing
Compose deployment workflow. Preview manifests and evidence stay on
`migration/image-publication` pending a reviewed release plan.
