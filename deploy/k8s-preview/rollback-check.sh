#!/usr/bin/env bash
set -Eeuo pipefail
# The historical preview drill is retained in Git history, before default cutover.
echo 'Refusing fault injection: drive-web-preview now serves production traffic.' >&2
echo 'For routing rollback, inspect deploy/default-route/rollback.sh instead.' >&2
exit 1
