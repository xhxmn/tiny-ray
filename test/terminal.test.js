import test from 'node:test';
import assert from 'node:assert/strict';
import { ASCII_RAMP, luminance, sizeForColumns, toAscii, toHalfBlocks } from '../src/terminal.js';

/** @param {number} width @param {number} height @param {number[]} rgb */
function fill(width, height, [r, g, b]) {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    data[i * 3] = r;
    data[i * 3 + 1] = g;
    data[i * 3 + 2] = b;
  }
  return { width, height, data };
}

test('luminance is perceptually weighted', () => {
  assert.ok(Math.abs(luminance(255, 255, 255) - 255) < 1e-9);
  assert.equal(luminance(0, 0, 0), 0);
  assert.ok(luminance(0, 255, 0) > luminance(255, 0, 0));
});

test('toAscii maps black to the first ramp character and white to the last', () => {
  const black = toAscii(fill(4, 2, [0, 0, 0]));
  const white = toAscii(fill(4, 2, [255, 255, 255]));

  assert.equal(black.split('\n').length, 2);
  assert.equal(black, `${ASCII_RAMP[0].repeat(4)}\n${ASCII_RAMP[0].repeat(4)}`);
  assert.equal(white, `${ASCII_RAMP.at(-1).repeat(4)}\n${ASCII_RAMP.at(-1).repeat(4)}`);
});

test('toAscii only emits characters from the ramp', () => {
  const image = { width: 3, height: 3, data: Uint8Array.from([0, 0, 0, 60, 60, 60, 120, 120, 120, 180, 180, 180, 255, 255, 255, 30, 30, 30, 90, 90, 90, 150, 150, 150, 210, 210, 210]) };
  const text = toAscii(image);
  for (const line of text.split('\n')) {
    assert.equal(line.length, 3);
    for (const character of line) assert.ok(ASCII_RAMP.includes(character));
  }
});

test('toAscii can emit ANSI coloured characters', () => {
  const text = toAscii(fill(2, 1, [10, 20, 30]), { color: true });
  assert.ok(text.startsWith('\x1b[38;2;10;20;30m'));
  assert.ok(text.endsWith('\x1b[0m'));
});

test('toHalfBlocks packs two pixel rows into one line', () => {
  const image = fill(3, 3, [255, 0, 0]);
  const text = toHalfBlocks(image);
  const lines = text.split('\n');

  assert.equal(lines.length, 2); // ceil(3 / 2)
  for (const line of lines) {
    assert.equal(line.match(/\u2580/g)?.length, 3);
    assert.ok(line.includes('\x1b[38;2;255;0;0m'), 'foreground colour for the upper half');
    assert.ok(line.includes('\x1b[48;2;255;0;0m'), 'background colour for the lower half');
    assert.ok(line.endsWith('\x1b[0m'));
  }
});

test('toHalfBlocks handles odd heights without dropping pixels', () => {
  const image = fill(2, 1, [0, 0, 255]);
  const lines = toHalfBlocks(image).split('\n');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].match(/\u2580/g)?.length, 2);
});

test('sizeForColumns keeps roughly a 16:9 aspect ratio', () => {
  for (const columns of [40, 80, 120]) {
    const { width, height } = sizeForColumns(columns);
    assert.equal(width, columns);
    assert.equal(height % 2, 0);
    const aspect = width / height;
    assert.ok(Math.abs(aspect - 9 / 16) < 0.02, `aspect ${aspect} should be close to 9/16`);
  }
});

test('sizeForColumns enforces a minimum size', () => {
  const { width, height } = sizeForColumns(2);
  assert.ok(width >= 8 && height >= 8);
});
