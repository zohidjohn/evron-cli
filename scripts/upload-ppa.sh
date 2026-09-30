#!/usr/bin/env bash
# Upload the latest source.changes to Launchpad PPA.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist/ppa"

: "${PPA:?Set PPA — e.g. export PPA=ppa:yourname/evron}"

if ! command -v dput >/dev/null 2>&1; then
  echo "Missing dput. Install: sudo apt install -y dput"
  exit 1
fi

CHANGES="$(ls -1t "$OUT"/evron_*_source.changes 2>/dev/null | head -1 || true)"
if [[ -z "$CHANGES" ]]; then
  echo "No source.changes found in $OUT"
  echo "Run: bash scripts/build-ppa.sh"
  exit 1
fi

echo "Uploading: $CHANGES"
echo "Target:    $PPA"
dput "$PPA" "$CHANGES"
echo ""
echo "Watch the build: https://launchpad.net/~${PPA#ppa:}/+packages"
echo "After it publishes, users install with:"
echo "  sudo add-apt-repository ${PPA}"
echo "  sudo apt update"
echo "  sudo apt install evron"
