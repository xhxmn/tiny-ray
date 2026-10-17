import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from '../src/vec3.js';
import {
  EPSILON,
  albedoAt,
  intersectPlane,
  intersectSphere,
  nearestHit,
  occluded,
} from '../src/geometry.js';

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `expected ${expected}, got ${actual}`);

test('sphere intersection returns the near hit', () => {
  const origin = new Vec3(0, 0, 5);
  const direction = new Vec3(0, 0, -1);
  close(intersectSphere(origin, direction, new Vec3(0, 0, 0), 1), 4);
});

test('sphere intersection returns null on a miss and when the sphere is behind', () => {
  assert.equal(intersectSphere(new Vec3(0, 2, 5), new Vec3(0, 0, -1), new Vec3(0, 0, 0), 1), null);
  assert.equal(intersectSphere(new Vec3(0, 0, 5), new Vec3(0, 0, 1), new Vec3(0, 0, 0), 1), null);
});

test('a ray starting inside a sphere exits through its far wall', () => {
  const t = intersectSphere(new Vec3(0, 0, 0), new Vec3(1, 0, 0), new Vec3(0, 0, 0), 2);
  close(t, 2);
});

test('plane intersection', () => {
  close(intersectPlane(new Vec3(0, 1, 0), new Vec3(0, -1, 0), new Vec3(0, 0, 0), new Vec3(0, 1, 0)), 1);
  // parallel rays never hit
  assert.equal(
    intersectPlane(new Vec3(0, 1, 0), new Vec3(1, 0, 0), new Vec3(0, 0, 0), new Vec3(0, 1, 0)),
    null,
  );
  // and neither do plane hits behind the origin
  assert.equal(
    intersectPlane(new Vec3(0, 1, 0), new Vec3(0, 1, 0), new Vec3(0, 0, 0), new Vec3(0, 1, 0)),
    null,
  );
});

test('nearestHit picks the closest object and faces the normal towards the ray', () => {
  const scene = {
    objects: [
      { kind: 'sphere', center: new Vec3(0, 0, -6), radius: 1, material: { color: new Vec3(1, 1, 1) } },
      { kind: 'sphere', center: new Vec3(0, 0, 0), radius: 1, material: { color: new Vec3(1, 1, 1) } },
    ],
  };
  const hit = nearestHit(scene, new Vec3(0, 0, 5), new Vec3(0, 0, -1));
  close(hit.t, 4);
  close(hit.normal.z, 1); // pointing back at the ray, not away from it
  close(hit.point.z, 1);
});

test('nearestHit respects tMax and returns null for empty space', () => {
  const scene = {
    objects: [{ kind: 'sphere', center: new Vec3(0, 0, 0), radius: 1, material: {} }],
  };
  assert.equal(nearestHit(scene, new Vec3(0, 0, 5), new Vec3(0, 0, -1), 3.9), null);
  assert.equal(nearestHit(scene, new Vec3(0, 5, 5), new Vec3(0, 0, -1)), null);
});

test('occluded detects blockers only inside the given distance', () => {
  const scene = {
    objects: [{ kind: 'sphere', center: new Vec3(0, 0, 0), radius: 1, material: {} }],
  };
  assert.equal(occluded(scene, new Vec3(0, 0, 5), new Vec3(0, 0, -1), 10), true);
  assert.equal(occluded(scene, new Vec3(0, 0, 5), new Vec3(0, 0, -1), 2), false);
  assert.equal(occluded(scene, new Vec3(0, 0, 5), new Vec3(0, 0, 1), 10), false);
});

test('albedoAt resolves colours, checkers and patterns', () => {
  const red = new Vec3(1, 0, 0);
  const blue = new Vec3(0, 0, 1);

  assert.deepEqual(albedoAt({ color: red }, new Vec3(), new Vec3(0, 1, 0)).toArray(), [1, 0, 0]);

  const checker = { checker: { scale: 1, colorA: red, colorB: blue } };
  assert.deepEqual(albedoAt(checker, new Vec3(0.5, 0, 0.5), new Vec3(0, 1, 0)).toArray(), [1, 0, 0]);
  assert.deepEqual(albedoAt(checker, new Vec3(1.5, 0, 0.5), new Vec3(0, 1, 0)).toArray(), [0, 0, 1]);

  // The parity must not depend on the y coordinate of a floor at y = 0.
  assert.deepEqual(albedoAt(checker, new Vec3(0.5, -1e-16, 0.5), new Vec3(0, 1, 0)).toArray(), [1, 0, 0]);

  const pattern = { pattern: (point) => point };
  assert.deepEqual(albedoAt(pattern, new Vec3(0.1, 0.2, 0.3), new Vec3(0, 1, 0)).toArray(), [0.1, 0.2, 0.3]);

  assert.equal(EPSILON > 0, true);
});
