'use strict';
// Coin Runner — the Dino game. The real Claude creature runs along the ground;
// press Space/Up for a snappy hop to clear bombs (💣-ish) and grab tokens.

const R = require('../render');
const claude = require('../claude');

const CX = 3;            // creature's fixed left column
const CW = claude.WIDTH; // 9
const CH = claude.HEIGHT; // 3

// Tuned for a Chrome-Dino feel: quick lift-off, ~1s of air, clean landing.
const GRAVITY = 0.12;
const JUMP_V = 1.1;

// Hitbox is narrower than the art so grazes feel fair.
const HIT_L = 2;
const HIT_R = CW - 2;

class Runner {
  constructor(cols, rows) {
    this.title = 'Coin Runner';
    this.resize(cols, rows);
    this.reset();
  }

  resize(cols, rows) {
    this.cols = Math.max(40, cols);
    this.rows = Math.max(CH + 5, rows);
    this.groundRow = this.rows - 1; // "─" line
    this.standRow = this.rows - 2;  // creature's feet row when grounded
  }

  reset() {
    this.y = 0;          // feet height above ground, in rows
    this.vy = 0;
    this.bombs = [];     // {x}
    this.coins = [];     // {x, h}
    this.score = 0;
    this.dist = 0;
    this.frame = 0;
    this.level = 0;
    this.bombGap = 55;   // generous head start
    this.coinGap = 12;
    this.over = false;
    this.speed = 1.0;
  }

  input(action) {
    if (this.over) {
      if (action === 'restart' || action === 'jump' || action === 'up') this.reset();
      return;
    }
    if ((action === 'jump' || action === 'up') && this.y <= 0.001) this.vy = JUMP_V;
  }

  get airborne() {
    return this.y > 0.05;
  }

  box() {
    const bottom = this.standRow - Math.round(this.y);
    return { top: bottom - (CH - 1), bottom, left: CX + HIT_L, right: CX + HIT_R };
  }

  tick() {
    if (this.over) return;
    this.frame++;
    this.level = Math.floor(this.dist / 500);
    this.speed = 1.0 + Math.min(2.4, this.dist / 450); // gets faster the longer you survive
    this.dist += this.speed;

    // physics
    this.y += this.vy;
    this.vy -= GRAVITY;
    if (this.y <= 0) { this.y = 0; this.vy = 0; }

    // spawn bombs — more frequent at higher levels (but always single-jump clearable)
    if (--this.bombGap <= 0) {
      this.bombs.push({ x: this.cols - 1 });
      const minGap = Math.max(16, 36 - this.level * 2);
      this.bombGap = minGap + Math.floor(Math.random() * 12);
    }
    // spawn tokens (height 0-4: low ones grabbed while running, high ones need a jump).
    // Sparse pairs keep the screen calm rather than a shimmering field.
    if (--this.coinGap <= 0) {
      const h = Math.floor(Math.random() * 5);
      for (let i = 0; i < 2; i++) this.coins.push({ x: this.cols - 1 + i * 3, h });
      this.coinGap = Math.floor(16 + Math.random() * 16);
    }

    const b = this.box();

    // move + cull bombs; collide only on the ground row (fuse is decorative)
    for (const o of this.bombs) o.x -= this.speed;
    this.bombs = this.bombs.filter((o) => o.x > -2);
    for (const o of this.bombs) {
      const ox = Math.round(o.x);
      if (ox >= b.left && ox <= b.right && b.bottom >= this.standRow) this.over = true;
    }

    // move + collect tokens anywhere inside the creature box
    for (const c of this.coins) c.x -= this.speed;
    this.coins = this.coins.filter((c) => {
      const cx = Math.round(c.x);
      const cy = this.standRow - c.h;
      if (cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom) {
        this.score += cx % 5 === 0 ? 5 : 1;
        return false;
      }
      return c.x > -2;
    });
  }

  status() {
    return (
      R.gray('dist ') + R.thousands(Math.round(this.dist)) +
      R.gray('  ·  lvl ') + (this.level + 1) +
      R.gray('  ·  speed ') + this.speed.toFixed(1) + 'x'
    );
  }

  draw() {
    const g = Array.from({ length: this.rows }, () => new Array(this.cols).fill(' '));
    for (let x = 0; x < this.cols; x++) g[this.groundRow][x] = R.dim('─');

    // tokens
    for (const c of this.coins) {
      const x = Math.round(c.x);
      const row = this.standRow - c.h;
      if (x >= 0 && x < this.cols && row >= 0) g[row][x] = R.coin(x % 5 === 0);
    }
    // bombs: dark body on the ground, lit fuse spark above (slow ~0.5s blink)
    const lit = Math.floor(this.frame / 8) % 2 === 0;
    for (const o of this.bombs) {
      const x = Math.round(o.x);
      if (x < 0 || x >= this.cols) continue;
      g[this.standRow][x] = R.bombBody();
      if (this.standRow - 1 >= 0) g[this.standRow - 1][x] = R.bombFuse(lit);
    }
    // creature (skip transparent cells so the ground/tokens show through)
    const b = this.box();
    const art = claude.lines(Math.floor(this.frame / 6), this.airborne);
    for (let i = 0; i < CH; i++) {
      const gr = b.top + i;
      if (gr < 0 || gr >= this.rows) continue;
      const line = art[i];
      for (let x = 0; x < line.length; x++) {
        const ch = line[x];
        if (ch !== ' ' && CX + x < this.cols) g[gr][CX + x] = R.orange(ch);
      }
    }

    const lines = g.map((row) => row.join(''));
    if (this.over) {
      const msg = '  💥 BOOM — ' + R.thousands(this.score) + ' tokens · [space] play again  [q] quit';
      lines[Math.max(0, Math.floor(this.rows / 2) - 1)] = R.bold(R.orange(msg));
    }
    return lines;
  }
}

module.exports = Runner;
