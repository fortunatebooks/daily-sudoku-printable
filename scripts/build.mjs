import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(src, dist, { recursive: true });
await copyFile(path.join(dist, 'index.html'), path.join(dist, '404.html'));
await writeFile(
  path.join(dist, 'build.json'),
  JSON.stringify({ built_at: new Date().toISOString() }, null, 2)
);

console.log(`Built ${dist}`);
