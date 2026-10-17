import { Vec3 } from './vec3.js';

/** Rays closer than this to their origin are considered self-intersections. */
export const EPSILON = 1e-4;

/**
 * Ray/sphere intersection.
 *
 * @param {Vec3} origin
 * @param {Vec3} direction unit length
 * @param {Vec3} center
 * @param {number} radius
 * @param {number} [tMin]
 * @param {number} [tMax]
 * @returns {number | null} distance along the ray, or null when there is no hit
 */
export function intersectSphere(origin, direction, center, radius, tMin = EPSILON, tMax = Infinity) {
  const oc = origin.minus(center);
  const b = oc.dot(direction);
  const c = oc.dot(oc) - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return null;

  const root = Math.sqrt(discriminant);
  let t = -b - root;
  if (t <= tMin) t = -b + root; // we are inside the sphere, take the exit point
  if (t <= tMin || t >= tMax) return null;
  return t;
}

/**
 * Ray/plane intersection. Planes are infinite and double sided.
 *
 * @param {Vec3} origin
 * @param {Vec3} direction unit length
 * @param {Vec3} point any point on the plane
 * @param {Vec3} normal plane normal (need not be normalised)
 * @param {number} [tMin]
 * @param {number} [tMax]
 * @returns {number | null}
 */
export function intersectPlane(origin, direction, point, normal, tMin = EPSILON, tMax = Infinity) {
  const denominator = direction.dot(normal);
  if (Math.abs(denominator) < 1e-9) return null; // parallel
  const t = point.minus(origin).dot(normal) / denominator;
  if (t <= tMin || t >= tMax) return null;
  return t;
}

/**
 * Resolve the albedo of a material at a surface point. Materials may be
 * flat coloured, checkered, or fully procedural (a `pattern` function).
 *
 * @param {object} material
 * @param {Vec3} point
 * @param {Vec3} normal
 * @returns {Vec3}
 */
export function albedoAt(material, point, normal) {
  if (typeof material.pattern === 'function') return material.pattern(point, normal);
  if (material.checker) {
    // Laid out in the XZ plane on purpose: a floor sits exactly at y = 0, so
    // including y in the cell index would make the parity flip on rounding noise.
    const { scale = 1, colorA, colorB } = material.checker;
    const cell = Math.floor(point.x * scale) + Math.floor(point.z * scale);
    return (cell & 1) === 0 ? colorA : colorB;
  }
  return material.color ?? new Vec3(0.8, 0.8, 0.8);
}

/**
 * Closest hit between a ray and the scene.
 *
 * @param {{ objects: object[] }} scene
 * @param {Vec3} origin
 * @param {Vec3} direction
 * @param {number} [tMax]
 * @returns {{ t: number, point: Vec3, normal: Vec3, material: object, object: object } | null}
 */
export function nearestHit(scene, origin, direction, tMax = Infinity) {
  let bestT = tMax;
  let best = null;

  for (const object of scene.objects) {
    let t = null;
    if (object.kind === 'sphere') {
      t = intersectSphere(origin, direction, object.center, object.radius, EPSILON, bestT);
    } else if (object.kind === 'plane') {
      t = intersectPlane(origin, direction, object.point, object.normal, EPSILON, bestT);
    }
    if (t === null) continue;

    const point = origin.plus(direction.times(t));
    let normal =
      object.kind === 'sphere' ? point.minus(object.center).unit() : object.normal.unit();
    // Normals must face the incoming ray so that shading works from both sides.
    if (normal.dot(direction) > 0) normal = normal.negate();

    bestT = t;
    best = { t, point, normal, material: object.material, object };
  }

  return best;
}

/**
 * Is anything blocking the path from `origin` up to (but excluding) `distance`?
 *
 * @param {{ objects: object[] }} scene
 * @param {Vec3} origin
 * @param {Vec3} direction
 * @param {number} distance
 * @returns {boolean}
 */
export function occluded(scene, origin, direction, distance) {
  for (const object of scene.objects) {
    if (object.kind === 'sphere') {
      if (intersectSphere(origin, direction, object.center, object.radius, EPSILON, distance) !== null) {
        return true;
      }
    } else if (object.kind === 'plane') {
      if (intersectPlane(origin, direction, object.point, object.normal, EPSILON, distance) !== null) {
        return true;
      }
    }
  }
  return false;
}
