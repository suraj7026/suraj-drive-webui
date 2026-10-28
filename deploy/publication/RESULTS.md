# Publication verification — 2026-10-28

Branch: `migration/image-publication`; latest tested source
`497fc28` (see GitHub run for the full SHA). No production files or application
components were modified. This is a failed publication, not a migration.

Latest run: https://github.com/suraj7026/suraj-drive-webui/actions/runs/40710986900
Initial run: https://github.com/suraj7026/suraj-drive-webui/actions/runs/40708665003

Both failed at `npm run lint`, with three existing react-hooks/set-state-in-effect
errors and two existing warnings:

- components/archive/delete-dialog.tsx:22
- components/archive/new-folder-dialog.tsx:20
- components/shell/theme-toggle.tsx:17

These application files are identical to main. No lint rule was disabled, no
continue-on-error was added, and the publication gate remains intact. Fixing these
requires a focused application change with UI-state regression tests, not a
pipeline bypass. Both frontend and gateway publication were skipped.

The isolated network HTTP test harness was corrected using findings from the
Portfolio run: probes run inside the internal network instead of relying on host
port publication. Its WebUI runtime tests are still unexecuted because lint fails
before build. Do not claim this candidate image is validated or published.

SSH checks showed the existing frontend/gateway image IDs and start times unchanged;
public Drive login returned 200. Existing backend readiness still returns 401.
Production deployment workflow did not run; its latest run remains 35459377795
from 2026-09-19. No Kubernetes resources, routes, containers or credentials changed.
The user's local worktree was left untouched; this branch was built in an isolated
checkout from GitHub main rather than the newer local development worktree.
