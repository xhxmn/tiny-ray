/**
 * Build a scene from scratch with the public API and write it to a PNG.
 *
 *   node examples/custom-scene.js
 */
import { Vec3, render, writeImage } from '../src/index.js';

const scene = {
  camera: { eye: new Vec3(0, 1.3, 5), target: new Vec3(0, 0.85, 0), fov: 42 },
  exposure: 1.0,
  fog: { color: new Vec3(0.72, 0.8, 0.93), near: 18, far: 55 },
  objects: [
    // An infinite checkered floor.
    {
      kind: 'plane',
      point: new Vec3(0, 0, 0),
      normal: new Vec3(0, 1, 0),
      material: {
        checker: { scale: 1, colorA: new Vec3(0.9, 0.9, 0.92), colorB: new Vec3(0.12, 0.13, 0.16) },
        ambient: 0.08,
        diffuse: 0.85,
        specular: 0.3,
        shininess: 180,
        reflect: 0.2,
      },
    },
    // A glossy blue sphere sitting on it.
    {
      kind: 'sphere',
      center: new Vec3(0, 0.9, 0),
      radius: 0.9,
      material: {
        color: new Vec3(0.2, 0.55, 0.75),
        ambient: 0.05,
        diffuse: 0.6,
        specular: 0.9,
        shininess: 350,
        reflect: 0.35,
      },
    },
  ],
  lights: [
    { position: new Vec3(3, 5, 4), color: new Vec3(1, 0.97, 0.9), intensity: 1.8 },
    { position: new Vec3(-4, 2.5, 1), color: new Vec3(0.6, 0.75, 1), intensity: 0.6 },
  ],
  // `direction` is a unit Vec3; this fades from sky blue to white at the horizon.
  background: (direction) =>
    new Vec3(0.5, 0.66, 0.9).mix(new Vec3(0.92, 0.95, 0.98), 1 - Math.max(0, direction.y)),
};

const image = render(scene, { width: 800, height: 450, samples: 8 });
writeImage('custom.png', image);
console.log(`rendered ${image.width}×${image.height} (${image.data.length / 3} pixels) → custom.png`);
