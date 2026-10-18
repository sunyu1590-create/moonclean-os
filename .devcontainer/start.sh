#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if curl --silent --fail --max-time 2 http://127.0.0.1:3000 >/dev/null; then
  exit 0
fi

if [[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" && -n "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  nohup npm run dev -- --hostname 0.0.0.0 > /tmp/moonclean-next.log 2>&1 < /dev/null &
else
  nohup env NEXT_PUBLIC_DATA_MODE=local npm run dev -- --hostname 0.0.0.0 > /tmp/moonclean-next.log 2>&1 < /dev/null &
fi
