import { Vec3 } from './vec3.js';
import { albedoAt, nearestHit, occluded } from './geometry.js';

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * Trace a single ray through the scene and return its (linear) colour.
 *
 * The shading model is deliberately small: ambient + Lambert diffuse +
 * Blinn-Phong specular per light, hard shadows, and recursive mirror
 * reflections. That is enough for spheres to look like spheres.
 *
 * @param {object} scene
 * @param {Vec3} origin
 * @param {Vec3} direction unit length
 * @param {{ depth?: number, maxDepth?: number }} [options]
 * @returns {Vec3} linear-space colour, values may exceed 1
 */
export function trace(scene, origin, direction, { depth = 0, maxDepth = 4 } = {}) {
  const hit = nearestHit(scene, origin, direction);
  if (!hit) return scene.background ? scene.background(direction) : new Vec3(0.05, 0.06, 0.09);

  const { point, normal, material } = hit;

  // Emissive surfaces (the "sun", glowing orbs) just report their own colour.
  if (material.emissive) return material.emissive;

  const albedo = albedoAt(material, point, normal);
  const ambient = material.ambient ?? 0.08;
  let color = albedo.times(ambient);

  const viewDirection = direction.negate();

  for (const light of scene.lights ?? []) {
    const toLight = light.position.minus(point);
    const distance = toLight.length();
    if (distance === 0) continue;
    const lightDirection = toLight.times(1 / distance);

    const cosIncidence = normal.dot(lightDirection);
    if (cosIncidence <= 0) continue; // light is behind the surface

    // Nudge the shadow ray off the surface to avoid self-shadowing acne.
    const shadowOrigin = point.plus(normal.times(1e-3));
    if (occluded(scene, shadowOrigin, lightDirection, distance - 1e-3)) continue;

    const lightColor = light.color ?? new Vec3(1, 1, 1);
    const intensity = light.intensity ?? 1;

    color = color.plus(
      albedo.hadamard(lightColor).times(cosIncidence * intensity * (material.diffuse ?? 0.9)),
    );

    const specular = material.specular ?? 0;
    if (specular > 0) {
      const halfVector = lightDirection.plus(viewDirection).unit();
      const cosHighlight = Math.max(0, normal.dot(halfVector));
      const shininess = material.shininess ?? 32;
      color = color.plus(lightColor.times(Math.pow(cosHighlight, shininess) * specular * intensity));
    }
  }

  const reflectivity = material.reflect ?? 0;
  if (reflectivity > 0 && depth < maxDepth) {
    const reflectedDirection = direction.reflect(normal).unit();
    const reflectedOrigin = point.plus(normal.times(1e-3));
    const incoming = trace(scene, reflectedOrigin, reflectedDirection, { depth: depth + 1, maxDepth });
    color = color.times(1 - reflectivity).plus(incoming.times(reflectivity));
  }

  // Atmospheric fog makes distant geometry dissolve into the horizon colour,
  // which also hides the aliasing you get from a floor that runs to infinity.
  if (scene.fog) {
    const { near = 10, far = 60, color: fogColor = new Vec3(0.7, 0.75, 0.85) } = scene.fog;
    color = color.mix(fogColor, smoothstep(near, far, hit.t));
  }

  return color;
}
