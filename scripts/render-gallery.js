/**
 * Render every built-in scene into docs/, which is what the README displays.
 * Usage: node scripts/render-gallery.js
 */
import { getScene, listScenes } from '../src/scenes.js';
import { render } from '../src/render.js';
import { writeImage } from '../src/png.js';

const GALLERY = [
  { scene: 'spheres', file: 'docs/demo.png', width: 1200, height: 675, samples: 16 },
  { scene: 'planets', file: 'docs/planets.png', width: 1000, height: 563, samples: 8 },
  { scene: 'neon', file: 'docs/neon.png', width: 1000, height: 563, samples: 8 },
];

for (const { scene, file, width, height, samples } of GALLERY) {
  const started = performance.now();
  const image = render(getScene(scene), { width, height, samples, seed: 1 });
  writeImage(file, image);
  const elapsed = ((performance.now() - started) / 1000).toFixed(2);
  console.log(`${file.padEnd(18)} ${width}×${height}  ${samples} spp  ${elapsed}s`);
}

console.log(`\n${listScenes().length} scenes rendered.`);
