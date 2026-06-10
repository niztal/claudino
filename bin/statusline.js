#!/usr/bin/env node
'use strict';
// Layer 1 — the status-line muncher.
// Reads Claude Code's status-line JSON on stdin and prints the Claude creature
// (real block-art) plus a coin trail and live, REAL usage:
//
//    ▐▛███▜▌     ● ● ◆ ● ● ● ● ◆ …
//   ▝▜█████▛▘    belly ▓▓▓░░ 28%
//     ▘▘ ▝▝      munching $0.0042 · 1,240 tok this turn
//
// Animates at ~1 fps (set refreshInterval:1 in settings).

const fs = require('fs');
const R = require('../lib/render');
const claude = require('../lib/claude');
const state = require('../lib/state');

function readStdin() {
  return new Promise((resolve) => {
    let raw = '';
    if (process.stdin.isTTY) return resolve('');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (raw += c));
    process.stdin.on('end', () => resolve(raw));
    setTimeout(() => resolve(raw), 1500).unref?.();
  });
}

function num(v, d = 0) {
  return typeof v === 'number' && isFinite(v) ? v : d;
}

function fmtReset(sec) {
  if (sec < 60) return '<1m';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

// Compact token count like Claude's spinner: 3300 -> "3.3k", 12000 -> "12k".
function kfmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return String(Math.round(n));
}

// The 5-hour usage window as a "% used" bar (Pro/Max only, after the first API
// response), consistent with the Context bar: fills up as you consume it, reds
// out near the cap. Returns null when no rate-limit data is available.
// `animate` adds the gold pulse (thinking only).
function limitSegment(data, animate) {
  const fh = (data.rate_limits || {}).five_hour;
  if (!fh || typeof fh.used_percentage !== 'number') return null;
  const used = Math.max(0, Math.min(100, fh.used_percentage));
  // Only show a reset time when it's genuinely in the future; a past/zero
  // timestamp (window at its boundary or briefly stale) shouldn't say "now".
  const remaining = typeof fh.resets_at === 'number' ? fh.resets_at - Date.now() / 1000 : 0;
  const reset = remaining > 0 ? R.gray(' · resets ') + fmtReset(remaining) : '';
  return R.bar(used, 10, animate) + ' ' + R.dim(Math.round(used) + '%') + reset;
}

// Cumulative output tokens for the whole session, summed from the transcript.
// Read incrementally (only the bytes appended since last time) and cached by
// byte offset in the state file, so it stays cheap even for large transcripts.
// One API response is written as several "assistant" lines (one per content
// block), each repeating the same usage — count each message.id only once.
function cumulativeOutput(data, sessionId, fallback) {
  const tpath = data.transcript_path;
  if (!tpath) return fallback;
  const st = state.read(sessionId) || {};
  // tokV guards the cache format: totals counted before the per-message dedupe
  // (no tokV) are inflated, so throw them away and recount once.
  const fresh = st.tokPath === tpath && st.tokV === 2;
  let offset = fresh && typeof st.tokOffset === 'number' ? st.tokOffset : 0;
  let total = fresh && typeof st.cumTok === 'number' ? st.cumTok : 0;
  let lastId = fresh ? st.tokMsgId : undefined;
  let lastOt = fresh && typeof st.tokMsgOt === 'number' ? st.tokMsgOt : 0;

  let size;
  try { size = fs.statSync(tpath).size; } catch { return total || fallback; }
  if (size < offset) { offset = 0; total = 0; lastId = undefined; lastOt = 0; } // file was truncated/rotated
  if (size <= offset) return total || fallback;

  try {
    const fd = fs.openSync(tpath, 'r');
    const len = size - offset;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, offset);
    fs.closeSync(fd);

    const chunk = buf.toString('utf8');
    const lines = chunk.split('\n');
    const partial = chunk.endsWith('\n') ? '' : lines.pop(); // keep incomplete line for next time
    for (const line of lines) {
      if (!line) continue;
      try {
        const o = JSON.parse(line);
        const m = o && o.type === 'assistant' && o.message;
        const ot = m && m.usage && m.usage.output_tokens;
        if (typeof ot === 'number') {
          if (m.id && m.id === lastId) {
            total += ot - lastOt; // same response, refreshed usage — replace, don't re-add
          } else {
            total += ot;
            lastId = m.id;
          }
          lastOt = ot;
        }
      } catch { /* skip non-JSON / partial lines */ }
    }
    offset += len - Buffer.byteLength(partial, 'utf8');
    state.write(sessionId, { cumTok: total, tokOffset: offset, tokPath: tpath, tokMsgId: lastId, tokMsgOt: lastOt, tokV: 2 });
  } catch { /* ignore read errors, return what we have */ }

  return total || fallback;
}

