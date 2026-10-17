import test from 'node:test';
import assert from 'node:assert/strict';
import { Vec3 } from '../src/vec3.js';
import { trace } from '../src/tracer.js';
import { render, toByte } from '../src/render.js';
import { getScene, listScenes, sceneNames } from '../src/scenes.js';

const v = (x, y, z) => new Vec3(x, y, z);

test('a ray that hits nothing returns the background colour', () => {
  const scene = { objects: [], lights: [], background: () => v(0.1, 0.2, 0.3) };
  const color = trace(scene, v(0, 0, 0), v(0, 0, -1));
  assert.deepEqual(color.toArray(), [0.1, 0.2, 0.3]);
});

test('a miss without a background falls back to a dark colour', () => {
  const color = trace({ objects: [], lights: [] }, v(0, 0, 0), v(0, 0, -1));
  assert.ok(color.length() > 0 && color.length() < 0.2);
});

test('emissive materials return their own colour regardless of lighting', () => {
  const scene = {
    objects: [
      {
        kind: 'sphere',
        center: v(0, 0, -5),
        radius: 1,
        material: { emissive: v(4, 2, 1) },
      },
    ],
    lights: [],
  };
  assert.deepEqual(trace(scene, v(0, 0, 0), v(0, 0, -1)).toArray(), [4, 2, 1]);
});

test('a blocker between the light and the surface darkens it', () => {
  const surface = {
    kind: 'plane',
    point: v(0, 0, 0),
    normal: v(0, 1, 0),
    material: { color: v(1, 1, 1), ambient: 0.05, diffuse: 1, specular: 0 },
  };
  const light = { position: v(0, 5, 0), intensity: 1, color: v(1, 1, 1) };
  const origin = v(0, 1, 5);
  const direction = v(0, -1, -5).unit();

  const lit = trace({ objects: [surface], lights: [light] }, origin, direction);
  const shadowed = trace(
    {
      objects: [surface, { kind: 'sphere', center: v(0, 2, 0), radius: 0.5, material: {} }],
      lights: [light],
    },
    origin,
    direction,
  );

  assert.ok(lit.length() > shadowed.length() * 3, `${lit.length()} should dwarf ${shadowed.length()}`);
});

test('reflective surfaces mix in what they see', () => {
  const mirror = {
    kind: 'plane',
    point: v(0, 0, 0),
    normal: v(0, 1, 0),
    material: { color: v(0, 0, 0), ambient: 0, diffuse: 0, reflect: 1 },
  };
  const scene = {
    objects: [mirror],
    lights: [],
    background: (direction) => (direction.y > 0 ? v(0.8, 0.9, 1) : v(0, 0, 0)),
  };
  const color = trace(scene, v(0, 1, 0), v(0, -1, 0));
  // The reflected ray points straight up, so we should see the sky.
  assert.ok(Math.abs(color.x - 0.8) < 1e-6);
});

test('fog dissolves distant surfaces into the fog colour', () => {
  const surface = {
    kind: 'plane',
    point: v(0, 0, 0),
    normal: v(0, 1, 0),
    material: { color: v(1, 1, 1), ambient: 1, diffuse: 0 },
  };

  // t = 1, in front of the fog range: no fog at all.
  const closeUp = trace(
    { objects: [surface], lights: [], fog: { color: v(0, 0, 0), near: 10, far: 30 } },
    v(0, 1, 0),
    v(0, -1, 0),
  );
  assert.deepEqual(closeUp.toArray(), [1, 1, 1]);

  // t = 20, halfway through the fog: an even mix.
  const halfway = trace(
    { objects: [surface], lights: [], fog: { color: v(0, 0, 0), near: 10, far: 30 } },
    v(0, 20, 0),
    v(0, -1, 0),
  );
  assert.ok(Math.abs(halfway.x - 0.5) < 1e-9);
  assert.ok(Math.abs(halfway.z - 0.5) < 1e-9);

  // Past `far` the surface is completely hidden by the fog.
  const distant = trace(
    { objects: [surface], lights: [], fog: { color: v(0, 0, 0), near: 10, far: 30 } },
    v(0, 100, 0),
    v(0, -1, 0),
  );
  assert.deepEqual(distant.toArray(), [0, 0, 0]);
});

test('render produces an RGB buffer of the requested size', () => {
  const scene = getScene('spheres');
  const image = render(scene, { width: 12, height: 8, samples: 1, seed: 7 });
  assert.equal(image.width, 12);
  assert.equal(image.height, 8);
  assert.equal(image.data.length, 12 * 8 * 3);
  for (const value of image.data) assert.ok(value >= 0 && value <= 255);
});

test('rendering is deterministic for a given seed', () => {
  const scene = getScene('neon');
  const options = { width: 16, height: 9, samples: 2, seed: 99 };
  const first = render(scene, options);
  const second = render(scene, options);
  assert.deepEqual(Array.from(first.data), Array.from(second.data));

  const other = render(scene, { ...options, seed: 100 });
  assert.notDeepEqual(Array.from(first.data), Array.from(other.data));
});

test('render rejects nonsense sizes', () => {
  const scene = getScene('spheres');
  assert.throws(() => render(scene, { width: 0, height: 10 }), TypeError);
  assert.throws(() => render(scene, { width: 10, height: -2 }), TypeError);
  assert.throws(() => render(scene, { width: 10, height: 10, samples: 0 }), TypeError);
});

test('toByte is monotonic and clamps to 0..255', () => {
  assert.equal(toByte(0), 0);
  assert.equal(toByte(1000), 255);
  let previous = -1;
  for (const value of [0, 0.05, 0.2, 0.5, 0.8, 1, 2, 5]) {
    const byte = toByte(value);
    assert.ok(byte >= previous, `toByte(${value}) = ${byte} should not decrease`);
    previous = byte;
  }
});

test('exposure brightens the image', () => {
  const scene = getScene('spheres');
  const dim = render(scene, { width: 24, height: 14, samples: 1, seed: 3, exposure: 0.5 });
  const bright = render(scene, { width: 24, height: 14, samples: 1, seed: 3, exposure: 2 });
  const sum = (image) => image.data.reduce((total, value) => total + value, 0);
  assert.ok(sum(bright) > sum(dim));
});

test('every built-in scene is renderable and lists itself', () => {
  assert.deepEqual(sceneNames, ['spheres', 'planets', 'neon']);
  assert.equal(listScenes().length, 3);

  for (const name of sceneNames) {
    const scene = getScene(name);
    assert.equal(scene.name, name);
    assert.ok(scene.objects.length > 0);
    const image = render(scene, { width: 20, height: 12, samples: 1, seed: 5 });
    assert.equal(image.data.length, 20 * 12 * 3);
    // Something must actually be visible: not every pixel is pure black.
    assert.ok(image.data.some((value) => value > 8), `${name} rendered a black frame`);
  }
});

test('unknown scenes raise a helpful error', () => {
  assert.throws(() => getScene('nope'), /unknown scene "nope"/);
});
