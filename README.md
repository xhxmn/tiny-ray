<h1 align="center">tiny-ray</h1>

<p align="center">
  <em>A tiny, dependency-free ray tracer that renders to your terminal, PNG, or PPM.</em>
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Node.js >= 18" src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg">
  <img alt="Dependencies: 0" src="https://img.shields.io/badge/dependencies-0-brightgreen.svg">
</p>

![tiny-ray rendering the default "spheres" scene](docs/demo.png)

<p align="center"><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>

---

`tiny-ray` is a complete little renderer written in plain ES modules: no
dependencies, no build step, no native code. It traces spheres and planes with
hard shadows, Blinn-Phong highlights, recursive mirror reflections and
atmospheric fog — then prints the frame as truecolor half-blocks in your
terminal, or writes it to a PNG or PPM file.

It is small on purpose: about 1,300 lines of readable JavaScript, most of which
is comments and JSDoc. Everything is a plain data structure, so you can build a
scene in a few lines and render it in a few more.

## Features

- **Zero dependencies.** Nothing to install, nothing to compile.
- **Three outputs.** Truecolor ANSI (two pixel rows per character cell), plain
  ASCII, PNG (written by hand, with zlib + CRC32 chunks) and PPM.
- **Three built-in scenes.** A classic checkerboard, a banded gas giant, and a
  synthwave grid — each one is a small, tweakable data structure.
- **Real shading.** Ambient + Lambert diffuse + Blinn-Phong specular, hard
  shadow rays, recursive reflections and distance fog.
- **Procedural materials.** Flat colours, checkers, or anything you can express
  as a function of the surface point.
- **Deterministic.** Jittered sampling is seeded, so the same seed always
  produces the exact same image — screenshots and tests never drift.
- **Tested.** 57 tests with the built-in `node:test` runner, plus a CI workflow.

## Requirements

Node.js 18 or newer. That is the whole list.

## Quick start

```bash
git clone https://github.com/<your-name>/tiny-ray.git
cd tiny-ray

# Render the default scene into your terminal
node bin/tiny-ray.js

# Or write a 1200×675 image
node bin/tiny-ray.js --scene neon --width 1200 --height 675 --samples 8 --out neon.png
```

Optionally expose the `tiny-ray` command:

```bash
npm link        # then just: tiny-ray --scene planets
```

## Usage

```
tiny-ray [options]

Scenes
  spheres   Checkerboard floor, chrome / matte / glassy spheres, daylight sky.
  planets   Gas giant with banded clouds, moons, and a hashed starfield.
  neon      Synthwave sunset over an infinite glass grid, with chrome.

Scene options
  -s, --scene <name>    scene to render                    (default: spheres)
      --width <px>      image width                        (default: terminal width)
      --height <px>     image height                       (default: derived from 16:9)
      --samples <n>     jittered samples per pixel         (default: 2, or 4 with --out)
      --depth <n>       reflection bounces                 (default: 4)
      --seed <n>        random seed; same seed, same image (default: 1)
      --exposure <x>    exposure multiplier                (default: from the scene)

Output
  -o, --out <file>      write a .png (or .ppm) file instead of the terminal
      --ascii           plain ASCII ramp, no colour
      --no-color        disable 24 bit colour
      --color           force 24 bit colour

Other
  -l, --list            list the built-in scenes
  -v, --version         print the version
  -h, --help            print this help
```

### A few examples

```bash
# Quick preview in the terminal (half blocks, 24 bit colour)
node bin/tiny-ray.js --width 100

# ASCII art for a monochrome terminal or a log file
node bin/tiny-ray.js --scene planets --ascii --width 80

# A high quality still, 12 bounces deep
node bin/tiny-ray.js --scene spheres --width 1600 --height 900 --samples 16 --depth 12 --out sphere.png

# Programmatic output format, no CLI
node -e "import('./src/index.js').then(m => m.writeImage('x.ppm', m.render(m.getScene('neon'), { width: 320, height: 180 })))"
```

