#!/usr/bin/env bash
# SessionStart hook: sweep stale state entries (dead schedulers or vanished panes).
set -u

command -v spt >/dev/null 2>&1 || exit 0

# Delegate cleanup to the CLI — it knows the state layout.
# Non-blocking; no output.
spt doctor --sweep >/dev/null 2>&1 &
disown 2>/dev/null || true
exit 0
