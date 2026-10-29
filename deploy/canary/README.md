# Historical approved opt-in Drive preview

**Kubernetes is now the default.** Use [default-route documentation](../default-route/README.md)
for current operations. This directory preserves the prior canary implementation
and tests. Do not apply this historical configuration to production unintentionally.

The operator approved a temporary cookie-selected preview after Google rejected
the automation-controlled browser. Use a normal, non-automated browser; do not
copy session cookies or weaken Google authentication.

## Design / bounds

Only `/home/surajadmin/drive/gateway/nginx.conf` and the running Drive Nginx
configuration are changed. The existing Docker frontend/backend proxy blocks are
preserved for requests without the exact `drive_preview=k8s-20b42a8` cookie.
Opted-in requests use the Kubernetes gateway at `10.43.53.78:80`, including the full
OAuth flow. Named-location dispatch preserves request methods, bodies and URI
prefixes. A failed preview request is not silently retried against production.

- `/__migration-preview/enable`: sets a host-only, Secure, HttpOnly, SameSite=Lax
  routing cookie for 30 minutes, then redirects to /login.
- `/__migration-preview/disable`: expires only that routing cookie, then redirects.
- `/__migration-preview/status`: reports docker or k8s-preview-20b42a8.
- This cookie is a routing preference, NOT authentication or an access-control
  boundary. Anyone deliberately following the enable link can opt in; real API
  authorization remains unchanged. Endpoints contain no secrets.
- Preview responses and control endpoints are private/no-store. Validate actual
  public cookie/no-cookie responses to detect CDN interference; do not assume
  Vary: Cookie alone partitions Cloudflare's cache.

## Validation and application

1. Preserve the exact original config and hash in the server audit directory.
2. Test isolated mock upstreams: no cookie, wrong cookie, valid cookie; all verbs;
   bodies and query strings; API stripping; Host/protocol; expiry and error status.
3. Validate the exact candidate with the running production Nginx binary.
4. Write the candidate **in place**: the production config is a read-only single-file
   bind mount, so replacing the host inode would leave the container on the old file.
5. Run nginx -t, gracefully reload only surajdrive-gateway, and verify both routes
   locally and publicly. Restore the saved bytes in place and reload on failure.

No shared Cloudflare restart/config change, Compose redeploy, backend replacement,
DB/storage change, old image/container deletion, or Outpost modification is allowed.
No production workflow is changed or triggered. Keep main unmerged.

Automated HTTP tests do not establish completed OAuth or authenticated file
operations. The operator must validate those in the opted-in normal browser before
any global cutover. The opt-in setup itself is not a global production cutover.
