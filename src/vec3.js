/**
 * A tiny immutable 3-component vector.
 *
 * Every operation returns a new Vec3, which keeps the tracer free of aliasing
 * bugs at the cost of a few extra allocations. For a hobby renderer that is a
 * very good trade.
 */
export class Vec3 {
  /**
   * @param {number} [x]
   * @param {number} [y]
   * @param {number} [z]
   */
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {Vec3}
   */
  static of(x, y, z) {
    return new Vec3(x, y, z);
  }

  /**
   * Accepts `[x, y, z]`, `{ x, y, z }` or a `Vec3`.
   * @param {Vec3 | number[] | { x: number, y: number, z: number }} value
   * @returns {Vec3}
   */
  static from(value) {
    if (Array.isArray(value)) return new Vec3(value[0], value[1], value[2]);
    if (value && typeof value === 'object' && 'x' in value) {
      return new Vec3(value.x, value.y, value.z);
    }
    throw new TypeError('Cannot convert value to Vec3');
  }

  /**
   * @param {Vec3} a
   * @param {Vec3} b
   * @param {number} t
   * @returns {Vec3}
   */
  static mix(a, b, t) {
    return a.mix(b, t);
  }

  /** @param {Vec3} other @returns {Vec3} */
  plus(other) {
    return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  /** @param {Vec3} other @returns {Vec3} */
  minus(other) {
    return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  /** @param {number} scalar @returns {Vec3} */
  times(scalar) {
    return new Vec3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  /** Component-wise product, useful for multiplying colours. @param {Vec3} other @returns {Vec3} */
  hadamard(other) {
    return new Vec3(this.x * other.x, this.y * other.y, this.z * other.z);
  }

  /** @param {Vec3} other @returns {number} */
  dot(other) {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  /** @param {Vec3} other @returns {Vec3} */
  cross(other) {
    return new Vec3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
    );
  }

  /** @returns {number} */
  length() {
    return Math.hypot(this.x, this.y, this.z);
  }

  /** @returns {Vec3} a unit vector, or the zero vector if this one has no length */
  unit() {
    const len = this.length();
    return len > 0 ? this.times(1 / len) : new Vec3();
  }

  /** @returns {Vec3} */
  negate() {
    return new Vec3(-this.x, -this.y, -this.z);
  }

  /**
   * Mirror this vector around the surface normal `n` (which must be unit length).
   * @param {Vec3} n @returns {Vec3}
   */
  reflect(n) {
    return this.minus(n.times(2 * this.dot(n)));
  }

  /**
   * Linear interpolation towards `other`.
   * @param {Vec3} other @param {number} t @returns {Vec3}
   */
  mix(other, t) {
    return new Vec3(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t,
      this.z + (other.z - this.z) * t,
    );
  }

  /**
   * Clamp every component into [lo, hi].
   * @param {number} [lo] @param {number} [hi] @returns {Vec3}
   */
  clip(lo = 0, hi = 1) {
    const clamp = (v) => (v < lo ? lo : v > hi ? hi : v);
    return new Vec3(clamp(this.x), clamp(this.y), clamp(this.z));
  }

  /** @returns {[number, number, number]} */
  toArray() {
    return [this.x, this.y, this.z];
  }

  /** @returns {string} */
  toString() {
    return `Vec3(${this.x}, ${this.y}, ${this.z})`;
  }
}

/** @param {number} value @param {number} lo @param {number} hi @returns {number} */
export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}
