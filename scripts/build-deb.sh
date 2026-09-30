#!/usr/bin/env bash
# Build a Debian package: dist/evron_<version>_all.deb
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
ARCH="all"
PKG_NAME="evron"
DEB_DIR="$ROOT/dist/deb/${PKG_NAME}_${VERSION}_${ARCH}"
OUT_DIR="$ROOT/dist"

rm -rf "$DEB_DIR"
mkdir -p \
  "$DEB_DIR/DEBIAN" \
  "$DEB_DIR/usr/bin" \
  "$DEB_DIR/usr/lib/evron" \
  "$DEB_DIR/etc/evron" \
  "$DEB_DIR/usr/share/doc/evron"

# Stage app (no .git, no local secrets, no dist)
rsync -a \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude .env \
  --exclude .env.local \
  --exclude '*.log' \
  "$ROOT/" "$DEB_DIR/usr/lib/evron/"

# Production node_modules inside the package
(
  cd "$DEB_DIR/usr/lib/evron"
  npm ci --omit=dev
)

# Shared config template (operators / API keys)
if [[ -f "$ROOT/.env.example" ]]; then
  cp "$ROOT/.env.example" "$DEB_DIR/etc/evron/env"
else
  cat > "$DEB_DIR/etc/evron/env" <<'EOF'
# EVRON system config — copy keys here after install
# EVRON_OPERATORS=alice:pass1,bob:pass2
EOF
fi

cat > "$DEB_DIR/usr/bin/evron" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
# Load system env if present (does not override already-exported vars)
if [[ -f /etc/evron/env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /etc/evron/env
  set +a
fi
exec /usr/bin/env node /usr/lib/evron/bin/evron.js "$@"
EOF
chmod 755 "$DEB_DIR/usr/bin/evron"
chmod 755 "$DEB_DIR/usr/lib/evron/bin/evron.js"

SIZE_KB="$(du -sk "$DEB_DIR/usr" | awk '{print $1}')"

cat > "$DEB_DIR/DEBIAN/control" <<EOF
Package: ${PKG_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Maintainer: EVRON Maintainers <evron@localhost>
Depends: nodejs (>= 18.0.0)
Installed-Size: ${SIZE_KB}
Homepage: https://github.com/evron-recon/evron
Description: Passive recon terminal (EVRON)
 Full-screen Linux TUI for passive security reconnaissance
 against domains and public IPs (DNS, TLS, headers, tech,
 subdomains, reputation, CVE mapping, and more).
EOF

cat > "$DEB_DIR/DEBIAN/conffiles" <<EOF
/etc/evron/env
EOF

cat > "$DEB_DIR/usr/share/doc/evron/copyright" <<EOF
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: evron
Source: local

Files: *
Copyright: EVRON contributors
License: proprietary
EOF

gzip -9n -c "$ROOT/README.md" > "$DEB_DIR/usr/share/doc/evron/README.gz" 2>/dev/null || true

mkdir -p "$OUT_DIR"
DEB_PATH="$OUT_DIR/${PKG_NAME}_${VERSION}_${ARCH}.deb"
dpkg-deb --root-owner-group --build "$DEB_DIR" "$DEB_PATH"

echo ""
echo "Built: $DEB_PATH"
echo "Install locally:"
echo "  sudo apt install ./dist/${PKG_NAME}_${VERSION}_${ARCH}.deb"
echo ""
echo "Or:"
echo "  sudo dpkg -i $DEB_PATH && sudo apt-get install -f"
