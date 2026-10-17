import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliError, main, parseArgs } from '../src/cli.js';

/** A fake writable stream that records everything written to it. */
function output({ isTTY = false, columns = 80 } = {}) {
  const chunks = [];
  return {
    chunks,
    isTTY,
    columns,
    write(chunk) {
      chunks.push(String(chunk));
      return true;
    },
    get text() {
      return chunks.join('');
    },
  };
}

const io = ({ stdout = output(), stderr = output(), env = {} } = {}) => ({ stdout, stderr, env });

test('parseArgs fills in defaults', () => {
  const options = parseArgs([]);
  assert.equal(options.scene, 'spheres');
  assert.equal(options.width, null);
  assert.equal(options.samples, null);
  assert.equal(options.depth, 4);
  assert.equal(options.seed, 1);
  assert.equal(options.out, null);
  assert.equal(options.help, false);
});

test('parseArgs supports both "--key value" and "--key=value"', () => {
  const spaced = parseArgs(['--scene', 'neon', '--width', '80', '--samples', '3']);
  const equals = parseArgs(['--scene=neon', '--width=80', '--samples=3']);
  assert.equal(spaced.scene, 'neon');
  assert.equal(spaced.width, 80);
  assert.equal(spaced.samples, 3);
  assert.deepEqual(equals, spaced);
});

test('parseArgs handles short flags and colour switches', () => {
  assert.equal(parseArgs(['-s', 'planets']).scene, 'planets');
  assert.equal(parseArgs(['-o', 'out.png']).out, 'out.png');
  assert.equal(parseArgs(['-l']).list, true);
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['--no-color']).color, false);
  assert.equal(parseArgs(['--color']).color, true);
  assert.equal(parseArgs(['--ascii']).ascii, true);
});

test('parseArgs rejects invalid input', () => {
  assert.throws(() => parseArgs(['--nope']), CliError);
  assert.throws(() => parseArgs(['--width']), /needs a value/);
  assert.throws(() => parseArgs(['--width', '0']), /between/);
  assert.throws(() => parseArgs(['--width', '3.5']), /whole number/);
  assert.throws(() => parseArgs(['--samples', 'many']), /expects a number/);
  assert.throws(() => parseArgs(['--depth', '99']), /between/);
  assert.throws(() => parseArgs(['--scene', 'nope']), /unknown scene/);
  assert.throws(() => parseArgs(['--help=1']), /does not take a value/);
});

test('--help prints usage and exits cleanly', async () => {
  const out = output();
  assert.equal(await main(['--help'], io({ stdout: out })), 0);
  assert.match(out.text, /Usage/);
  assert.match(out.text, /--scene <name>/);
});

test('--version prints the package version', async () => {
  const out = output();
  assert.equal(await main(['--version'], io({ stdout: out })), 0);
  assert.match(out.text, /^tiny-ray v\d+\.\d+\.\d+\n$/);
});

test('--list prints every scene', async () => {
  const out = output();
  assert.equal(await main(['--list'], io({ stdout: out })), 0);
  for (const name of ['spheres', 'planets', 'neon']) {
    assert.ok(out.text.includes(name), `missing ${name}`);
  }
});

test('invalid arguments exit with a message and a non-zero code', async () => {
  const err = output();
  assert.equal(await main(['--scene', 'nope'], io({ stderr: err })), 1);
  assert.match(err.text, /unknown scene/);
  assert.match(err.text, /--help/);
});

test('ASCII mode is used for non TTY output', async () => {
  const out = output();
  assert.equal(
    await main(['--scene', 'spheres', '--width', '12', '--height', '6', '--samples', '1'], io({ stdout: out })),
    0,
  );
  const lines = out.text.trimEnd().split('\n');
  assert.equal(lines.length, 6);
  assert.equal(lines[0].length, 12);
  assert.ok(!out.text.includes('\x1b['), 'no ANSI codes without a TTY');
  assert.ok(out.text.endsWith('\n'));
});

test('--color forces half blocks and --no-color disables colour', async () => {
  const colored = output({ isTTY: true });
  await main(['--scene', 'neon', '--width', '8', '--height', '6', '--samples', '1', '--color'], io({ stdout: colored }));
  const lines = colored.text.trimEnd().split('\n');
  assert.equal(lines.length, 3); // two pixel rows per line
  assert.ok(colored.text.includes('\x1b[38;2;'));
  assert.ok(colored.text.includes('\u2580'));

  const plain = output({ isTTY: true });
  await main(['--scene', 'neon', '--width', '8', '--height', '6', '--samples', '1', '--no-color'], io({ stdout: plain }));
  assert.ok(!plain.text.includes('\x1b['));
});

test('--out writes a PNG file', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tiny-ray-cli-'));
  try {
    const file = join(directory, 'shots', 'scene.png');
    const stdout = output();
    const stderr = output();

    const code = await main(
      ['--scene', 'planets', '--width', '16', '--height', '9', '--samples', '1', '--out', file],
      io({ stdout, stderr }),
    );

    assert.equal(code, 0);
    assert.ok(existsSync(file));
    assert.equal(readFileSync(file).subarray(1, 4).toString('ascii'), 'PNG');
    assert.match(stderr.text, /wrote/);
    assert.equal(stdout.text, '', 'nothing should be printed to stdout when writing a file');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('--out writes a PPM when asked for one', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tiny-ray-cli-'));
  try {
    const file = join(directory, 'scene.ppm');
    assert.equal(
      await main(['--width', '8', '--height', '6', '--samples', '1', '--out', file], io()),
      0,
    );
    assert.equal(readFileSync(file).subarray(0, 2).toString('ascii'), 'P6');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('--seed changes the result but the same seed is reproducible', async () => {
  const render = async (seed) => {
    const out = output();
    await main(['--scene', 'neon', '--width', '10', '--height', '6', '--samples', '2', '--seed', seed], io({ stdout: out }));
    return out.text;
  };
  assert.equal(await render('1'), await render('1'));
  assert.notEqual(await render('1'), await render('2'));
});
