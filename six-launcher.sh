#!/usr/bin/env bash
# Starts Six from the user install (~/.local/share/six) and looks after Electron updates:
#   - a staged update (electron/pending) is switched in at start-up;
#   - if that new Electron crashes before Six has confirmed it is healthy, the previous one is
#     put back and started instead, and the bad version is remembered so it is not tried again.
# Layout:  electron/<version>/   one folder per Electron build
#          electron/current      link to the build in use        electron/previous   name of the one before
#          electron/pending      name of a staged build          electron/trial      build still being proven
#          electron/bad          versions that failed to start   app/                Six's own files
set -u
BASE="${SIX_HOME:-$HOME/.local/share/six}"
EL="$BASE/electron"
APP="$BASE/app"
log(){ echo "six: $*" >&2; }
valid(){ [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; }
set_current(){ ln -sfn "$1" "$EL/.current.new" && mv -T "$EL/.current.new" "$EL/current"; }

# Switch in a staged update.
if [ -f "$EL/pending" ]; then
  new="$(cat "$EL/pending")"; rm -f "$EL/pending"
  if valid "$new" && [ -x "$EL/$new/electron" ]; then
    old="$(readlink "$EL/current" 2>/dev/null || true)"
    if [ "$old" != "$new" ]; then
      [ -n "$old" ] && echo "$old" > "$EL/previous"
      set_current "$new" && echo "$new" > "$EL/trial" && log "using Electron $new"
    fi
  fi
fi

[ -x "$EL/current/electron" ] || { log "no Electron found in $EL"; exit 1; }

run(){
  "$EL/current/electron" "$APP" "$@" &
  local child=$!
  trap 'kill -TERM "$child" 2>/dev/null' TERM INT HUP
  wait "$child"; local code=$?
  while kill -0 "$child" 2>/dev/null; do wait "$child"; code=$?; done   # a signal ends wait early
  trap - TERM INT HUP
  return "$code"
}

run "$@"; code=$?

# A build that was still on trial and did not exit cleanly is rolled back.
if [ -f "$EL/trial" ] && [ "$code" -ne 0 ]; then
  bad="$(cat "$EL/trial")"; rm -f "$EL/trial"
  prev="$(cat "$EL/previous" 2>/dev/null || true)"
  if valid "$bad"; then echo "$bad" >> "$EL/bad"; fi
  if valid "$prev" && [ -x "$EL/$prev/electron" ]; then
    log "Electron $bad did not start properly; going back to $prev"
    set_current "$prev"
    run "$@"; code=$?
  fi
fi
exit "$code"
