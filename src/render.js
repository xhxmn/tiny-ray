import { Vec3 } from './vec3.js';
import { makeCamera, cameraRay } from './camera.js';
import { trace } from './tracer.js';
import { mulberry32 } from './rng.js';

/**
 * Map a linear HDR value to an 8 bit sRGB value.
 *
 * A linear section keeps midtones saturated, and a smooth shoulder rolls
 * highlights off towards white instead of clipping them into flat blobs.
 * @param {number} value
 * @returns {number}
 */
export function toByte(value) {
  const SHOULDER = 0.8;
  const linear = Math.max(0, value);
  const mapped =
    linear <= SHOULDER
      ? linear
      : SHOULDER + (1 - SHOULDER) * (1 - Math.exp(-(linear - SHOULDER) / (1 - SHOULDER)));
  return Math.round(255 * Math.pow(mapped, 1 / 2.2));
}

/**
 * Render a scene into an RGB byte buffer.
 *
 * @param {object} scene
 * @param {object} [options]
 * @param {number} [options.width] pixels
 * @param {number} [options.height] pixels
 * @param {number} [options.samples] jittered samples per pixel (anti-aliasing)
 * @param {number} [options.maxDepth] reflection bounces
 * @param {number} [options.seed] PRNG seed, same seed => same image
 * @param {number} [options.exposure] multiplicative exposure
 * @param {(row: number, height: number) => void} [options.onProgress] called after each row
 * @returns {{ width: number, height: number, data: Uint8Array }} RGB triples, row major
 */
export function render(
  scene,
  { width = 320, height = 180, samples = 2, maxDepth = 4, seed = 1, exposure, onProgress } = {},
) {
  if (!Number.isInteger(width) || width <= 0) throw new TypeError('width must be a positive integer');
  if (!Number.isInteger(height) || height <= 0) throw new TypeError('height must be a positive integer');
  if (!Number.isInteger(samples) || samples <= 0) throw new TypeError('samples must be a positive integer');

  const camera = makeCamera({ ...scene.camera, width, height });
  const random = mulberry32(seed);
  const gain = exposure ?? scene.exposure ?? 1;
  const data = new Uint8Array(width * height * 3);
  const sampleWeight = 1 / samples;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let total = new Vec3();
      for (let s = 0; s < samples; s++) {
        // Stratify a single sample in the middle, jitter freely for many.
        const jitterU = samples === 1 ? 0.5 : random();
        const jitterV = samples === 1 ? 0.5 : random();
        const direction = cameraRay(camera, (x + jitterU) / width, (y + jitterV) / height);
        total = total.plus(trace(scene, camera.eye, direction, { maxDepth }));
      }
      const color = total.times(sampleWeight).times(gain);
      const offset = (y * width + x) * 3;
      data[offset] = toByte(color.x);
      data[offset + 1] = toByte(color.y);
      data[offset + 2] = toByte(color.z);
    }
    onProgress?.(y + 1, height);
  }

  return { width, height, data };
}
