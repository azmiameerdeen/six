#!/usr/bin/env bash
# Updates Six's Electron (castlabs Widevine build) inside /opt/six-messenger.
# Run through pkexec by Six after you approve it; it needs root to replace the files and to
# set the sandbox helper's permissions.
#
#   update-electron.sh <version>   install that version (same major version as now, newer only)
#   update-electron.sh rollback    put back the previous Electron
#
# The download comes only from castlabs' GitHub releases and must match the SHA-256 that
# GitHub publishes for that file. The previous Electron is kept in .electron-previous.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

DRY=0
if [ "${1:-}" = "--dry-run" ]; then DRY=1; SIX_DIR="${SIX_DIR:?}"; shift; else SIX_DIR=/opt/six-messenger; fi
die(){ echo "update-electron: $*" >&2; exit 1; }
ELECTRON="$SIX_DIR/node_modules/electron"
DIST="$ELECTRON/dist"
PREVIOUS="$SIX_DIR/.electron-previous"
STAGE="$ELECTRON/.update-tmp"
arg="${1:-}"
[ -n "$arg" ] || die "usage: update-electron.sh <version>|rollback"
[ -f "$DIST/version" ] || die "no Electron found in $DIST"
current="$(cut -d+ -f1 "$DIST/version")"
[[ "$current" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "cannot read the current version"

if [ "$arg" = "rollback" ]; then
  [ -f "$PREVIOUS/version" ] || die "there is no previous Electron to go back to"
  if [ "$DRY" = 1 ]; then echo "would roll back $current to $(cut -d+ -f1 "$PREVIOUS/version")"; exit 0; fi
  swap="$SIX_DIR/.electron-swap"
  rm -rf "$swap"
  mv "$DIST" "$swap"; mv "$PREVIOUS" "$DIST"; mv "$swap" "$PREVIOUS"
  echo "Rolled back to $(cat "$DIST/version")"
  exit 0
fi

version="$arg"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "bad version: $version"
[ "${version%%.*}" = "${current%%.*}" ] || die "$version is a different major version than $current"
[ "$version" != "$current" ] || die "already on $current"
[ "$(printf '%s\n%s\n' "$current" "$version" | sort -V | tail -n1)" = "$version" ] || die "$version is older than $current"
if [ "$DRY" = 1 ]; then echo "would update $current to $version"; exit 0; fi

cleanup(){ rm -rf "$STAGE"; }
trap cleanup EXIT
rm -rf "$STAGE"; mkdir -p "$STAGE"

api="https://api.github.com/repos/castlabs/electron-releases/releases/tags/v${version}%2Bwvcus"
curl -fsSL --max-time 30 -H 'Accept: application/vnd.github+json' "$api" -o "$STAGE/release.json" || die "could not read the release"
set +e
info="$(python3 - "$STAGE/release.json" "$version" <<'PY'
import json, sys
r = json.load(open(sys.argv[1])); name = 'electron-v%s+wvcus-linux-x64.zip' % sys.argv[2]
if r.get('draft') or r.get('prerelease'): sys.exit(1)
for a in r.get('assets', []):
    if a.get('name') == name and str(a.get('digest', '')).startswith('sha256:'):
        print(a['browser_download_url'], a['digest'][7:]); sys.exit(0)
sys.exit(1)
PY
)"
status=$?
set -e
[ "$status" = 0 ] || die "release $version is not a stable release with a published checksum"
url="${info%% *}"; digest="${info##* }"
case "$url" in https://github.com/castlabs/electron-releases/releases/download/*) ;; *) die "unexpected download address";; esac
[[ "$digest" =~ ^[0-9a-f]{64}$ ]] || die "bad checksum from GitHub"

echo "Downloading Electron $version…"
curl -fSL --max-time 1200 "$url" -o "$STAGE/electron.zip" || die "download failed"
echo "$digest  $STAGE/electron.zip" | sha256sum -c --quiet - || die "checksum does not match, not installing"
mkdir "$STAGE/new"
unzip -q "$STAGE/electron.zip" -d "$STAGE/new" || die "could not unpack the download"
[ "$(cat "$STAGE/new/version")" = "$version+wvcus" ] || die "downloaded build reports a different version"
[ -x "$STAGE/new/electron" ] && [ -f "$STAGE/new/chrome-sandbox" ] || die "downloaded build is incomplete"
chown -R root:root "$STAGE/new"
chmod 4755 "$STAGE/new/chrome-sandbox"

rm -rf "$PREVIOUS"
mv "$DIST" "$PREVIOUS"
if ! mv "$STAGE/new" "$DIST"; then mv "$PREVIOUS" "$DIST"; die "could not put the new Electron in place"; fi
echo "Updated Electron $current to $version. The previous one is kept in $PREVIOUS (undo with: pkexec $SIX_DIR/update-electron.sh rollback)."
