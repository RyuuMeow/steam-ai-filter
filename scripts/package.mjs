import {copyFile, mkdir, readdir, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const destination = path.resolve(root, 'extension');
if (path.dirname(destination) !== root || path.basename(destination) !== 'extension') {
  throw new Error('Package destination must be the repository extension/ directory.');
}
async function filesIn(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not packaged: ${relative}`);
    if (entry.isDirectory()) files.push(...await filesIn(path.join(directory, entry.name), relative + '/'));
    else files.push(relative);
  }
  return files.sort();
}

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'dist/manifest.json'), 'utf8'));
if (manifest.version !== pkg.version) throw new Error('Manifest and package versions differ. Build first.');
// Only public assets and compiled source modules belong in the installable folder.
const files = [
  ...await filesIn(path.join(root, 'public')),
  ...(await filesIn(path.join(root, 'src'))).filter(file => file.endsWith('.ts')).map(file => file.replace(/\.ts$/, '.js'))
].sort();
const contents = new Map();
for (const file of files) contents.set(file, await readFile(path.join(root, 'dist', file)));

if (!process.argv.includes('--check')) {
  // The checked absolute target above is a generated folder within this repo.
  console.log(`Refreshing generated package: ${destination}`);
  await rm(destination, {recursive: true, force: true});
  for (const file of contents.keys()) {
    const target = path.join(destination, file);
    await mkdir(path.dirname(target), {recursive: true});
    // Copy the built bytes, including PNG assets, without transformations.
    await copyFile(path.join(root, 'dist', file), target);
  }
}
const packaged = await filesIn(destination);
if (JSON.stringify(packaged) !== JSON.stringify(files)) throw new Error('Package has missing or unexpected files. Run npm run package.');
for (const [file, content] of contents) {
  if (!content.equals(await readFile(path.join(destination, file)))) throw new Error(`Stale package: ${file}. Run npm run package.`);
}
console.log(`Verified extension/: v${manifest.version}, ${files.length} files, identical to the build.`);
