#!/usr/bin/env bash
# Open the claudino game in a SEPARATE terminal pane/window, so it gets its own
# TTY (real keyboard + full framerate). Auto-detects the environment.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GAME="$DIR/tm-game.js"
NODE="$(command -v node || true)"

if [ -z "$NODE" ]; then
  echo "claudino: Node.js not found on PATH. Install Node, then run: node \"$GAME\"" >&2
  exit 1
fi

# 1) Inside tmux -> split a pane.
if [ -n "${TMUX:-}" ]; then
  tmux split-window -h "'$NODE' '$GAME'"
  echo "claudino: launched in a new tmux pane. Have fun while Claude thinks!"
  exit 0
fi

# 2) macOS -> open a new Terminal/iTerm window.
# NOTE: a new login shell may print a prompt at startup (e.g. zsh's compinit
# "insecure directories" question). We send an empty line FIRST so that prompt
# is answered with its default before the real command is typed — otherwise the
# prompt eats the command's first character and breaks the quoting.
if [ "$(uname)" = "Darwin" ] && command -v osascript >/dev/null 2>&1; then
  if [ "${TERM_PROGRAM:-}" = "iTerm.app" ]; then
    osascript >/dev/null <<OSA
tell application "iTerm"
  create window with default profile
  tell current session of current window
    write text ""
    write text "exec env CLAUDINO_TERM=iTerm '$NODE' '$GAME'"
  end tell
end tell
OSA
  else
    osascript >/dev/null <<OSA
tell application "Terminal"
  activate
  do script (return & "exec env CLAUDINO_TERM=Terminal '$NODE' '$GAME'")
end tell
OSA
  fi
  echo "claudino: launched in a new terminal window. Have fun while Claude thinks!"
  exit 0
fi

# 3) Fallback: tell the user how to start it themselves.
echo "claudino: open a second terminal and run:"
echo "  node \"$GAME\""
exit 0
