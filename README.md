# claudino 🦖

**Play while Claude thinks.** `claudino` (Claude + Dino) turns the waiting time
into something fun: the orange Claude creature — drawn with real block-art
glyphs — lives in your Claude Code status line and **munches your tokens**
(gold coins `●`, with a fat `◆` every fifth) while Claude is working. Below it,
two live gauges show your *real* usage: **Context** (this chat's context
window) and **Limit** (whichever of your 5-hour / 7-day usage allowances is
closer to its cap, with its reset time).

Want a real game? `/claudino:play` opens a full, keyboard-controlled game (a
Dino-style **Coin Runner** + **Token Snake**) in a separate terminal pane.
While you play, the HUD shows when Claude is thinking — and flashes
`★ Claude is done — your turn!` the moment it finishes, so you never miss it.

While Claude is thinking, the creature walks and the coin trail scrolls toward
it:

```
 ▐▛███▜▌   ◆ ● ● ● ● ◆ ● ● ● ● ◆ ● ● ●  ↓ 1.2k tok this session · Opus 4.8
▝▜█████▛▘  Context  ▓▓▓░░░░░░░ 28%
  ▘▘ ▝▝    Limit·5h ▓▓▓▓▓▓░░░░ 62% · resets 2h 11m
```

When Claude is done, it naps:

```
 ▐▛███▜▌   z z z   Claude is napping…   ↓ 1.2k tok this session · Opus 4.8
▝▜█████▛▘  Context  ▓▓▓░░░░░░░ 28%
  ▘▘ ▝▝    Limit·5h ▓▓▓▓▓▓░░░░ 62% · resets 2h 11m
```

Both bars fill up as you consume them and shift green → yellow → red near the
cap; while thinking, a gold pulse travels through the Limit bar. The Limit row
tracks both rolling windows Claude Code reports (5-hour and 7-day) and shows
whichever is more constrained — `Limit·5h` or `Limit·7d`. The `↓ tok`
odometer is the session's cumulative output tokens, summed live from the
transcript, and the trailing `· Opus 4.8` is the model Claude is currently
running as. On API-key billing (no rate-limit data) the Limit row shows your
estimated session cost instead, e.g. `Cost  ~$0.42 session (est.)`.

## How it works

Claude Code owns the terminal while it "thinks," and the only surface a plugin
can draw on during that time is the **status line** (bottom bar). It's
display-only and refreshes about once per second, so the muncher is a charming
idle pet, not an arcade game.

- **Status-line muncher** (`bin/statusline.js`): reads Claude Code's status-line
  JSON and animates the block-art creature (`lib/claude.js`) + a coin trail.
  The gauges are real data: `context_window.used_percentage` (Context),
  `rate_limits.five_hour` / `seven_day` (Limit + reset countdown), and the
  token odometer is summed incrementally from the session transcript.
- **Hooks** (`hooks/hooks.json` → `bin/hook-state.js`): `UserPromptSubmit` marks
  "thinking", `Stop` marks "idle", so the creature runs while Claude works and
  naps when it's done. State is shared via a small per-`session_id` temp file.
- **Interactive game** (`bin/tm-game.js`): a standalone TUI with its own TTY, so
  it gets real keyboard input at full framerate. Launched into a side pane by
  `bin/tm-play.sh`. It watches the same shared state, so the HUD flashes a
  "your turn" banner when Claude finishes thinking in any session.

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
echo '{"session_id":"t","context_window":{"total_output_tokens":1240,"used_percentage":28},"cost":{"total_cost_usd":0.0042},"rate_limits":{"five_hour":{"used_percentage":62,"resets_at":'$(($(date +%s)+7200))'}}}' | COLUMNS=80 node bin/statusline.js
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
