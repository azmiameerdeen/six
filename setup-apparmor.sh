#!/usr/bin/env bash
# One-time setup, run with sudo from your normal account:  sudo ./setup-apparmor.sh
#
# Ubuntu blocks the "user namespace" feature that Chromium's sandbox needs, for any program that has no
# AppArmor profile. This adds a small profile (the same kind Ubuntu ships for Discord, Chrome and Brave)
# that only allows that feature for Six's Electron in ~/.local/share/six/electron/<version>/electron.
# It does not confine or restrict anything else. With it, Six can update Electron by itself, because the
# root-owned sandbox helper in /opt is no longer needed.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run this with sudo: sudo $0" >&2; exit 1; }
USER_NAME="${SUDO_USER:-}"
[ -n "$USER_NAME" ] && [ "$USER_NAME" != root ] || { echo "Run it with sudo from your normal account, not as root." >&2; exit 1; }
HOME_DIR="$(getent passwd "$USER_NAME" | cut -d: -f6)"
[[ "$HOME_DIR" =~ ^/[A-Za-z0-9._/-]+$ ]] || { echo "Unexpected home folder: $HOME_DIR" >&2; exit 1; }
ABI=4.0; [ -f /etc/apparmor.d/abi/5.0 ] && ABI=5.0
PROFILE=/etc/apparmor.d/six-electron

cat > "$PROFILE" <<EOF
# Lets Six's Electron use user namespaces for Chromium's sandbox. It gives the app a name
# instead of the label "unconfined" and restricts nothing else.
abi <abi/$ABI>,
include <tunables/global>

profile six-electron $HOME_DIR/.local/share/six/electron/*/electron flags=(unconfined) {
  userns,
  @{exec_path} mr,

  # Site-specific additions and overrides. See local/README for details.
  include if exists <local/six-electron>
}
EOF
chmod 644 "$PROFILE"
apparmor_parser -r "$PROFILE"
echo "Loaded $PROFILE"

# Self-test: a copy of 'unshare' placed where Six's Electron will live gets the profile; one elsewhere does not.
# Everything is created as your own user so no root-owned folders appear in your home.
as_user(){ runuser -u "$USER_NAME" -- "$@"; }
INSIDE="$HOME_DIR/.local/share/six/electron/0.0.0-test"
OUTSIDE="$(as_user mktemp -d)"
cleanup(){ rm -rf "$INSIDE" "$OUTSIDE"; }
trap cleanup EXIT
as_user mkdir -p "$INSIDE"
as_user cp /usr/bin/unshare "$INSIDE/electron"
as_user cp /usr/bin/unshare "$OUTSIDE/other"
try(){ as_user "$1" -Urm true >/dev/null 2>&1 && echo yes || echo no; }
inside="$(try "$INSIDE/electron")"
outside="$(try "$OUTSIDE/other")"
echo "Test: allowed for Six's folder: $inside   (a program elsewhere: $outside)"
if [ "$inside" = yes ]; then echo "OK. Next, as your normal user without sudo: ./install-user.sh --switch"
else echo "The rule did not take effect. Do not switch yet; tell Claude what is shown above." >&2; exit 1; fi