function render(data) {
  const cols = Math.max(24, parseInt(process.env.COLUMNS, 10) || 80);
  const sessionId = data.session_id || 'default';

  const cw = data.context_window || {};
  const outTok = num(cw.total_output_tokens); // latest response output (fallback)
  const cost = num((data.cost || {}).total_cost_usd);
  const ctxPct = num(cw.used_percentage, 0);

  const st = state.read(sessionId) || { phase: 'idle' };
  const thinking = st.phase === 'thinking';

  // Creature: feet "walk" while thinking, stand still while idle.
  const walk = Math.floor(Date.now() / 400) % 2;
  const art = claude.lines(thinking ? walk : 0, false).map((l) => R.orange(l));

  // Pulse the limit bar only while thinking — when napping, nothing should move.
  const limit = limitSegment(data, thinking); // null for API-key users / before first response

  // Labels padded to a common width so the two bars line up vertically.
  const label = (s) => R.gray(s.padEnd(8));

  // Both bars mean the same thing now: filled = USED, green -> red near the cap.
  // L1 "Context" = this chat's context window.
  const contextLine = label('Context') + R.bar(ctxPct, 10) + ' ' + R.dim(Math.round(ctxPct) + '%');

  // L2 "Limit" = your 5-hour usage allowance (or session cost for API users).
  let limitLine;
  if (limit) {
    limitLine = label('Limit') + limit;
  } else if (cost > 0) {
    limitLine = label('Cost') + R.gray('~') + R.gold('$' + cost.toFixed(2)) + R.gray(' session (est.)');
  } else {
    limitLine = label('Limit') + R.dim('—');
  }

  // The session token odometer lives on its own (top) line, clearly "this
  // session", so it's never confused with the limit bar's percentage.
  const totalTok = cumulativeOutput(data, sessionId, outTok);
  const tokStr = totalTok > 0 ? R.gold('↓ ' + kfmt(totalTok) + ' tok') + R.gray(' this session') : '';

  // The model Claude is currently running as, e.g. "Opus 4.8".
  const model = (data.model || {}).display_name || '';
  const modelStr = model ? R.gray(' · ') + R.dim(model) : '';

  let right0;
  if (thinking) {
    const reserve = (tokStr ? 26 : 0) + (model ? model.length + 3 : 0);
    const room = cols - claude.WIDTH - 4 - reserve;
    const coinCount = Math.max(3, Math.min(24, Math.floor(room / 2)));
    const offset = Math.floor(Date.now() / 450); // scroll the tokens toward Claude
    right0 = R.coinTrail(coinCount, offset) + (tokStr ? '  ' + tokStr : '') + modelStr;
  } else {
    right0 = R.dim('z z z   Claude is napping…') + (tokStr ? R.gray('   ') + tokStr : '') + modelStr;
  }

  const gap = '  ';
  return [art[0] + gap + right0, art[1] + gap + contextLine, art[2] + gap + limitLine].join('\n');
}

// --demo: animate a few frames so you can preview the muncher. Runs in the
// alternate screen buffer and restores the terminal cleanly on exit.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function demo() {
  const out = process.stdout;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    state.clear('demo');
    out.write('\x1b[?25h\x1b[?1049l'); // show cursor, leave alt screen
  };
  process.on('SIGINT', () => { restore(); process.exit(0); });

  out.write('\x1b[?1049h\x1b[?25l'); // alt screen, hide cursor
  const sample = {
    session_id: 'demo',
    model: { id: 'claude-opus-4-8', display_name: 'Opus 4.8' },
    context_window: { total_output_tokens: 0, used_percentage: 18 },
    cost: { total_cost_usd: 0 },
  };
  state.write('demo', { phase: 'thinking', baseTokens: 0, baseCost: 0 });
  for (let i = 0; i < 14; i++) {
    sample.context_window.total_output_tokens = i * 137;
    sample.context_window.used_percentage = Math.min(95, 18 + i * 6);
    sample.cost.total_cost_usd = i * 0.0031;
    const body = render(sample).split('\n').map((l) => '\x1b[2K' + l).join('\n');
    out.write('\x1b[H\n  claudino demo — Ctrl-C to exit\n\n' + body + '\n');
    await sleep(450);
  }
  await sleep(700); // hold the final frame
  restore();
}

(async () => {
  if (process.argv.includes('--demo')) {
    await demo();
    process.exit(0);
  }
  const raw = await readStdin();
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch {
    /* render with defaults */
  }
  let line;
  try {
    line = render(data);
  } catch {
    line = R.orange('claudino');
  }
  // Write, then exit explicitly once stdout has flushed.
  process.stdout.write(line + '\n', () => process.exit(0));
})();
