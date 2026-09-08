import { readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { Script } from 'node:vm';
// Single-entry Vite bundle has no module imports. Validate it as a classic script
// so the delivered folder can also be opened directly through file:// offline.
const files = await readdir('dist/assets');
const js = files.filter((f) => f.endsWith('.js'));
if (js.length !== 1)
  throw new Error('Portable output requires exactly one JavaScript bundle.');
new Script(await readFile(`dist/assets/${js[0]}`, 'utf8'));
let html = await readFile('dist/index.html', 'utf8');
html = html
  .replace('type="module" crossorigin', 'defer')
  .replaceAll(' crossorigin', '');
await writeFile('dist/index.html', html);
await writeFile('dist/index.heml', html);
await copyFile('README.md', 'dist/README.md');
console.log(
  'Portable index.html and requested index.heml are ready. No runtime CDN dependencies.',
);
