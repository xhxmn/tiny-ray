import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * A minimal PNG encoder: 8-bit truecolour (RGB), no filtering, no interlacing.
 * Roughly 60 lines instead of a dependency, which is the whole point of this
 * project.
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * @param {Buffer} buffer
 * @returns {number}
 */
export function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * @param {string} type four ASCII characters, e.g. "IHDR"
 * @param {Buffer} data
 * @returns {Buffer}
 */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, checksum]);
}

/**
 * Encode an RGB image as a PNG buffer.
 *
 * @param {{ width: number, height: number, data: Uint8Array }} image
 * @param {{ compressionLevel?: number }} [options]
 * @returns {Buffer}
 */
export function encodePNG({ width, height, data }, { compressionLevel = 9 } = {}) {
  if (data.length !== width * height * 3) {
    throw new RangeError(`expected ${width * height * 3} bytes of RGB data, got ${data.length}`);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour RGB
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  // Each scanline is prefixed with its filter type (0 = none).
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const target = y * (stride + 1);
    raw[target] = 0;
    for (let i = 0; i < stride; i++) raw[target + 1 + i] = data[y * stride + i];
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: compressionLevel })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Plain-text PPM (P6), for when you do not want a PNG.
 * @param {{ width: number, height: number, data: Uint8Array }} image
 * @returns {Buffer}
 */
export function encodePPM({ width, height, data }) {
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`, 'ascii');
  return Buffer.concat([header, Buffer.from(data)]);
}

/**
 * Write an image to disk, picking the format from the file extension.
 * @param {string} filePath
 * @param {{ width: number, height: number, data: Uint8Array }} image
 * @returns {string} the format that was written
 */
export function writeImage(filePath, image) {
  mkdirSync(dirname(filePath), { recursive: true });
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.ppm')) {
    writeFileSync(filePath, encodePPM(image));
    return 'ppm';
  }
  writeFileSync(filePath, encodePNG(image));
  return 'png';
}
