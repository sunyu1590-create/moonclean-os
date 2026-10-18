#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

source .devcontainer/cloud-config.sh

if curl --silent --fail --max-time 2 http://127.0.0.1:3000 >/dev/null; then
  exit 0
fi

nohup npm run dev -- --hostname 0.0.0.0 > /tmp/moonclean-next.log 2>&1 < /dev/null &
