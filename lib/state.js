'use strict';
// Tiny per-session state shared between the hooks (which flip the phase) and
// the status line (which reads the phase and records token/cost baselines).
// Keyed by session_id, which appears in both hook stdin and status-line stdin.

const fs = require('fs');
const os = require('os');
const path = require('path');

const DIR = path.join(os.tmpdir(), 'claudino');

function fileFor(sessionId) {
  const safe = String(sessionId || 'default').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(DIR, safe + '.json');
}

function read(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(fileFor(sessionId), 'utf8'));
  } catch {
    return null;
  }
}

// Shallow-merge `patch` into the existing state and persist it.
function write(sessionId, patch) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const next = Object.assign(read(sessionId) || {}, patch);
    fs.writeFileSync(fileFor(sessionId), JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

function clear(sessionId) {
  try {
    fs.unlinkSync(fileFor(sessionId));
  } catch {
    /* ignore */
  }
}

module.exports = { read, write, clear, fileFor, DIR };
