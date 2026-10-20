import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readReleaseInfo} from './release-info.mjs';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const extension = path.join(root, 'extension');
const artifacts = path.join(root, 'artifacts');
const info = await readReleaseInfo();
const windowsRar = path.join(process.env.ProgramFiles || 'C:/Program Files', 'WinRAR', 'Rar.exe');
const rar = process.env.RAR_BIN || (process.platform === 'win32' && existsSync(windowsRar) ? windowsRar : 'rar');

function run(args) {
  const result = spawnSync(rar, args, {cwd: extension, encoding: 'utf8', windowsHide: true});
  if (result.error) throw new Error('Cannot run RAR. Install the RAR CLI/WinRAR, or set RAR_BIN to its executable.', {cause: result.error});
  if (result.status !== 0) throw new Error(`RAR ${args[0]} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout;
}

async function filesIn(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlinks are not packaged: ${relative}`);
    if (entry.isDirectory()) files.push(...await filesIn(path.join(directory, entry.name), relative + '/'));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Unsupported package entry: ${relative}`);
  }
  return files.sort();
}

const files = await filesIn(extension);
if (!files.includes('manifest.json')) throw new Error('extension/ must contain manifest.json at its root.');
await mkdir(artifacts, {recursive: true});
const scratch = await mkdtemp(path.join(artifacts, 'rar-'));
// Only this freshly created, verified child directory is removed during cleanup.
if (path.dirname(path.resolve(scratch)) !== artifacts || !path.basename(scratch).startsWith('rar-')) {
  throw new Error('RAR scratch directory must be inside artifacts/.');
}
try {
  const archive = path.join(scratch, path.basename(info.asset));
  // Explicit relative file names preserve icons/ while avoiding an extra extension/ wrapper.
  run(['a', '-cfg-', '-idq', '-m5', '-y', archive, ...files]);
  const signature = (await readFile(archive)).subarray(0, 8).toString('hex');
  if (signature !== '526172211a070100') throw new Error('Expected a real RAR 5 archive.');
  run(['t', '-cfg-', '-idq', archive]);
  const listed = run(['lb', '-cfg-', archive]).trim().split(/\r?\n/).map(file => file.replaceAll('\\', '/')).sort();
  if (JSON.stringify(listed) !== JSON.stringify(files)) throw new Error('RAR file list differs from extension/.');

  const extracted = path.join(scratch, 'extracted');
  await mkdir(extracted);
  run(['x', '-cfg-', '-idq', '-y', archive, extracted + path.sep]);
  if (JSON.stringify(await filesIn(extracted)) !== JSON.stringify(files)) throw new Error('Extracted RAR has missing or unexpected files.');
  for (const file of files) {
    const [original, unpacked] = await Promise.all([
      readFile(path.join(extension, file)), readFile(path.join(extracted, file))
    ]);
    if (!original.equals(unpacked)) throw new Error(`RAR round-trip mismatch: ${file}`);
  }
  const destination = path.join(root, info.asset);
  await copyFile(archive, destination);
  console.log(`Verified ${info.asset}: ${files.length} plugin files, manifest.json at root, ${(await stat(destination)).size} bytes.`);
} finally {
  await rm(scratch, {recursive: true, force: true});
}
