import { Vec3 } from './vec3.js';
import { hash2 } from './rng.js';

const v = (x, y, z) => new Vec3(x, y, z);
const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * @typedef {object} Material
 * @property {Vec3} [color]
 * @property {Vec3} [emissive]
 * @property {{ scale: number, colorA: Vec3, colorB: Vec3 }} [checker]
 * @property {(point: Vec3, normal: Vec3) => Vec3} [pattern]
 * @property {number} [ambient]
 * @property {number} [diffuse]
 * @property {number} [specular]
 * @property {number} [shininess]
 * @property {number} [reflect]
 */

/**
 * @typedef {object} Scene
 * @property {string} name
 * @property {string} description
 * @property {{ eye: Vec3, target: Vec3, fov?: number }} camera
 * @property {number} [exposure]
 * @property {{ color: Vec3, near?: number, far?: number }} [fog]
 * @property {object[]} objects
 * @property {{ position: Vec3, color?: Vec3, intensity?: number }[]} lights
 * @property {(direction: Vec3) => Vec3} [background]
 */

/** A soft daylight sky with a warm glow around the key light. */
function daylightSky(sunDirection) {
  const zenith = v(0.07, 0.18, 0.46);
  const horizon = v(0.78, 0.85, 0.96);
  const below = v(0.5, 0.51, 0.55);
  const sunColor = v(1, 0.82, 0.55);

  return (direction) => {
    const height = direction.y;
    if (height < 0) return horizon.mix(below, clamp01(-height * 3));

    const base = horizon.mix(zenith, Math.pow(height, 0.35));
    const sun = Math.max(0, direction.unit().dot(sunDirection));
    const glow = Math.pow(sun, 900) * 3 + Math.pow(sun, 12) * 0.25;
    return base.plus(sunColor.times(glow));
  };
}

/** Deep space: a dark gradient, a faint nebula, and hashed point stars. */
function spaceSky({ sunDirection, sunColor }) {
  const deep = v(0.004, 0.005, 0.014);
  const haze = v(0.03, 0.045, 0.11);

  return (direction) => {
    const dir = direction.unit();
    let color = deep.mix(haze, clamp01(dir.y * 0.5 + 0.5));

    // Nebula: two low frequency sine fields, purple and teal.
    const nebula =
      Math.sin(dir.x * 3.1 + dir.z * 2.3) * Math.sin(dir.y * 2.7 - dir.x * 1.9) * 0.5 + 0.5;
    color = color.plus(v(0.05, 0.02, 0.08).times(Math.pow(nebula, 3)));
    color = color.plus(v(0.02, 0.04, 0.08).times(Math.pow(1 - nebula, 5)));

    // A glowing sun, if the scene has one on-screen.
    if (sunDirection) {
      const sun = Math.max(0, dir.dot(sunDirection));
      color = color.plus(sunColor.times(Math.pow(sun, 3000) * 5 + Math.pow(sun, 40) * 0.4));
    }

    // Stars: one hashed candidate per cell, jittered inside the cell.
    const u = Math.atan2(dir.z, dir.x) / (2 * Math.PI) + 0.5;
    const w = Math.asin(clamp01(dir.y * 0.5 + 0.5) * 2 - 1) / Math.PI + 0.5;
    const cells = 900;
    const gx = u * cells;
    const gy = w * cells;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const presence = hash2(ix, iy);
    if (presence > 0.991) {
      const cx = ix + hash2(ix + 17.3, iy - 4.1);
      const cy = iy + hash2(ix - 9.7, iy + 23.9);
      const distance = Math.hypot(gx - cx, gy - cy);
      const strength = Math.max(0, 1 - distance * 2.8);
      if (strength > 0) {
        const tint = hash2(iy + 3.7, ix - 8.2);
        const starColor = v(0.8, 0.86, 1).mix(v(1, 0.82, 0.66), tint);
        color = color.plus(starColor.times(strength * strength * (0.7 + tint * 1.8)));
      }
    }

    return color;
  };
}

/**
 * Classic ray tracing postcard: checkered floor, three spheres, warm key light.
 * @returns {Scene}
 */
