#!/usr/bin/env bash
# Start `next dev` in the background, wired to the LOCAL Supabase stack
# (supabase/ under the unit) instead of the hosted project in .env.local.
# process.env beats .env files in Next, so .env.local is left untouched and
# OPENAI_API_KEY is still read from it.
#
#   bash .claude/skills/run-smartcallai/dev-local.sh          # start (port 3100)
#   bash .claude/skills/run-smartcallai/dev-local.sh stop     # stop dev server
#   PORT=3200 bash .../dev-local.sh
#   HOSTED=1 bash .../dev-local.sh   # skip the override, use .env.local as-is
set -euo pipefail
cd "$(dirname "$0")/../../.."
PORT="${PORT:-3100}"
LOG="${TMPDIR:-${TEMP:-/tmp}}/smartcallai-dev.log"
ENVFILE="${TMPDIR:-${TEMP:-/tmp}}/smartcallai-dev.env"
SUPABASE="npx -y supabase@2.117.0"   # config.toml needs >= 2.117 ([local_smtp] key)

listener_pid() {
  # netstat works in Git Bash on Windows; lsof on Linux/macOS.
  if command -v lsof >/dev/null; then lsof -ti:"$PORT" -sTCP:LISTEN || true
  else netstat -ano | awk -v p=":$PORT" '$2 ~ p"$" && $4 == "LISTENING" {print $5; exit}'; fi
}

kill_pid() {
  if command -v taskkill >/dev/null; then taskkill //F //T //PID "$1" >/dev/null; else kill "$1"; fi
}

if [ "${1:-}" = stop ]; then
  pid=$(listener_pid); [ -n "$pid" ] && kill_pid "$pid" && echo "stopped pid $pid on :$PORT" || echo "nothing on :$PORT"
  exit 0
fi

if [ -n "$(listener_pid)" ]; then echo "port $PORT already in use (pid $(listener_pid)) - stop it or set PORT"; exit 1; fi

if [ -z "${HOSTED:-}" ]; then
  eval "$($SUPABASE status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SERVICE_ROLE_KEY)=')" \
    || { echo "local supabase not running - run: $SUPABASE start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,storage-api,postgres-meta,mailpit"; exit 1; }
  export SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_URL="$API_URL"
  export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY"
  echo "supabase: $SUPABASE_URL (local)"
  # driver.mjs reads this so its agent-release step hits the same DB as the server.
  printf 'SUPABASE_URL=%s\nSUPABASE_SERVICE_ROLE_KEY=%s\n' "$SUPABASE_URL" "$SUPABASE_SERVICE_ROLE_KEY" >"$ENVFILE"
else
  rm -f "$ENVFILE"
fi

# Phone agent webhook secrets (scripts/voice-sim.mjs uses the same defaults).
# Only when .env.local doesn't set a real one (an exported var would override it).
grep -qE '^VOICE_WEBHOOK_TOKEN=.+' .env.local 2>/dev/null || export VOICE_WEBHOOK_TOKEN="${VOICE_WEBHOOK_TOKEN:-local-dev-token}"
grep -qE '^TWILIO_AUTH_TOKEN=.+' .env.local 2>/dev/null || export TWILIO_AUTH_TOKEN="${TWILIO_AUTH_TOKEN:-local-dev-twilio-token}"

nohup npx next dev -p "$PORT" >"$LOG" 2>&1 &
for _ in $(seq 1 90); do curl -sf -o /dev/null "http://localhost:$PORT/" && break; sleep 1; done
curl -sf -o /dev/null "http://localhost:$PORT/" || { echo "dev server did not come up; see $LOG"; tail -20 "$LOG"; exit 1; }
echo "ready: http://localhost:$PORT  (log: $LOG)"
