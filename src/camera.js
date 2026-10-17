import { Vec3 } from './vec3.js';

/**
 * Build an orthonormal camera basis from an eye position and a look-at target.
 *
 * @param {object} options
 * @param {Vec3} options.eye
 * @param {Vec3} options.target
 * @param {Vec3} [options.up]
 * @param {number} [options.fov] vertical field of view in degrees
 * @param {number} [options.width]
 * @param {number} [options.height]
 * @returns {{ eye: Vec3, forward: Vec3, right: Vec3, up: Vec3, halfWidth: number, halfHeight: number }}
 */
export function makeCamera({ eye, target, up = new Vec3(0, 1, 0), fov = 45, width = 1, height = 1 }) {
  const forward = target.minus(eye).unit();
  let right = forward.cross(up);
  // Looking straight up or down makes `up` degenerate; pick another reference.
  if (right.length() < 1e-6) right = forward.cross(new Vec3(0, 0, 1));
  right = right.unit();
  const trueUp = right.cross(forward).unit();

  const halfHeight = Math.tan(((fov * Math.PI) / 180) / 2);
  const halfWidth = halfHeight * (width / height);

  return { eye, forward, right, up: trueUp, halfWidth, halfHeight };
}

/**
 * Direction of the ray through a point on the image plane.
 *
 * @param {ReturnType<typeof makeCamera>} camera
 * @param {number} u horizontal position in [0, 1], 0 is the left edge
 * @param {number} v vertical position in [0, 1], 0 is the top edge
 * @returns {Vec3} a unit direction vector
 */
export function cameraRay(camera, u, v) {
  const x = (2 * u - 1) * camera.halfWidth;
  const y = (1 - 2 * v) * camera.halfHeight;
  return camera.forward.plus(camera.right.times(x)).plus(camera.up.times(y)).unit();
}
