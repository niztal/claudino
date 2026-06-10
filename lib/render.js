'use strict';
// Shared ANSI styling + drawing helpers for both the status-line muncher and the game.

const ESC = '\x1b[';
const RESET = ESC + '0m';
const BOLD = ESC + '1m';
const DIM = ESC + '2m';

// 256-color palette
const C = {
  orange: ESC + '38;5;208m', // Claude
  gold: ESC + '38;5;220m', // coins
  green: ESC + '38;5;42m',
  yellow: ESC + '38;5;220m',
  red: ESC + '38;5;203m',
  blue: ESC + '38;5;39m',
  gray: ESC + '38;5;245m',
};

const wrap = (code) => (s) => code + s + RESET;
const orange = wrap(C.orange);
const gold = wrap(C.gold);
const green = wrap(C.green);
const red = wrap(C.red);
const blue = wrap(C.blue);
const gray = wrap(C.gray);
const dim = (s) => DIM + s + RESET;
const bold = (s) => BOLD + s + RESET;

// A 0-100 usage bar: filled = how much is USED, green -> yellow -> red as it
// approaches the limit. Both gauges (Context, Limit) use this so a fuller/redder
// bar always means "closer to the cap". `animate` adds a gold pulse travelling
// through the filled portion — used only while thinking, so it's still at rest.
function bar(pct, width = 10, animate = false) {
  pct = Math.max(0, Math.min(100, pct || 0));
  const filled = Math.round((pct / 100) * width);
  const color = pct >= 90 ? C.red : pct >= 70 ? C.yellow : C.green;
  const spark = animate && filled > 0 ? Math.floor(Date.now() / 350) % filled : -1;
  let s = '';
  for (let i = 0; i < width; i++) {
    if (i < filled) s += (i === spark ? BOLD + C.gold : color) + '▓' + RESET;
    else s += DIM + '░' + RESET;
  }
  return s;
}

// Token glyphs. Regular tokens are gold "●"; every 5th is a fat diamond "◆".
function coin(bonus) {
  return bonus ? bold(gold('◆')) : gold('●');
}

// Bomb obstacle: a dark round body with a lit fuse spark above it.
function bombBody() {
  return ESC + '38;5;240m●' + RESET;
}
function bombFuse(lit) {
  return (lit ? ESC + '38;5;196m' : ESC + '38;5;214m') + '✦' + RESET;
}

// A scrolling trail of tokens that appears to flow toward the creature.
function coinTrail(count, offset = 0) {
  count = Math.max(0, count);
  const parts = [];
  for (let i = 0; i < count; i++) parts.push(coin((i + offset) % 5 === 0));
  return parts.join(' ');
}

function thousands(n) {
  return Math.round(n || 0).toLocaleString('en-US');
}

module.exports = {
  C, RESET, BOLD, DIM, ESC,
  orange, gold, green, red, blue, gray, dim, bold,
  bar, coin, coinTrail, bombBody, bombFuse, thousands,
};
