#!/usr/bin/env bash
# Install EVRON from this repo onto the machine (no Launchpad / apt repo).
# Usage:
#   bash scripts/install.sh
#   curl -fsSL https://raw.githubusercontent.com/OWNER/Evron/main/scripts/install.sh | bash
set -euo pipefail

PREFIX="${PREFIX:-/usr/local}"
NEED_SUDO=0
if [[ ! -w "$PREFIX" ]]; then
  NEED_SUDO=1
fi

run() {
  if [[ "$NEED_SUDO" -eq 1 ]]; then
    sudo "$@"
  else
    "$@"
  fi
}

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ is required. Install it first, e.g.:"
  echo "  sudo apt install -y nodejs npm"
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "Node.js 18+ required (found $(node -v))"
  exit 1
fi

# Resolve repo root: script location, or clone into a temp dir if piped
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
else
  ROOT="$(mktemp -d /tmp/evron-install.XXXXXX)"
  CLEANUP_ROOT=1
  EVRON_GIT_URL="${EVRON_GIT_URL:-https://github.com/zohidjohn/evron-cli.git}"
  command -v git >/dev/null || { echo "git is required"; exit 1; }
  git clone --depth 1 "$EVRON_GIT_URL" "$ROOT"
fi

cd "$ROOT"
echo "==> Installing dependencies"
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

LIBDIR="$PREFIX/lib/evron"
BINDIR="$PREFIX/bin"
ETCDIR="/etc/evron"

echo "==> Installing to $LIBDIR"
run mkdir -p "$LIBDIR" "$BINDIR"
if [[ "$NEED_SUDO" -eq 1 ]]; then
  run rsync -a --delete \
    --exclude .git \
    --exclude dist \
    --exclude .env \
    --exclude .env.local \
    "$ROOT/" "$LIBDIR/"
else
  rsync -a --delete \
    --exclude .git \
    --exclude dist \
    --exclude .env \
    --exclude .env.local \
    "$ROOT/" "$LIBDIR/"
fi

run tee "$BINDIR/evron" >/dev/null <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [[ -f /etc/evron/env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/evron/env
  set +a
fi
exec /usr/bin/env node "$LIBDIR/bin/evron.js" "\$@"
EOF
run chmod 755 "$BINDIR/evron" "$LIBDIR/bin/evron.js"

if [[ ! -f "$ETCDIR/env" ]]; then
  run mkdir -p "$ETCDIR"
  if [[ -f "$ROOT/.env.example" ]]; then
    run cp "$ROOT/.env.example" "$ETCDIR/env"
  else
    echo '# EVRON_OPERATORS=alice:pass' | run tee "$ETCDIR/env" >/dev/null
  fi
fi

if [[ "${CLEANUP_ROOT:-0}" -eq 1 ]]; then
  rm -rf "$ROOT"
fi

echo ""
echo "Installed. Run:  evron"
echo "Config:          $ETCDIR/env"
echo "Binary:          $BINDIR/evron"
