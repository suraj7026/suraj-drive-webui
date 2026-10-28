# Publication verification — updated 2026-10-28

Branch: `migration/image-publication`
Tested source: `36062af5f87e9267617b0dfe323e594ec65f83f3`
Successful run: https://github.com/suraj7026/suraj-drive-webui/actions/runs/40713735660

The three React ESLint errors have been fixed with component regression tests;
these were not Ruff errors. No lint checks were bypassed. Next.js and its ESLint
package were also updated to 16.4.3 after a critical runtime vulnerability finding.

Passed: lint with zero warnings, seven tests, TypeScript, production-dependency
vulnerability audit (zero findings), both Docker builds, isolated frontend/gateway
HTTP tests (login, JS bundle, proxy prefix/Host/protocol, unauthenticated response),
and non-root/no-embedded-.env checks. Both images were published without modifying
latest or triggering the existing production workflow.

```text
ghcr.io/suraj7026/drive-webui@sha256:8a50c982ca7acf13c1d5245d05b133d96a083c4ee6d7dce65a73a9982d02ddb9
ghcr.io/suraj7026/drive-gateway@sha256:7ff128bba2c63bf156990a784c332c07847b5f974842854feb1e89c4bd0f5438
```

Both exact manifests were anonymously accessible from the main host. They are now
deployed privately in Kubernetes namespace `drive-web-preview` on the worker.
See [preview results](../k8s-preview/RESULTS.md) for live validation and rollback
evidence. **Publication and private deployment are not a production cutover.**
The live site still uses the original Docker containers and existing backend.

The original local worktree remains untouched. Main has not been merged or pushed;
its production workflow remains unchanged, with latest run 35459377795. Merging
this branch to main would trigger that existing Compose deployment.

## Historical failures (resolved)

Runs 40708665003 and 40710986900 failed before image build/publication because of
three existing react-hooks/set-state-in-effect errors in delete-dialog.tsx,
new-folder-dialog.tsx and theme-toggle.tsx, plus two unused suppression warnings.
The successful run supersedes that blocked result. See LINT-FIX.md for the focused
changes and local regression evidence. Authenticated live operations and five
remaining development-tool dependency advisories are documented in preview results.
