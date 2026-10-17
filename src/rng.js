/**
 * Deterministic, seedable pseudo random numbers.
 *
 * Rendering must be reproducible: the same seed must always produce the same
 * image, otherwise tests and documentation screenshots would drift.
 */

/**
 * Mulberry32: 32 bits of state, good enough for jittering camera rays.
 * @param {number} seed
 * @returns {() => number} a function returning numbers in [0, 1)
 */
export function mulberry32(seed = 1) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash two integers into [0, 1). Used for procedural stars, so that the
 * background is stable for a given direction instead of flickering per sample.
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
