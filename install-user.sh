#!/usr/bin/env bash
# Installs Six for your own user, with no sudo, so it can update its own Electron.
#   ./install-user.sh            copy Six, Electron and the launcher into ~/.local (menu and autostart unchanged)
#   ./install-user.sh --switch   also point the app-menu and autostart entries at the new launcher
#   ./install-user.sh --revert   point them back at the /opt copy
# Needs the one-time AppArmor rule first:  sudo ./setup-apparmor.sh
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
BASE="$HOME/.local/share/six"
EL="$BASE/electron"
BIN="$HOME/.local/bin"
MENU="$HOME/.local/share/applications/six-messenger.desktop"
AUTO="$HOME/.config/autostart/six-messenger.desktop"
OPT_EXEC="/opt/six-messenger/node_modules/electron/dist/electron /opt/six-messenger"
mode="${1:-}"

point_entries(){  # $1 = exec for the menu entry, $2 = icon
  for f in "$MENU" "$AUTO"; do
    [ -f "$f" ] || continue
    [ -f "$f.opt-backup" ] || cp -p "$f" "$f.opt-backup"
    extra=""; [ "$f" = "$AUTO" ] && extra=" --start-hidden"
    sed -i -E "s|^Exec=.*|Exec=$1$extra|; s|^Icon=.*|Icon=$2|" "$f"
  done
}

if [ "$mode" = "--revert" ]; then
  for f in "$MENU" "$AUTO"; do [ -f "$f.opt-backup" ] && cp -p "$f.opt-backup" "$f" && echo "Restored $f"; done
  echo "Menu and autostart now start the /opt copy again."; exit 0
fi

[ -f /etc/apparmor.d/six-electron ] || [ -n "${SIX_SKIP_APPARMOR_CHECK:-}" ] || { echo "Run the one-time AppArmor setup first:  sudo $SRC/setup-apparmor.sh" >&2; exit 1; }
[ -x "$SRC/node_modules/electron/dist/electron" ] || { echo "No Electron in $SRC/node_modules/electron/dist" >&2; exit 1; }

echo "Copying Six's files…"
NEW="$BASE/.app-new"
rm -rf "$NEW"; mkdir -p "$NEW/icons" "$EL" "$BIN"
cd "$SRC"
for f in *.js *.html *.css *.txt package.json icon.png README.md; do
  case "$f" in *.test.js|main-smoke.js|smoke-snippet.txt) continue;; esac
  [ -f "$f" ] && cp "$f" "$NEW/$f"
done
cp icons/* "$NEW/icons/"
rm -rf "$BASE/.app-old"; [ -d "$BASE/app" ] && mv "$BASE/app" "$BASE/.app-old"
mv "$NEW" "$BASE/app"; rm -rf "$BASE/.app-old"

# Electron: only ever move forward (Six may already have updated itself past this folder's copy).
src_v="$(cut -d+ -f1 "$SRC/node_modules/electron/dist/version")"
cur_v="$(readlink "$EL/current" 2>/dev/null || true)"
if [ ! -x "$EL/$src_v/electron" ]; then
  echo "Copying Electron $src_v…"
  cp -a "$SRC/node_modules/electron/dist" "$EL/.copy-$src_v" && mv "$EL/.copy-$src_v" "$EL/$src_v"
fi
if [ -z "$cur_v" ] || { [ "$cur_v" != "$src_v" ] && [ "$(printf '%s\n%s\n' "$cur_v" "$src_v" | sort -V | tail -n1)" = "$src_v" ]; }; then
  [ -n "$cur_v" ] && echo "$cur_v" > "$EL/previous"
  ln -sfn "$src_v" "$EL/.current.new" && mv -T "$EL/.current.new" "$EL/current"
fi

install -m 0755 "$SRC/six-launcher.sh" "$BIN/six"
echo "Installed: $BIN/six (Electron $(readlink "$EL/current"))"

if [ "$mode" = "--switch" ]; then
  point_entries "$BIN/six" "$BASE/app/icon.png"
  echo "The app menu and autostart entries now start the new Six. Start it from the app menu."
  echo "To go back to the /opt copy: $SRC/install-user.sh --revert"
else
  echo "Menu and autostart are unchanged. Run with --switch to use the new install."
fi
