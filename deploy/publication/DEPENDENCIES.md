# Dependency remediation — 2026-10-28

Following approval to continue validation/cutover preparation, the remaining five
npm findings were resolved by targeted updates within existing dependency ranges:

| Package | Previous | Patched |
| --- | --- | --- |
| @babel/core | 7.29.0 | 7.29.7 |
| brace-expansion (root) | 1.1.14 | 1.1.21 |
| brace-expansion (typescript-estree) | 5.0.5 | 5.0.12 |
| browserslist | 4.28.2 | 4.29.5 |
| js-yaml | 4.1.1 | 4.3.2 |
| zod | 4.3.6 | 4.6.7 |

Their transitive dependencies were refreshed as required (25 package versions total).
All changes are development dependencies except shared caniuse-lite compatibility
data, updated from 1.0.30001788 to 1.0.30001819. package.json is unchanged; no forced
major upgrades, overrides or audit suppressions were used.

Clean npm ci, zero-warning lint, seven component tests, TypeScript and the full
npm audit all passed locally. The audit now reports zero findings across production
**and development** dependencies; this does not certify the whole container/OS
supply chain. Publication now enforces the full audit at low severity and above,
rather than checking only high/critical runtime dependencies.

A new publication and digest-pinned private-preview rollout are required before
this remediation can be considered deployed. Existing 36062af publication and
rollback evidence remain historical records for the prior candidate.

Public cutover still requires controlled signed-in validation and privileged
Cloudflare configuration/restart access. Do not infer completed authentication
from the unauthenticated smoke tests. Never collect passwords/session cookies in
chat, reuse arbitrary browser sessions, or bypass authentication to manufacture
passing test results.
