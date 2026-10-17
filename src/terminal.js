/**
 * Terminal renderers.
 *
 * Two modes:
 *  - `blocks`: two vertical pixels per character cell using the upper half
 *    block glyph, with a foreground colour for the top pixel and a background
 *    colour for the bottom one. This keeps the image square and looks great in
 *    any truecolor terminal.
 *  - `ascii`: one character per pixel from a luminance ramp, for terminals
 *    without 24 bit colour.
 */

/** Luminance ramp, dark to bright. */
export const ASCII_RAMP = ' .:-=+*#%@';

const UPPER_HALF_BLOCK = '\u2580';
const RESET = '\x1b[0m';

/**
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {number} perceived luminance in 0-255
 */
export function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * @param {string} text
 * @param {number} index
 * @returns {string}
 */
function rampChar(text, index) {
  const clamped = index < 0 ? 0 : index >= text.length ? text.length - 1 : index;
  return text[clamped];
}

/**
 * Render an image as an ASCII art string.
 *
 * @param {{ width: number, height: number, data: Uint8Array }} image
 * @param {{ ramp?: string, color?: boolean }} [options]
 * @returns {string}
 */
export function toAscii({ width, height, data }, { ramp = ASCII_RAMP, color = false } = {}) {
  const lines = [];
  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      if (color) {
        line += `\x1b[38;2;${r};${g};${b}m${rampChar(ramp, Math.round((luminance(r, g, b) / 255) * (ramp.length - 1)))}`;
      } else {
        line += rampChar(ramp, Math.round((luminance(r, g, b) / 255) * (ramp.length - 1)));
      }
    }
    lines.push(color ? line + RESET : line);
  }
  return lines.join('\n');
}

/**
 * Render an image with half blocks, two pixel rows per text row.
 *
 * @param {{ width: number, height: number, data: Uint8Array }} image
 * @returns {string}
 */
export function toHalfBlocks({ width, height, data }) {
  const lines = [];
  for (let row = 0; row < Math.ceil(height / 2); row++) {
    const topRow = row * 2;
    const bottomRow = Math.min(row * 2 + 1, height - 1);
    let line = '';
    for (let x = 0; x < width; x++) {
      const top = (topRow * width + x) * 3;
      const bottom = (bottomRow * width + x) * 3;
      line +=
        `\x1b[38;2;${data[top]};${data[top + 1]};${data[top + 2]}m` +
        `\x1b[48;2;${data[bottom]};${data[bottom + 1]};${data[bottom + 2]}m` +
        UPPER_HALF_BLOCK;
    }
    lines.push(line + RESET);
  }
  return lines.join('\n');
}

/**
 * Pick pixel dimensions that fit a terminal of `columns` characters while
 * keeping roughly the requested aspect ratio (width / height). Because text
 * cells are about twice as tall as they are wide, each character row holds two
 * pixel rows.
 *
 * @param {number} columns
 * @param {number} [aspect] width / height of the desired image
 * @returns {{ width: number, height: number }}
 */
export function sizeForColumns(columns, aspect = 16 / 9) {
  const width = Math.max(8, Math.floor(columns));
  const rows = Math.max(4, Math.round((width * aspect) / 2));
  return { width, height: rows * 2 };
}
