import { readFileSync } from 'node:fs';
import { render } from './render.js';
import { getScene, listScenes, sceneNames } from './scenes.js';
import { sizeForColumns, toAscii, toHalfBlocks } from './terminal.js';
import { writeImage } from './png.js';

/** Thrown for invalid command line input; the CLI turns it into a clean message. */
export class CliError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CliError';
  }
}

const DEFAULTS = {
  scene: 'spheres',
  width: null,
  height: null,
  samples: null,
  depth: 4,
  seed: 1,
  exposure: null,
  out: null,
  color: null,
  ascii: false,
  help: false,
  list: false,
  version: false,
};

const VALUE_OPTIONS = new Map([
  ['-s', 'scene'],
  ['--scene', 'scene'],
  ['--width', 'width'],
  ['--height', 'height'],
  ['--samples', 'samples'],
  ['--depth', 'depth'],
  ['--seed', 'seed'],
  ['--exposure', 'exposure'],
  ['-o', 'out'],
  ['--out', 'out'],
]);

const FLAG_OPTIONS = new Map([
  ['-h', 'help'],
  ['--help', 'help'],
  ['-l', 'list'],
  ['--list', 'list'],
  ['-v', 'version'],
  ['--version', 'version'],
  ['--ascii', 'ascii'],
]);

/**
 * @param {string} value
 * @param {string} name
 * @param {{ min?: number, max?: number, integer?: boolean }} [rules]
 * @returns {number}
 */
function parseNumber(value, name, { min = -Infinity, max = Infinity, integer = false } = {}) {
  const number = Number(value);
  if (value === '' || value === null || !Number.isFinite(number)) {
    throw new CliError(`--${name} expects a number, got "${value}"`);
  }
  if (integer && !Number.isInteger(number)) {
    throw new CliError(`--${name} expects a whole number, got "${value}"`);
  }
  if (number < min || number > max) {
    throw new CliError(`--${name} must be between ${min} and ${max}, got ${number}`);
  }
  return number;
}

/**
 * Parse command line arguments into an options object.
 * Supports `--key value` as well as `--key=value`.
 *
 * @param {string[]} argv
 * @returns {typeof DEFAULTS}
 */
export function parseArgs(argv) {
  const options = { ...DEFAULTS };

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--') break;

    const equals = argument.indexOf('=');
    const name = equals === -1 ? argument : argument.slice(0, equals);
    const inlineValue = equals === -1 ? null : argument.slice(equals + 1);

    if (FLAG_OPTIONS.has(name)) {
      if (inlineValue !== null) throw new CliError(`option ${name} does not take a value`);
      const key = FLAG_OPTIONS.get(name);
      options[key] = true;
      continue;
    }

    if (name === '--no-color') {
      options.color = false;
      continue;
    }
    if (name === '--color') {
      options.color = true;
      continue;
    }

    const key = VALUE_OPTIONS.get(name);
    if (!key) throw new CliError(`unknown option "${argument}"`);

    let value = inlineValue;
    if (value === null) {
      if (index + 1 >= argv.length) throw new CliError(`option ${name} needs a value`);
      value = argv[++index];
    }

    switch (key) {
      case 'scene':
        options.scene = value;
        break;
      case 'width':
        options.width = parseNumber(value, 'width', { min: 1, max: 10000, integer: true });
        break;
      case 'height':
        options.height = parseNumber(value, 'height', { min: 1, max: 10000, integer: true });
        break;
      case 'samples':
        options.samples = parseNumber(value, 'samples', { min: 1, max: 64, integer: true });
        break;
      case 'depth':
        options.depth = parseNumber(value, 'depth', { min: 0, max: 12, integer: true });
        break;
      case 'seed':
        options.seed = parseNumber(value, 'seed', { min: 0, max: 2 ** 31, integer: true });
        break;
      case 'exposure':
        options.exposure = parseNumber(value, 'exposure', { min: 0.01, max: 32 });
        break;
      case 'out':
        options.out = value;
        break;
      default:
        throw new CliError(`unhandled option ${name}`);
    }
  }

  if (!sceneNames.includes(options.scene)) {
    throw new CliError(`unknown scene "${options.scene}", available: ${sceneNames.join(', ')}`);
  }

  return options;
}

/**
 * @returns {string}
 */
export function version() {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  return packageJson.version;
}

/**
 * @returns {string}
 */
