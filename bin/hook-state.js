#!/usr/bin/env node
'use strict';
// Invoked by Claude Code hooks (async, so it must never block or throw).
//   UserPromptSubmit -> "start"  : Claude began thinking
//   Stop             -> "stop"   : Claude finished
//   SessionEnd       -> "end"    : clean up
// Reads the hook JSON on stdin only to learn the session_id.

const fs = require('fs');
const path = require('path');
const state = require('../lib/state');

const action = process.argv[2] || 'start';

// Opt-in auto-launch (CLAUDINO_AUTOPLAY=1): open the game pane the moment a
// prompt is submitted. Hooks are the only claudino surface that runs *while*
// Claude is thinking — /play is itself a prompt, so it queues behind the
// current turn and only opens the game once Claude is done.
const PID_FILE = path.join(state.DIR, 'game.pid');
const LAUNCH_FILE = path.join(state.DIR, 'game.launch');
const QUIT_FILE = path.join(state.DIR, 'game.quit');
const LAUNCH_GRACE_MS = 15000;       // pane may take seconds to open + write its pid
const QUIT_QUIET_MS = 10 * 60_000;   // don't reopen a pane the user just quit

function gameAlive() {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
    if (!(pid > 0)) return false;
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return Boolean(err) && err.code === 'EPERM'; // alive, just not our process
  }
}

function within(file, ms) {
  try {
    return Date.now() - Number(fs.readFileSync(file, 'utf8')) < ms;
  } catch {
    return false;
  }
}

function maybeAutoLaunchGame() {
  if (!/^(1|true|yes|on)$/i.test(process.env.CLAUDINO_AUTOPLAY || '')) return;
  if (gameAlive() || within(LAUNCH_FILE, LAUNCH_GRACE_MS) || within(QUIT_FILE, QUIT_QUIET_MS)) return;
  try {
    fs.writeFileSync(LAUNCH_FILE, String(Date.now()));
    require('child_process')
      .spawn('bash', [path.join(__dirname, 'tm-play.sh')], { detached: true, stdio: 'ignore' })
      .unref();
  } catch {
    /* never break the hook */
  }
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let sessionId = 'default';
  try {
    sessionId = JSON.parse(raw).session_id || 'default';
  } catch {
    /* no/!json stdin — fall back to default */
  }

  try {
    if (action === 'start') {
      // New turn: mark thinking and reset the per-turn baseline so the status
      // line recaptures token/cost counts on its next render.
      state.write(sessionId, {
        phase: 'thinking',
        turnStart: Date.now(),
        baseTokens: null,
        baseCost: null,
      });
      maybeAutoLaunchGame();
    } else if (action === 'stop') {
      state.write(sessionId, { phase: 'idle' });
    } else if (action === 'end') {
      state.clear(sessionId);
    }
  } catch {
    /* never break the hook */
  }
  process.exit(0);
});

// If stdin never arrives, don't hang forever.
setTimeout(() => process.exit(0), 2000).unref?.();