function spheresScene() {
  const keyLight = v(-5.5, 7.5, 5);
  const sunDirection = keyLight.unit();

  return {
    name: 'spheres',
    description: 'Checkerboard floor, chrome / matte / glassy spheres, daylight sky.',
    camera: { eye: v(0, 1.45, 6.4), target: v(0, 0.92, 0), fov: 38 },
    exposure: 1.0,
    fog: { color: v(0.78, 0.85, 0.96), near: 14, far: 48 },
    objects: [
      {
        kind: 'plane',
        point: v(0, 0, 0),
        normal: v(0, 1, 0),
        material: {
          checker: { scale: 0.9, colorA: v(0.93, 0.93, 0.96), colorB: v(0.09, 0.1, 0.13) },
          ambient: 0.07,
          diffuse: 0.85,
          specular: 0.3,
          shininess: 200,
          reflect: 0.14,
        },
      },
      {
        kind: 'sphere',
        center: v(-1.9, 0.95, 0.3),
        radius: 0.95,
        material: {
          color: v(0.92, 0.93, 0.97),
          ambient: 0.02,
          diffuse: 0.18,
          specular: 0.9,
          shininess: 420,
          reflect: 0.82,
        },
      },
      {
        kind: 'sphere',
        center: v(0.15, 0.72, -0.5),
        radius: 0.72,
        material: {
          color: v(0.92, 0.16, 0.12),
          ambient: 0.05,
          diffuse: 0.9,
          specular: 0.45,
          shininess: 80,
          reflect: 0.06,
        },
      },
      {
        kind: 'sphere',
        center: v(1.95, 0.6, 0.75),
        radius: 0.6,
        material: {
          color: v(0.12, 0.42, 0.95),
          ambient: 0.05,
          diffuse: 0.75,
          specular: 0.8,
          shininess: 220,
          reflect: 0.16,
        },
      },
      {
        kind: 'sphere',
        center: v(0.95, 0.3, 1.4),
        radius: 0.3,
        material: {
          color: v(0.98, 0.78, 0.3),
          ambient: 0.05,
          diffuse: 0.65,
          specular: 0.9,
          shininess: 300,
          reflect: 0.3,
        },
      },
    ],
    lights: [
      { position: keyLight, color: v(1, 0.97, 0.92), intensity: 1.55 },
      { position: v(4.5, 3.5, 3), color: v(0.72, 0.82, 1), intensity: 0.5 },
    ],
    background: daylightSky(sunDirection),
  };
}

/**
 * A gas giant with banded clouds, two moons, and a sun off to the left.
 * @returns {Scene}
 */
function planetsScene() {
  const sunPosition = v(-9, 3.4, -13);
  const sunDirection = sunPosition.unit();

  const gasGiant = {
    color: v(0.9, 0.6, 0.3),
    ambient: 0.02,
    diffuse: 0.95,
    specular: 0.12,
    shininess: 24,
    reflect: 0.03,
    pattern: (_point, normal) => {
      const latitude = Math.asin(Math.max(-1, Math.min(1, normal.y)));
      const turbulence = Math.sin(latitude * 3.1) * 0.5 + Math.sin(latitude * 7.7 + 1.3) * 0.3;
      const band = Math.sin(latitude * 14 + turbulence) * 0.5 + 0.5;
      const grain = Math.sin(latitude * 61 + normal.x * 4) * 0.04;
      let color = v(0.98, 0.87, 0.7).mix(v(0.72, 0.32, 0.22), Math.pow(band, 1.4) + grain);
      color = color.mix(v(0.99, 0.97, 0.94), clamp01((Math.abs(normal.y) - 0.86) * 6));
      const storm = Math.max(0, Math.cos(normal.x * 9) * Math.cos(normal.y * 34 + 2));
      return color.mix(v(0.88, 0.4, 0.24), Math.pow(storm, 14) * 0.65);
    },
  };

  return {
    name: 'planets',
    description: 'Gas giant with banded clouds, moons, and a hashed starfield.',
    camera: { eye: v(0, 0.55, 7.2), target: v(0, 0.3, 0), fov: 40 },
    exposure: 1.0,
    objects: [
      { kind: 'sphere', center: v(0, 0.1, 0), radius: 1.55, material: gasGiant },
      {
        kind: 'sphere',
        center: v(2.75, 1.15, 0.4),
        radius: 0.42,
        material: {
          color: v(0.62, 0.63, 0.68),
          ambient: 0.03,
          diffuse: 0.9,
          specular: 0.1,
          shininess: 16,
          reflect: 0.05,
        },
      },
      {
        kind: 'sphere',
        center: v(-2.9, 0.5, 1.8),
        radius: 0.28,
        material: { color: v(0.35, 0.5, 0.75), ambient: 0.03, diffuse: 0.7, specular: 0.4, shininess: 60 },
      },
    ],
    lights: [
      { position: sunPosition, color: v(1, 0.95, 0.86), intensity: 2.3 },
      { position: v(6, 2, 4), color: v(0.45, 0.65, 1), intensity: 0.25 },
    ],
    background: spaceSky({ sunDirection, sunColor: v(1, 0.8, 0.5) }),
  };
}

