import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'wamp_deploy');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

await cp(join(root, 'dist', 'index.html'), join(output, 'index.html'));
await cp(join(root, 'api'), join(output, 'api'), { recursive: true });
await cp(join(root, 'sql'), join(output, 'sql'), { recursive: true });
await cp(join(root, 'INSTALLATION.md'), join(output, 'INSTALLATION.md'));

const builtHtml = await readFile(join(output, 'index.html'), 'utf8');
if (!builtHtml.includes('<script') || !builtHtml.includes('<style')) {
  throw new Error("Le build n'est pas autonome : JavaScript ou CSS n'est pas intégré à index.html.");
}

const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else files.push(absolute.slice(output.length + 1).replaceAll('\\', '/'));
  }
}
await walk(output);
await writeFile(join(output, 'PACKAGE.txt'), [
  'Bar POS v4.2 — Package WAMP',
  `Généré le ${new Date().toISOString()}`,
  '',
  ...files.sort(),
  '',
].join('\n'));

console.log(`Package WAMP créé dans ${output}`);