`--out` creates missing directories and picks PNG or PPM from the extension
(anything that is not `.ppm` becomes a PNG).

## Scenes

| Scene     | What is in it                                                              |
| --------- | -------------------------------------------------------------------------- |
| `spheres` | Infinite checkered floor, a chrome sphere, matte and glossy neighbours, daylight sky, fog. |
| `planets` | A banded gas giant with procedural clouds, two moons, hashed stars, a low sun. |
| `neon`    | Synthwave sunset, emissive orbs and a mirror floor with an infinite neon grid. |

<p align="center">
  <img src="docs/planets.png" width="49%" alt="planets scene: a banded gas giant and two moons">
  <img src="docs/neon.png" width="49%" alt="neon scene: synthwave sun over a grid floor">
</p>

All three previews are rendered by the project itself:

```bash
node scripts/render-gallery.js
```

## Programmatic API

```js
import { Vec3, render, writeImage } from './src/index.js';

const scene = {
  camera: { eye: new Vec3(0, 1.3, 5), target: new Vec3(0, 0.85, 0), fov: 42 },
  objects: [
    {
      kind: 'plane',
      point: new Vec3(0, 0, 0),
      normal: new Vec3(0, 1, 0),
      material: {
        checker: { scale: 1, colorA: new Vec3(0.9, 0.9, 0.92), colorB: new Vec3(0.12, 0.13, 0.16) },
        ambient: 0.08, diffuse: 0.85, specular: 0.3, shininess: 180, reflect: 0.2,
      },
    },
    {
      kind: 'sphere',
      center: new Vec3(0, 0.9, 0),
      radius: 0.9,
      material: { color: new Vec3(0.2, 0.55, 0.75), ambient: 0.05, diffuse: 0.6,
                  specular: 0.9, shininess: 350, reflect: 0.35 },
    },
  ],
  lights: [{ position: new Vec3(3, 5, 4), intensity: 1.8 }],
  background: () => new Vec3(0.55, 0.7, 0.92),
  fog: { color: new Vec3(0.72, 0.8, 0.93), near: 18, far: 55 },
  exposure: 1.0,
};

const image = render(scene, { width: 800, height: 450, samples: 8, seed: 1 });
writeImage('custom.png', image); // PNG, or .ppm for PPM
```

The full, runnable version lives in [`examples/custom-scene.js`](examples/custom-scene.js):

```bash
node examples/custom-scene.js
```

### Scene structure

| Field | Type | Notes |
| --- | --- | --- |
| `camera.eye`, `camera.target` | `Vec3` | Where the camera is and what it looks at. |
| `camera.fov` | `number` | Vertical field of view in degrees. |
| `objects[]` | `object[]` | `{ kind: 'sphere', center, radius, material }` or `{ kind: 'plane', point, normal, material }`. Planes are infinite and double sided. |
| `lights[]` | `object[]` | `{ position, color?, intensity? }`. Point lights with hard shadows. |
| `background` | `(direction: Vec3) => Vec3` | Colour returned by rays that escape. |
| `fog` | `{ color, near?, far? }` | Optional. Blends surfaces towards `color` with distance. |
| `exposure` | `number` | Optional multiplier applied before tone mapping. |

### Materials

| Field | Meaning |
| --- | --- |
| `color` | Base albedo, a `Vec3` in roughly `0..1`. |
| `emissive` | If set, the surface ignores lighting and returns this colour (suns, neon bulbs). |
| `checker` | `{ scale, colorA, colorB }`, a checkerboard laid out in the XZ plane. |
| `pattern` | `(point, normal) => Vec3`, for anything procedural. Takes precedence over `checker`. |
| `ambient` | Flat fill light. Default `0.08`. |
| `diffuse` | Lambert weight. Default `0.9`. |
| `specular`, `shininess` | Blinn-Phong highlight weight and exponent. |
| `reflect` | `0..1` mirror weight; reflections recurse up to `maxDepth`. |

### `render(scene, options)`

