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
sudo install -m 0755 -o root -g root update-electron.sh "$DST/update-electron.sh"  # run by Six through pkexec

# Only ever move Electron forward: Six may already have updated itself past the copy in this folder.
src_v="$(cut -d+ -f1 "$SRC/node_modules/electron/dist/version")"
dst_v="$(cut -d+ -f1 "$DST/node_modules/electron/dist/version")"
if [ "$src_v" != "$dst_v" ] && [ "$(printf '%s\n%s\n' "$dst_v" "$src_v" | sort -V | tail -n1)" = "$src_v" ]; then
  echo "Updating Electron $dst_v to $src_v…"
  sudo mv "$DST/node_modules/electron/dist" "$RB/electron-dist"
  sudo cp -a "$SRC/node_modules/electron/dist" "$DST/node_modules/electron/dist"
  sudo chown -R root:root "$DST/node_modules/electron/dist"
  sudo chmod 4755 "$DST/node_modules/electron/dist/chrome-sandbox"
elif [ "$src_v" != "$dst_v" ]; then
  echo "Keeping Electron $dst_v (newer than the $src_v in this folder)."
fi

echo "Done. Now start Six from the app menu. Rollback copy: $RB"
