'use strict';
// The real Claude creature, drawn with block-drawing glyphs (each 1 cell wide).
//
//   ▐▛███▜▌
//  ▝▜█████▛▘
//    ▘▘ ▝▝
//
// 3 rows tall, 9 columns wide. The two feet rows alternate to "walk", and tuck
// together while airborne (a Chrome-Dino-style hop).

const WIDTH = 9;
const HEIGHT = 3;

const BODY = [
  ' ▐▛███▜▌',
  '▝▜█████▛▘',
];
const FEET_WALK = ['  ▘▘ ▝▝ ', '  ▝▝ ▘▘ '];
const FEET_JUMP = '  ▘   ▝ ';

// Return the 3 raw (uncolored) rows, right-padded to WIDTH.
function lines(frame = 0, airborne = false) {
  const feet = airborne ? FEET_JUMP : FEET_WALK[frame % FEET_WALK.length];
  return [BODY[0], BODY[1], feet].map((s) => s.padEnd(WIDTH, ' '));
}

module.exports = { WIDTH, HEIGHT, lines };
