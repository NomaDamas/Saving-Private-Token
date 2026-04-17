#!/usr/bin/env bash
# Stop hook: after Claude finishes a response, arm a cache-keepalive ping.
# No-op unless SPT_ENABLED=1 and we're inside tmux.
set -u

[ "${SPT_ENABLED:-0}" = "1" ] || exit 0
[ -n "${TMUX:-}" ] || exit 0
command -v spt >/dev/null 2>&1 || exit 0

payload=$(cat)
sid=$(printf '%s' "$payload" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(String(JSON.parse(d).session_id||""))}catch{}})')
[ -n "$sid" ] || exit 0

pane="${TMUX_PANE:-}"
nohup spt schedule "$sid" --pane "$pane" >/dev/null 2>&1 &
disown 2>/dev/null || true
exit 0
