import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3, clamp } from '../src/vec3.js';

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${expected}, got ${actual}`);

test('arithmetic works component-wise', () => {
  const a = new Vec3(1, 2, 3);
  const b = new Vec3(4, 5, 6);

  assert.deepEqual(a.plus(b).toArray(), [5, 7, 9]);
  assert.deepEqual(a.minus(b).toArray(), [-3, -3, -3]);
  assert.deepEqual(a.times(2).toArray(), [2, 4, 6]);
  assert.deepEqual(a.hadamard(b).toArray(), [4, 10, 18]);
  assert.deepEqual(a.negate().toArray(), [-1, -2, -3]);
});

test('dot and cross products are correct', () => {
  const x = new Vec3(1, 0, 0);
  const y = new Vec3(0, 1, 0);
  const z = new Vec3(0, 0, 1);

  close(x.dot(y), 0);
  close(new Vec3(1, 2, 3).dot(new Vec3(4, -5, 6)), 4 - 10 + 18);
  assert.deepEqual(x.cross(y).toArray(), z.toArray());
  assert.deepEqual(y.cross(z).toArray(), x.toArray());
});

test('length and unit', () => {
  const v = new Vec3(3, 4, 0);
  close(v.length(), 5);
  close(v.unit().length(), 1);
  assert.deepEqual(new Vec3().unit().toArray(), [0, 0, 0]);
});

test('reflect mirrors a direction around a normal', () => {
  const incoming = new Vec3(1, -1, 0).unit();
  const reflected = incoming.reflect(new Vec3(0, 1, 0));
  close(reflected.x, Math.SQRT1_2);
  close(reflected.y, Math.SQRT1_2);
  close(reflected.length(), 1);
});

test('mix interpolates and clip bounds components', () => {
  const a = new Vec3(0, 0, 0);
  const b = new Vec3(10, 20, 30);
  assert.deepEqual(a.mix(b, 0.5).toArray(), [5, 10, 15]);
  assert.deepEqual(Vec3.mix(a, b, 1).toArray(), b.toArray());
  assert.deepEqual(new Vec3(-1, 2, 0.5).clip().toArray(), [0, 1, 0.5]);
});

test('operations do not mutate their inputs', () => {
  const a = new Vec3(1, 2, 3);
  a.plus(new Vec3(1, 1, 1));
  a.times(10);
  assert.deepEqual(a.toArray(), [1, 2, 3]);
});

test('Vec3.from accepts arrays and objects', () => {
  assert.deepEqual(Vec3.from([1, 2, 3]).toArray(), [1, 2, 3]);
  assert.deepEqual(Vec3.from({ x: 4, y: 5, z: 6 }).toArray(), [4, 5, 6]);
  assert.throws(() => Vec3.from(42), TypeError);
});

test('clamp helper', () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-5, 0, 1), 0);
  assert.equal(clamp(0.5, 0, 1), 0.5);
});
