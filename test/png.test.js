import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, encodePNG, encodePPM, writeImage } from '../src/png.js';

const makeImage = (width = 4, height = 3) => {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < data.length; i++) data[i] = (i * 7) % 256;
  return { width, height, data };
};

/** Split a PNG buffer into its chunks. */
function readChunks(buffer) {
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const storedCrc = buffer.readUInt32BE(offset + 8 + length);
    chunks.push({ type, data, storedCrc, crcInput: buffer.subarray(offset + 4, offset + 8 + length) });
    offset += 12 + length;
  }
  return chunks;
}

test('crc32 matches a known PNG chunk checksum', () => {
  // The IEND chunk always carries this CRC; a great sanity check.
  assert.equal(crc32(Buffer.from('IEND')), 0xae426082);
});

test('encodePNG writes a valid signature and IHDR', () => {
  const image = makeImage();
  const png = encodePNG(image);

  assert.deepEqual(
    Array.from(png.subarray(0, 8)),
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  );

  const chunks = readChunks(png);
  assert.deepEqual(
    chunks.map((chunk) => chunk.type),
    ['IHDR', 'IDAT', 'IEND'],
  );

  const header = chunks[0].data;
  assert.equal(header.readUInt32BE(0), 4);
  assert.equal(header.readUInt32BE(4), 3);
  assert.equal(header[8], 8); // bit depth
  assert.equal(header[9], 2); // truecolour
  assert.equal(header[12], 0); // not interlaced
});

test('every chunk carries a correct CRC', () => {
  const chunks = readChunks(encodePNG(makeImage()));
  for (const chunk of chunks) {
    assert.equal(crc32(chunk.crcInput), chunk.storedCrc, `${chunk.type} CRC mismatch`);
  }
});

test('IDAT inflates back to the unfiltered scanlines', () => {
  const image = makeImage(5, 4);
  const chunks = readChunks(encodePNG(image));
  const raw = inflateSync(Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((c) => c.data)));

  const stride = image.width * 3;
  assert.equal(raw.length, (stride + 1) * image.height);

  for (let y = 0; y < image.height; y++) {
    const row = raw.subarray(y * (stride + 1), (y + 1) * (stride + 1));
    assert.equal(row[0], 0, 'scanlines must use the "none" filter');
    assert.deepEqual(Array.from(row.subarray(1)), Array.from(image.data.subarray(y * stride, (y + 1) * stride)));
  }
});

test('encodePNG rejects mismatched buffers', () => {
  assert.throws(() => encodePNG({ width: 2, height: 2, data: new Uint8Array(3) }), RangeError);
});

test('encodePPM writes a P6 header', () => {
  const ppm = encodePPM(makeImage(3, 2)).toString('latin1');
  assert.equal(ppm.slice(0, 11), 'P6\n3 2\n255\n');
});

test('writeImage picks the format from the extension and creates folders', () => {
  const directory = mkdtempSync(join(tmpdir(), 'tiny-ray-'));
  try {
    const nested = join(directory, 'nested', 'deeper');
    const pngPath = join(nested, 'image.png');
    const ppmPath = join(directory, 'image.ppm');

    assert.equal(writeImage(pngPath, makeImage()), 'png');
    assert.equal(writeImage(ppmPath, makeImage()), 'ppm');
    assert.ok(existsSync(pngPath));
    assert.equal(readFileSync(pngPath).subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(readFileSync(ppmPath).subarray(0, 2).toString('ascii'), 'P6');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
