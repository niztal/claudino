# claudino 🦖

**Play while Claude thinks.** `claudino` (Claude + Dino) turns the waiting time
into something fun: the orange Claude mascot — rendered as real pixel art with
half-block characters — lives in your Claude Code status line and **munches your
tokens** (drawn as coins `¢ $`) while Claude is working. Its score is your *real*
token usage and session cost.

Want a real game? `/claudino:play` opens a full, keyboard-controlled game (a
Dino-style **Coin Runner** + **Token Snake**) in a separate terminal pane.

```
 (•ᴥ•)  ¢ ¢ $ ¢ ¢ ¢ $ ¢ ¢
 belly ▓▓▓░░░░░░░ 28%   munching $0.0042 · 1,240 tok this turn
```

## How it works

Claude Code owns the terminal while it "thinks," and the only surface a plugin
can draw on during that time is the **status line** (bottom bar). It's
display-only and refreshes about once per second, so the muncher is a charming
idle pet, not an arcade game.

- **Status-line muncher** (`bin/statusline.js`): reads Claude Code's status-line
  JSON and animates the pixel-art mascot (`lib/sprite.js`) + a coin trail. Score
  = live `context_window` tokens and `cost.total_cost_usd`.
- **Hooks** (`hooks/hooks.json` → `bin/hook-state.js`): `UserPromptSubmit` marks
  "thinking", `Stop` marks "idle", so the creature runs while Claude works and
  naps when it's done. State is shared via a small per-`session_id` temp file.
- **Interactive game** (`bin/tm-game.js`): a standalone TUI with its own TTY, so
  it gets real keyboard input at full framerate. Launched into a side pane by
  `bin/tm-play.sh`.

## Install

### As a Claude Code plugin
```
/plugin marketplace add <owner>/claudino
/plugin install claudino@claudino
/claudino:setup
```
`/claudino:setup` writes the `statusLine` block into `~/.claude/settings.json`
(with a backup). The thinking/idle hooks ship with the plugin automatically.

### As a one-line CLI
```
npx claudino install      # copies scripts + wires statusLine, hooks & /play
npx claudino uninstall    # reverts (settings are backed up first)
```

Install also drops a standalone `~/.claude/commands/play.md`, so when Claude is
idle you can just type **`/play`** to open the game (it launches in a separate
pane/window, since Claude Code owns the main one). The plugin install exposes
the same thing as `/claudino:play`.

## Try it without Claude Code
```
node bin/statusline.js --demo                 # animated preview of the muncher
node bin/tm-game.js                            # play the game right here
echo '{"session_id":"t","context_window":{"total_output_tokens":1240,"used_percentage":28},"cost":{"total_cost_usd":0.0042}}' | COLUMNS=80 node bin/statusline.js
```

## Controls (game)
`arrows`/`WASD` move · `Space` jump (Coin Runner) · `Tab`/`G` switch game ·
`P` pause · `R` restart · `Q`/`Ctrl-C` quit

## Notes & limits
- The status-line animation is capped at ~1 fps (`refreshInterval` minimum).
  The full-speed experience is `/claudino:play`.
- The status line hides during permission prompts, autocomplete, and the help
  menu — the animation pauses there.
- Side-pane launching works on tmux and macOS (osascript); elsewhere the
  launcher prints the command to run in a second terminal.

MIT licensed.