/**
 * Synthwave sunset: a glowing sun, an infinite neon grid, and chrome.
 * @returns {Scene}
 */
function neonScene() {
  const sunDirection = v(-0.5, 0.16, -1).unit();
  const sunColor = v(1, 0.3, 0.14);

  /** Neon grid lines every two units, anti-aliased by widening them with distance. */
  const grid = (point) => {
    const radius = Math.hypot(point.x, point.z);
    const halfWidth = 0.02 + radius * 0.004;
    const toLine = (value) => {
      const scaled = value * 0.5;
      const distance = Math.abs(scaled - Math.round(scaled));
      return 1 - smoothstep(0, halfWidth, distance);
    };
    const line = Math.max(toLine(point.x), toLine(point.z));
    const fade = 1 - smoothstep(9, 30, radius);
    const base = v(0.01, 0.01, 0.024);
    return base.plus(v(0.25, 0.9, 1).times(line * fade));
  };

  const background = (direction) => {
    const dir = direction.unit();
    const up = clamp01(dir.y);
    const night = v(0.012, 0.004, 0.045);
    const dusk = v(0.5, 0.07, 0.4);
    let color = night.mix(dusk, Math.pow(1 - up, 3));

    const angle = Math.acos(Math.max(-1, Math.min(1, dir.dot(sunDirection))));
    color = color.plus(sunColor.times(Math.exp(-angle * 6) * 0.55));

    const disc = 1 - smoothstep(0.05, 0.062, angle);
    if (disc > 0) {
      // Retro sun: horizontal slices cut out of the lower half.
      const stripes = Math.sin((dir.y - sunDirection.y) * 190) > -0.2 ? 1 : 0.35;
      color = color.plus(sunColor.times(disc * 2.6 * (up < sunDirection.y ? stripes : 1)));
    }
    return color;
  };

  return {
    name: 'neon',
    description: 'Synthwave sunset over an infinite glass grid, with chrome.',
    camera: { eye: v(0, 0.95, 4.6), target: v(0, 0.85, -2), fov: 50 },
    exposure: 1.1,
    objects: [
      {
        kind: 'plane',
        point: v(0, 0, 0),
        normal: v(0, 1, 0),
        material: { pattern: grid, ambient: 0.04, diffuse: 0.4, specular: 0.8, shininess: 400, reflect: 0.35 },
      },
      {
        kind: 'sphere',
        center: v(0.95, 0.85, -0.5),
        radius: 0.85,
        material: {
          color: v(0.95, 0.95, 1),
          ambient: 0.01,
          diffuse: 0.1,
          specular: 0.95,
          shininess: 700,
          reflect: 0.9,
        },
      },
      { kind: 'sphere', center: v(-2.4, 0.34, -0.4), radius: 0.3, material: { emissive: v(3.2, 0.06, 1.1) } },
      { kind: 'sphere', center: v(2.9, 0.27, -1.1), radius: 0.26, material: { emissive: v(0.05, 2.6, 3.4) } },
    ],
    lights: [
      { position: v(-2.2, 1.6, 1.4), color: v(1, 0.3, 0.55), intensity: 2.2 },
      { position: v(3, 1.5, 0.6), color: v(0.3, 0.8, 1), intensity: 2.2 },
      { position: v(0, 3.6, 2), color: v(0.9, 0.75, 1), intensity: 0.6 },
    ],
    background,
  };
}

/** @type {Record<string, () => Scene>} */
const BUILDERS = {
  spheres: spheresScene,
  planets: planetsScene,
  neon: neonScene,
};

const cache = new Map();

/**
 * @param {string} name
 * @returns {Scene}
 */
export function getScene(name) {
  const builder = BUILDERS[name];
  if (!builder) {
    throw new RangeError(`unknown scene "${name}", try one of: ${Object.keys(BUILDERS).join(', ')}`);
  }
  if (!cache.has(name)) cache.set(name, builder());
  return cache.get(name);
}

/** @returns {{ name: string, description: string }[]} */
export function listScenes() {
  return Object.keys(BUILDERS).map((name) => {
    const scene = getScene(name);
    return { name: scene.name, description: scene.description };
  });
}

export const sceneNames = Object.keys(BUILDERS);