export function usage() {
  const sceneLines = listScenes()
    .map((scene) => `  ${scene.name.padEnd(9)} ${scene.description}`)
    .join('\n');

  return `tiny-ray — a tiny ray tracer for your terminal

Usage
  tiny-ray [options]

Scenes
${sceneLines}

Scene options
  -s, --scene <name>    scene to render                 (default: spheres)
      --width <px>      image width                     (default: terminal width)
      --height <px>     image height                    (default: derived from 16:9)
      --samples <n>     jittered samples per pixel      (default: 2, or 4 with --out)
      --depth <n>       reflection bounces              (default: 4)
      --seed <n>        random seed; same seed, same image (default: 1)
      --exposure <x>    exposure multiplier             (default: from the scene)

Output
  -o, --out <file>      write a .png (or .ppm) file instead of the terminal
      --ascii           plain ASCII ramp, no colour
      --no-color        disable 24 bit colour
      --color           force 24 bit colour

Other
  -l, --list            list the built-in scenes
  -v, --version         print the version
  -h, --help            print this help

Examples
  tiny-ray
  tiny-ray --scene planets --width 120
  tiny-ray --scene mirror --samples 4 --out mirror.png
`;
}

/**
 * @param {typeof DEFAULTS} options
 * @param {{ isTTY?: boolean, columns?: number, env: NodeJS.ProcessEnv }} context
 * @returns {boolean}
 */
function detectColor(options, { isTTY, env }) {
  if (options.color === false) return false;
  if (options.color === true) return true;
  if (env.NO_COLOR) return false;
  if (env.FORCE_COLOR && env.FORCE_COLOR !== '0') return true;
  return Boolean(isTTY);
}

/**
 * @param {typeof DEFAULTS} options
 * @param {{ ascii?: boolean }} [context]
 * @returns {{ width: number, height: number, samples: number }}
 */
function resolveSize(options, { ascii = false } = {}) {
  const samples = options.samples ?? (options.out ? 4 : 2);

  if (options.out) {
    const width = options.width ?? 960;
    const height = options.height ?? Math.round((width * 9) / 16);
    return { width, height, samples };
  }

  const width = options.width ?? 92;
  // Half blocks pack two pixel rows into one character cell, ASCII only one.
  const defaultHeight = sizeForColumns(width).height;
  const height = options.height ?? (ascii ? Math.max(4, Math.round(defaultHeight / 2)) : defaultHeight);
  return { width, height, samples };
}

/**
 * Entry point.
 *
 * @param {string[]} argv
 * @param {{ stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream, env?: NodeJS.ProcessEnv, now?: () => number }} [io]
 * @returns {Promise<number>} process exit code
 */
export async function main(argv = [], io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const env = io.env ?? process.env;
  const now = io.now ?? (() => performance.now());

  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    if (error instanceof CliError) {
      stderr.write(`error: ${error.message}\n\nRun "tiny-ray --help" for usage.\n`);
      return 1;
    }
    throw error;
  }

  if (options.help) {
    stdout.write(usage());
    return 0;
  }
  if (options.version) {
    stdout.write(`tiny-ray v${version()}\n`);
    return 0;
  }
  if (options.list) {
    for (const scene of listScenes()) {
      stdout.write(`${scene.name.padEnd(10)} ${scene.description}\n`);
    }
    return 0;
  }

  const scene = getScene(options.scene);
  const wantsFile = Boolean(options.out);
  const color = wantsFile ? false : detectColor(options, { isTTY: stdout.isTTY, env });
  const ascii = options.ascii || !color;
  const { width, height, samples } = resolveSize(options, { ascii });
  const started = now();

  let lastPercent = -1;
  const image = render(scene, {
    width,
    height,
    samples,
    maxDepth: options.depth,
    seed: options.seed,
    exposure: options.exposure ?? undefined,
    onProgress: (row, rows) => {
      if (!options.out || !stderr.isTTY) return;
      const percent = Math.floor((row / rows) * 100);
      if (percent === lastPercent) return;
      lastPercent = percent;
      stderr.write(`\r  tracing ${String(percent).padStart(3)}%   `);
    },
  });

  const elapsed = now() - started;

  if (options.out) {
    if (stderr.isTTY) stderr.write(`\r${' '.repeat(24)}\r`);
    const format = writeImage(options.out, image);
    stderr.write(
      `wrote ${options.out} — ${width}×${height} ${format.toUpperCase()}, ` +
        `${samples} spp, ${(elapsed / 1000).toFixed(2)}s\n`,
    );
    return 0;
  }

  const text = ascii ? toAscii(image, { color: false }) : toHalfBlocks(image);
  stdout.write(`${text}\n`);
  return 0;
}
