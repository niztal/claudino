'use strict';
// Token Snake — classic snake. Claude's tail grows with every token (¢) eaten.
// Moves on a throttled tick so it's playable at the harness frame rate.

const R = require('../render');

const STEP_FRAMES = 5; // advance one cell every N animation frames

class Snake {
  constructor(cols, rows) {
    this.title = 'Token Snake';
    this.resize(cols, rows);
    this.reset();
  }

  resize(cols, rows) {
    this.cols = Math.max(20, cols);
    this.rows = Math.max(8, rows);
  }

  reset() {
    const cx = Math.floor(this.cols / 2);
    const cy = Math.floor(this.rows / 2);
    this.body = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
    this.dir = { x: 1, y: 0 };
    this.pendingDir = { x: 1, y: 0 };
    this.score = 0;
    this.over = false;
    this.frame = 0;
    this.placeFood();
  }

  placeFood() {
    let f;
    do {
      f = {
        x: Math.floor(Math.random() * this.cols),
        y: Math.floor(Math.random() * this.rows),
      };
    } while (this.body.some((b) => b.x === f.x && b.y === f.y));
    this.food = f;
  }

  input(action) {
    if (this.over) {
      if (action === 'restart') this.reset();
      return;
    }
    const d = this.dir;
    if (action === 'up' && d.y === 0) this.pendingDir = { x: 0, y: -1 };
    else if (action === 'down' && d.y === 0) this.pendingDir = { x: 0, y: 1 };
    else if (action === 'left' && d.x === 0) this.pendingDir = { x: -1, y: 0 };
    else if (action === 'right' && d.x === 0) this.pendingDir = { x: 1, y: 0 };
  }

  tick() {
    if (this.over) return;
    if (++this.frame % STEP_FRAMES !== 0) return;

    this.dir = this.pendingDir;
    const head = this.body[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;

    // walls
    if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) {
      this.over = true;
      return;
    }
    // self
    if (this.body.some((b) => b.x === nx && b.y === ny)) {
      this.over = true;
      return;
    }

    this.body.unshift({ x: nx, y: ny });
    if (nx === this.food.x && ny === this.food.y) {
      this.score += 1;
      this.placeFood();
    } else {
      this.body.pop();
    }
  }

  status() {
    return R.gold(R.thousands(this.score) + ' tok') + R.gray('  ·  len ' + this.body.length);
  }

  draw() {
    const g = Array.from({ length: this.rows }, () => new Array(this.cols).fill(' '));
    g[this.food.y][this.food.x] = '@';
    this.body.forEach((b, i) => {
      g[b.y][b.x] = i === 0 ? 'O' : 'o';
    });

    const lines = g.map((row, y) =>
      row
        .map((ch) => {
          if (ch === 'O') return R.orange('O');
          if (ch === 'o') return R.green('o');
          if (ch === '@') return R.coin(true); // token to eat
          return ch;
        })
        .join('')
    );

    if (this.over) {
      const msg = '  GAME OVER — ' + R.thousands(this.score) + ' tokens · [r] restart  [q] quit';
      const mid = Math.floor(this.rows / 2);
      lines[mid] = R.bold(R.orange(msg));
    }
    return lines;
  }
}

module.exports = Snake;
