import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { install } from '../src/install.js';
import { writeJson } from '../src/config.js';

const toolkit = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(toolkit, 'examples', 'figma-sample');
export const sampleRoot = path.join(toolkit, '.sample-project', 'Fidelity sample 测试');
await fs.mkdir(path.join(sampleRoot, 'design'), { recursive: true });
for (const file of ['index.html', 'styles.css']) {
  await fs.copyFile(path.join(source, file), path.join(sampleRoot, file), fs.constants.COPYFILE_EXCL).catch(e => { if (e.code !== 'EEXIST') throw e; });
}
await fs.copyFile(path.join(source, 'reference.png'), path.join(sampleRoot, 'design', 'reference.png'), fs.constants.COPYFILE_EXCL).catch(e => { if (e.code !== 'EEXIST') throw e; });
for (const weight of [400, 700]) await fs.copyFile(path.join(toolkit, 'node_modules', '@fontsource', 'inter', 'files', `inter-latin-${weight}-normal.woff2`), path.join(sampleRoot, `inter-${weight}.woff2`));
try { await fs.access(path.join(sampleRoot, 'fidelity.config.json')); }
catch (e) {
  if (e.code !== 'ENOENT') throw e;
  const design = JSON.parse(await fs.readFile(path.join(source, 'design.json'), 'utf8'));
  await install(sampleRoot, { url: 'http://127.0.0.1:4177', ...design.viewport });
  await writeJson(path.join(sampleRoot, 'fidelity.config.json'), {
    version: 1, maxIterations: 5,
    screens: [{ name: 'desktop', url: 'http://127.0.0.1:4177', reference: 'design/reference.png', viewport: design.viewport,
      readySelector: '#cards', requiredFonts: ['Inter'], maxMismatchPercent: 2, tolerancePx: 1,
      regions: design.regions.map(r => ({ ...r, maxMismatchPercent: 3 })) }]
  });
}
console.log(`Sample application: ${sampleRoot}`);
