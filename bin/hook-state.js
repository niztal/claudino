#!/usr/bin/env node
'use strict';
// Invoked by Claude Code hooks (async, so it must never block or throw).
//   UserPromptSubmit -> "start"  : Claude began thinking
//   Stop             -> "stop"   : Claude finished
//   SessionEnd       -> "end"    : clean up
// Reads the hook JSON on stdin only to learn the session_id.

const state = require('../lib/state');

const action = process.argv[2] || 'start';

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
