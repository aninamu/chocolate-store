#!/usr/bin/env bash
# Stops all project processes and removes ./.data
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

"$ROOT/scripts/stop.sh" || true
rm -rf .data
echo "nuke: removed .data/"
