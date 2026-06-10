#!/usr/bin/env node
'use strict';
// Layer 2 — the playable game. Runs in its own terminal (its own TTY), so it
// gets real keyboard input and full framerate, unlike the status line.
//
// Controls:  arrows / WASD move · Space jump (runner) · P pause · R restart
//            Tab or G switch game · Q or Ctrl-C quit

const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('../lib/render');

const GAMES = [
  require('../lib/games/runner'),
  require('../lib/games/snake'),
];

const FRAME_MS = 60;
const HUD_ROWS = 2; // title line + secondary line
const SYNC_ON = '\x1b[?2026h';  // begin synchronized update (kills flicker/tearing)
const SYNC_OFF = '\x1b[?2026l'; // end synchronized update

const out = process.stdout;
let gameIndex = 0;
let game = null;
let paused = false;
let timer = null;

// Persisted high score, per game.
const HI_FILE = path.join(os.tmpdir(), 'claudino', 'hiscore.json');
let hi = (() => { try { return JSON.parse(fs.readFileSync(HI_FILE, 'utf8')); } catch { return {}; } })();
const best = () => hi[game.title] || 0;
function recordBest() {
  if ((game.score || 0) > best()) {
    hi[game.title] = game.score;
    try { fs.mkdirSync(path.dirname(HI_FILE), { recursive: true }); fs.writeFileSync(HI_FILE, JSON.stringify(hi)); } catch {}
  }
}

// Visible length (ANSI stripped) for right-aligning the score.
const vlen = (s) => s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').length;
function spread(left, right, cols) {
  const gap = Math.max(2, cols - vlen(left) - vlen(right));
  return left + ' '.repeat(gap) + right;
}

function dims() {
  const cols = out.columns || 80;
  const rows = out.rows || 24;
  return { cols, rows: Math.max(8, rows - HUD_ROWS - 1) };
}

function newGame(idx) {
  const { cols, rows } = dims();
  const Game = GAMES[idx];
  game = new Game(cols, rows);
}

function enter() {
  out.write('\x1b[?1049h'); // alt screen
  out.write('\x1b[?25l');   // hide cursor
  out.write('\x1b[2J');
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
}

// When launched by tm-play.sh into its own macOS Terminal/iTerm window, close
// that window on quit. Matched by TTY (so it's the right window) and delayed a
// beat (via AppleScript `delay`) so the window has no running process by then
// and closes without a prompt. tmux panes already auto-close on command exit.
function closeOwnWindow() {
  const term = process.env.CLAUDINO_TERM;
  if (process.platform !== 'darwin' || !term) return;
  const cp = require('child_process');
  let tty;
  try { tty = cp.execSync('ps -o tty= -p ' + process.pid, { encoding: 'utf8' }).trim(); } catch { return; }
  if (!tty || tty.indexOf('?') !== -1) return;
  const dev = '/dev/' + tty;
  const script = term === 'iTerm'
    ? `delay 0.4
tell application "iTerm"
  repeat with w in windows
    repeat with t in tabs of w
      repeat with s in sessions of t
        if (tty of s) is "${dev}" then close w
      end repeat
    end repeat
  end repeat
end tell`
    : `delay 0.4
tell application "Terminal"
  repeat with w in windows
    repeat with t in tabs of w
      if (tty of t) is "${dev}" then close w saving no
    end repeat
  end repeat
end tell`;
  try {
    cp.spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' }).unref();
  } catch { /* ignore */ }
}

function leave() {
  if (timer) clearInterval(timer);
  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode(false); } catch (e) {}
  }
  out.write('\x1b[?25h');   // show cursor
  out.write('\x1b[?1049l'); // restore screen
  closeOwnWindow();
  process.exit(0);
}

function draw() {
  const { cols } = dims();
  const lines = game.draw();
  let buf = SYNC_ON + '\x1b[H';

  // title row: name on the left, live token counter + high score pinned right
  const left =
    R.bold(R.orange(' claudino ')) + R.gray('· ') + R.bold(game.title) +
    (paused ? R.red('  [PAUSED]') : '');
  const right =
    R.coin(true) + ' ' + R.bold(R.gold('TOKENS ' + R.thousands(game.score || 0))) +
    R.gray('   HI ' + R.thousands(best()));
  buf += '\x1b[K' + spread(left, right, cols) + '\n';
  buf += '\x1b[K' + R.dim(game.status()) + '\n';

  for (const line of lines) buf += '\x1b[K' + line + '\n';

  buf +=
    '\x1b[K' +
    R.dim('space jump · [p]ause · [r]estart · [tab] swap game · [q]uit') +
    SYNC_OFF;
  out.write(buf);
}

function loop() {
  if (!paused) game.tick();
  if (game.over) recordBest();
  draw();
}

function handle(key) {
  // control keys ('\x03' = Ctrl-C in raw mode)
  if (key === '\x03' || key === 'q' || key === 'Q') return leave();
  if (key === 'p' || key === 'P') { paused = !paused; return; }
  if (key === '\t' || key === 'g' || key === 'G') {
    gameIndex = (gameIndex + 1) % GAMES.length;
    newGame(gameIndex);
    paused = false;
    return;
  }
  if (key === 'r' || key === 'R') { game.input('restart'); return; }

  // arrow keys arrive as escape sequences: ESC [ A/B/C/D
  if (key === '\x1b[A') return game.input('up');
  if (key === '\x1b[B') return game.input('down');
  if (key === '\x1b[C') return game.input('right');
  if (key === '\x1b[D') return game.input('left');

  switch (key) {
    case ' ': return game.input('jump');
    case 'w': case 'W': return game.input('up');
    case 's': case 'S': return game.input('down');
    case 'a': case 'A': return game.input('left');
    case 'd': case 'D': return game.input('right');
  }
}

function main() {
  enter();
  newGame(gameIndex);

  process.stdin.on('data', (chunk) => {
    // a chunk may bundle multiple keypresses; pull escape sequences off first
    let s = String(chunk);
    while (s.length) {
      if (s.startsWith('\x1b[') && s.length >= 3) {
        handle(s.slice(0, 3)); // ESC [ X
        s = s.slice(3);
      } else if (s[0] === '\x1b') {
        s = s.slice(1); // lone ESC / unknown sequence: drop it
      } else {
        handle(s[0]);
        s = s.slice(1);
      }
    }
  });

  out.on('resize', () => newGame(gameIndex));
  process.on('SIGINT', leave);
  process.on('SIGTERM', leave);

  timer = setInterval(loop, FRAME_MS);
  draw();
}

main();
