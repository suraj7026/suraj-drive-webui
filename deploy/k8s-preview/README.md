# Drive web tier — production-serving Kubernetes deployment

**Kubernetes became the default on 2026-10-29.** See
[cutover results](../default-route/RESULTS.md). The historical namespace name
`drive-web-preview` is retained; it now serves normal production traffic.
One frontend and one gateway run on `surajhomeserver2`. The existing Docker edge
forwards to Kubernetes; the main-host Docker API remains the only backend.
Only the Drive edge config was changed/reloaded at cutover. Outpost, databases,
object storage, container images/start times and production workflows are unchanged.

## Runtime design

- Immutable GHCR images from successful publication run 40716493286. Both digests
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

**The maintained `rollback-check.sh` now refuses to run:** this namespace serves
production. Historical audit copies of that fault-injection drill must not be used
against it. For deliberate routing rollback, inspect
`deploy/default-route/rollback.sh`; it preserves old containers/images/volumes.
The retained Docker edge origin remains `localhost:4080`.

## Still gated

The operator confirmed Google sign-in and test upload/download before approving
default routing. Still pending: scoped Kubernetes release automation, longer-term
monitoring/load validation, and separately approved direct Cloudflare-to-K8s routing.
The backend migration remains separate; its `/api/ready` still returns 401.
Production/development npm audits were clean at publication, not an OS/image
security certification. No HPA or data migration is included.

**Do not merge this branch casually:** pushing/merging to main triggers the existing
Compose deployment workflow. Preview manifests and evidence stay on
`migration/image-publication` pending a reviewed release plan.
