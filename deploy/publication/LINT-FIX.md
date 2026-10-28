# WebUI lint fix and deployment preparation — 2026-10-28

The reported failures were React ESLint rules, not Ruff. No rule is suppressed.

- Dialogs now mount state only while open, so reopening resets values/errors without
  effects setting state. Delete state is also keyed by target identity.
- The new-folder dialog's Escape/close controls cannot dismiss a pending submission.
- Theme selection uses useSyncExternalStore with a stable server snapshot, browser
  preference subscriptions and same-tab notifications; DOM synchronization stays an
  effect, but no effect sets React state.
- Removed two unused lint-disable comments.
- Seven component regression tests cover reopen/error resets, changing delete targets,
  pending submission, SSR, same-page theme synchronization and cross-tab preferences.
  Four tests failed on the old implementation and all seven pass after the fixes.

A deployment preflight also found critical vulnerabilities in Next.js 16.2.4.
Next.js and eslint-config-next were upgraded together to 16.4.3; affected runtime
transitives were refreshed within constraints. The production dependency audit is
clean; a high/critical runtime audit gate is now mandatory before publication.
No npm audit --force, legacy-peer-deps, lint suppression or continue-on-error was used.
Node type definitions match the Node 22 image/test runtime. Vitest/RTL/jsdom are
locked development-only dependencies, not runtime service dependencies.

Local checks: lint with zero warnings, seven tests, TypeScript, production build,
and production dependency audit. The full development-tool audit still requires
separate review. A fallback-font metadata warning is non-blocking and unchanged UI
styling is preserved.

Publication stays on migration/image-publication. Main and its automatic Compose
workflow remain untouched. After successful image publication, prepare a single-
replica WebUI and gateway in a separate Kubernetes preview namespace on the larger
worker, using the existing host backend without migrations. Preserve the old Docker
front/gateway and public route. Check scheduling, images, probes, internal DNS,
network policy, host-backend health, login markup, assets and authentication redirects.
Do not claim authenticated uploads or OAuth completion without a controlled test
account. Production cutover remains gated on that evidence and explicit approval.