| Option | Default | Meaning |
| --- | --- | --- |
| `width`, `height` | `320`, `180` | Output size in pixels. |
| `samples` | `2` | Jittered samples per pixel. One sample means no anti-aliasing. |
| `maxDepth` | `4` | Maximum reflection bounces. |
| `seed` | `1` | PRNG seed. The same seed and options give byte-identical output. |
| `exposure` | scene value | Overrides `scene.exposure`. |
| `onProgress` | — | `(row, rows) => void`, called after each scanline. |

It returns `{ width, height, data }` where `data` is a row-major `Uint8Array` of
RGB triples.

## How it works

1. **Camera.** An orthonormal basis is built from eye, target and up. Each pixel
   gets a ray jittered inside the pixel, which is what `--samples` averages.
2. **Intersection.** Spheres are solved with the quadratic formula; planes with
   a dot product. The nearest positive hit wins, and its normal is flipped to
   face the incoming ray.
3. **Shading.** Ambient, then for every light a shadow ray plus Lambert diffuse
   and a Blinn-Phong specular lobe. Reflective materials recurse with the
   mirrored direction.
4. **Fog.** Surface colour is blended towards the fog colour by distance — this
   is also what hides the aliasing of a floor that runs to the horizon.
5. **Tone mapping.** Values below `0.8` are linear; above that a smooth
   exponential shoulder rolls highlights off towards white instead of clipping.
   Then a `1/2.2` gamma.
6. **Output.** The RGB buffer becomes half-block characters (one foreground and
   one background colour per cell), an ASCII ramp, or a PNG built from scratch:
   signature, `IHDR`, deflated `IDAT`, `IEND`, each with a CRC32.

## Project layout

```
tiny-ray/
├── bin/tiny-ray.js        # executable entry point
├── src/
│   ├── cli.js             # argument parsing, usage, progress and output
│   ├── render.js          # pixel loop, sampling, tone mapping
│   ├── tracer.js          # shading, shadows, reflections, fog
│   ├── geometry.js        # ray/sphere, ray/plane, nearest hit, materials
│   ├── camera.js          # camera basis and ray generation
│   ├── scenes.js          # the three built-in scenes
│   ├── terminal.js        # half-block and ASCII renderers
│   ├── png.js             # PNG/PPM encoders, CRC32
│   ├── rng.js             # seeded PRNG and hash
│   ├── vec3.js            # the vector type
│   └── index.js           # public API
├── scripts/render-gallery.js
├── examples/custom-scene.js
├── test/                  # 57 tests, node:test
└── docs/                  # preview images used by this README
```

## Development

```bash
npm test                     # run the test suite (node --test)
node scripts/render-gallery.js   # re-render every image in docs/
```

Node's test runner needs no configuration or dependencies — `npm install` is not
required to develop or run this project.

### Performance

Rendering is single-threaded JavaScript and takes roughly 0.5–1 µs per sample,
including the shadow and reflection rays a sample spawns. The README images take:

| Image | Size | Samples | Time |
| --- | --- | --- | --- |
| `docs/demo.png` | 1200×675 | 16 | ~11 s |
| `docs/planets.png` | 1000×563 | 8 | ~2 s |
| `docs/neon.png` | 1000×563 | 8 | ~3 s |

A 100×56 terminal preview is sub-second.

## Publishing this repository

Everything is ready to push — only the URLs are placeholders.

1. Create an empty repository on GitHub, for example `tiny-ray`.
2. Push it:
   ```bash
   git remote add origin https://github.com/<your-name>/tiny-ray.git
   git push -u origin main
   ```
3. The workflow in `.github/workflows/ci.yml` runs on the first push. Once it is
   green, add the badge at the top of this README:
   ```markdown
   [![CI](https://github.com/<your-name>/tiny-ray/actions/workflows/ci.yml/badge.svg)](https://github.com/<your-name>/tiny-ray/actions/workflows/ci.yml)
   ```
4. Optional: `npm publish` works as-is (`bin`, `files` and `exports` are set).

## License

[MIT](LICENSE) — do whatever you like with it.
