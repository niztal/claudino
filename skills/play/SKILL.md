---
description: Launch the claudino game — open the playable Coin Runner token-muncher game in a separate terminal pane so the user can play while Claude works. Use when the user asks to play claudino or open the game.
disable-model-invocation: true
---

# Play claudino

Open the interactive claudino game in a separate terminal pane/window. It needs
its own TTY for real keyboard input, so it cannot run inside this session — the
launcher opens a tmux split (if inside tmux) or a new terminal window (macOS).

Run exactly this command:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/bin/tm-play.sh"
```

If `$CLAUDE_PLUGIN_ROOT` is not set, locate this plugin's `bin/tm-play.sh` and
run that absolute path instead.

Then tell the user the controls: **arrows/WASD** to move, **Space** to jump,
**P** pause, **R** restart, **Q** quit. If the launcher printed a manual command
(no tmux / non-macOS), relay it so they can start the game in their own second
terminal.
