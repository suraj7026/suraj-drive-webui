# Drive web-tier candidate publication

Publication only on `migration/image-publication`; no main push, no existing
workflow edits, no production or Kubernetes deployment. Merging to main would
trigger the existing Compose deployment and requires separate approval.

The workflow checks locked dependencies/lint, builds a pinned Node 22 non-root
frontend image, and versions the main server's previously host-only gateway config
in this repository. Gateway behavior is preserved except the non-root listen port
changes from 80 to 8080. It is not installed on the server. Nginx is digest-pinned.
The original Dockerfile and Compose files remain unchanged.

Tests run on a GitHub-hosted runner in an internal Docker network with a mock API.
They check login HTML/auth link, a real JavaScript asset, unauthenticated response,
and gateway prefix stripping, public Host and forwarded protocol. No real OAuth,
MinIO, uploads, sessions or production API requests are made. These checks do not
prove authenticated application operations or WebSocket behavior.

Only after checks pass are `drive-webui:candidate-<commit>` and
`drive-gateway:candidate-<commit>` published. Neither `latest` nor the production
images are overwritten. Runtime image digests are printed and recorded in the run.
The publication Dockerfile excludes environment files and uses explicit source COPY
paths. Private-registry pull credentials are still needed for Kubernetes.

The current deployed WebUI, GitHub main and the user's local development tree differ.
This candidate is based on GitHub main, not uncommitted or unpublished local code.
Actual migration must coordinate frontend/backend/gateway, preserve the domain and
callback path, resolve backend release/rollback blockers, and verify pod-to-host
MinIO/PostgreSQL access. No deployment manifests are applied by this workflow.
