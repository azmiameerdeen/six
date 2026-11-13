#!/usr/bin/env bash
# Installs the app files from this source folder into /opt/six-messenger, keeping a rollback copy.
# Run as your normal user (not with sudo); it asks for your password. Start Six from the app menu afterwards.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
DST=/opt/six-messenger
RB="$DST/.rollback-$(date +%Y%m%d-%H%M%S)"

sudo -v  # ask for the password before stopping anything

echo "Stopping Six…"
pkill -f "electron.*/opt/six-messenger" || true
sleep 2

echo "Saving rollback copy to $RB"
sudo mkdir -p "$RB"
sudo cp -a "$DST"/*.js "$DST"/*.html "$DST"/*.css "$DST"/*.json "$DST"/README.md "$DST"/icons "$RB"/
sudo cp -a "$DST"/*.txt "$RB"/ 2>/dev/null || true

echo "Copying app files…"
cd "$SRC"
for f in *.js *.html *.css *.txt package.json README.md; do
  case "$f" in *.test.js|main-smoke.js|smoke-snippet.txt) continue;; esac
  sudo install -m 0644 "$f" "$DST/$f"
done
sudo install -m 0644 icons/* "$DST/icons/"

if ! cmp -s "$SRC/node_modules/electron/dist/version" "$DST/node_modules/electron/dist/version"; then
  echo "Updating Electron to $(cat "$SRC/node_modules/electron/dist/version")…"
  sudo mv "$DST/node_modules/electron/dist" "$RB/electron-dist"
  sudo cp -a "$SRC/node_modules/electron/dist" "$DST/node_modules/electron/dist"
  sudo chown -R root:root "$DST/node_modules/electron/dist"
  sudo chmod 4755 "$DST/node_modules/electron/dist/chrome-sandbox"
fi

echo "Done. Now start Six from the app menu. Rollback copy: $RB"
