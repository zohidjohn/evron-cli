#!/usr/bin/env bash
# Build a Launchpad-ready source package under dist/ppa/
#
# Required env:
#   DEBFULLNAME   e.g. "Ada Lovelace"
#   DEBEMAIL      must match your Launchpad account email
#   PPA           e.g. ppa:ada/evron
#
# Optional:
#   PPA_SERIES    Ubuntu series in changelog (default: noble)
#   PPA_REVISION  debian revision suffix (default: 1)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing tool: $1"
    echo "Install packaging tools:"
    echo "  sudo apt update && sudo apt install -y devscripts debhelper dput rsync"
    exit 1
  fi
}

need debuild
need dpkg-parsechangelog
need rsync
need npm
need node

: "${DEBFULLNAME:?Set DEBFULLNAME — your name for the changelog signature}"
: "${DEBEMAIL:?Set DEBEMAIL — must match Launchpad + GPG key email}"
: "${PPA:?Set PPA — e.g. export PPA=ppa:yourname/evron}"

SERIES="${PPA_SERIES:-noble}"
REVISION="${PPA_REVISION:-1}"
VERSION="$(node -p "require('./package.json').version")"
DEB_VERSION="${VERSION}-${REVISION}"
STAGE="$ROOT/dist/ppa/evron-${VERSION}"
OUT="$ROOT/dist/ppa"

rm -rf "$STAGE"
mkdir -p "$STAGE"

echo "==> Staging source + production node_modules (vendored for Launchpad)"
rsync -a \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude .env \
  --exclude .env.local \
  --exclude '*.log' \
  "$ROOT/" "$STAGE/"

(
  cd "$STAGE"
  npm ci --omit=dev
)

# Patch maintainer + changelog for this upload
export DEBFULLNAME DEBEMAIL
CHANGELOG_DATE="$(date -R)"

cat > "$STAGE/debian/control" <<EOF
Source: evron
Section: utils
Priority: optional
Maintainer: ${DEBFULLNAME} <${DEBEMAIL}>
Build-Depends: debhelper-compat (= 13), rsync
Standards-Version: 4.6.2
Homepage: https://github.com/evron-recon/evron
Rules-Requires-Root: no

Package: evron
Architecture: all
Depends: nodejs (>= 18.0.0), \${misc:Depends}
Description: Passive recon terminal (EVRON)
 Full-screen Linux TUI for passive security reconnaissance against
 domains and public IPs (DNS, TLS, headers, tech fingerprints,
 subdomains, reputation, CVE mapping, and more).
 .
 Configure operators and optional API keys in /etc/evron/env after
 install. Requires Node.js 18+ (Ubuntu 24.04+ recommended).
EOF

cat > "$STAGE/debian/changelog" <<EOF
evron (${DEB_VERSION}) ${SERIES}; urgency=medium

  * PPA build ${DEB_VERSION} for ${SERIES}.

 -- ${DEBFULLNAME} <${DEBEMAIL}>  ${CHANGELOG_DATE}
EOF

chmod 755 "$STAGE/debian/rules" "$STAGE/debian/evron-wrapper"

echo "==> Building source package (debuild -S)"
mkdir -p "$OUT"
(
  cd "$STAGE"
  # -S source only, -d skip build-dep check on this machine if needed,
  # -sa include orig if any, -us -uc unsigned first (we sign explicitly)
  if gpg --list-secret-keys --with-colons "$DEBEMAIL" 2>/dev/null | grep -q '^sec:'; then
    debuild -S -sa -d
  else
    echo "WARNING: No GPG secret key found for $DEBEMAIL"
    echo "Building unsigned; Launchpad will reject until you sign."
    debuild -S -sa -d -us -uc
  fi
)

CHANGES="$(ls -1 "$OUT"/evron_${DEB_VERSION}_source.changes 2>/dev/null | head -1 || true)"
# debuild writes artifacts next to the staging dir's parent
CHANGES="$(ls -1 "$ROOT/dist/ppa"/evron_${DEB_VERSION}_source.changes 2>/dev/null | head -1 || true)"
if [[ -z "${CHANGES}" ]]; then
  CHANGES="$(ls -1 "$ROOT/dist/ppa"/evron_*_source.changes 2>/dev/null | tail -1 || true)"
fi

echo ""
echo "Source package ready under: $OUT"
ls -la "$OUT"/evron_* 2>/dev/null || true
echo ""
echo "Upload with:"
echo "  export PPA=$PPA"
echo "  bash scripts/upload-ppa.sh"
echo ""
echo "Or manually:"
echo "  dput $PPA $OUT/evron_${DEB_VERSION}_source.changes"
