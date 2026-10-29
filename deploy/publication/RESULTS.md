# Publication verification — updated 2026-10-29

Branch: `migration/image-publication`
Tested source: `20b42a80c059976117fe7a7b3d96a74b48071e9d`
Successful run: https://github.com/suraj7026/suraj-drive-webui/actions/runs/40716493286

The three React ESLint errors have been fixed with component regression tests;
these were not Ruff errors. No lint checks were bypassed. Next.js and its ESLint
package were also updated to 16.4.3 after a critical runtime vulnerability finding.

Passed: lint with zero warnings, seven tests, TypeScript, full production/development
dependency vulnerability audit (zero findings), both Docker builds, isolated frontend/gateway
HTTP tests (login, JS bundle, proxy prefix/Host/protocol, unauthenticated response),
and non-root/no-embedded-.env checks. Both images were published without modifying
latest or triggering the existing production workflow.

```text
ghcr.io/suraj7026/drive-webui@sha256:93ab2543c0731231c994f1ee60ee5b6f32310f556c650503675c9710bb36e491
ghcr.io/suraj7026/drive-gateway@sha256:2ca54f1c38941ce5a7a9a356798e3b97630eee3fddd62ccfff9eb990a0190f0b
```

Both exact manifests were anonymously accessible from the main host and deployed
to Kubernetes namespace `drive-web-preview` on the worker. After the operator
confirmed signed-in validation, the approved [default cutover](../default-route/RESULTS.md)
made these same images serve normal traffic on 2026-10-29. No new image was built
at cutover. The existing Docker edge and backend remain in use; the old Docker
frontend remains available for rollback.

The original local worktree remains untouched. Main has not been merged or pushed;
its production workflow remains unchanged, with latest run 35459377795. Merging
this branch to main would trigger that existing Compose deployment.

## Historical failures (resolved)

Runs 40708665003 and 40710986900 failed before image build/publication because of
three existing react-hooks/set-state-in-effect errors in delete-dialog.tsx,
new-folder-dialog.tsx and theme-toggle.tsx, plus two unused suppression warnings.
The successful run supersedes that blocked result. See LINT-FIX.md for the focused
changes and local regression evidence. Run 40713735660 first resolved the lint
failures; run 40716493286 additionally resolves all five remaining development
dependency findings. See DEPENDENCIES.md. Signed-in validation was subsequently
confirmed by the operator, not claimed as automated browser testing.
