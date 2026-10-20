import {appendFile, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

export function validateReleaseVersion(versions, tag) {
  const version = versions[0];
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('Release version must have three numeric components, for example 0.7.1.');
  }
  const components = version.split('.').map(Number);
  if (components.some(value => value > 65535) || components.every(value => value === 0)) {
    throw new Error('Release version must be a valid Chrome extension version.');
  }
  if (versions.some(value => value !== version)) {
    throw new Error('Versions differ between package.json, package-lock.json and the public/extension manifests.');
  }
  if (tag !== undefined && tag !== `v${version}`) {
    throw new Error(`Release tag must be v${version}; received ${JSON.stringify(tag)}.`);
  }
  return {version, tag: `v${version}`, asset: `artifacts/steam-ai-filter-v${version}.rar`};
}

export async function readReleaseInfo(tag) {
  const [pkg, lock, manifest, packaged] = await Promise.all(
    ['package.json', 'package-lock.json', 'public/manifest.json', 'extension/manifest.json']
      .map(async file => JSON.parse(await readFile(path.join(root, file), 'utf8')))
  );
  return validateReleaseVersion([pkg.version, lock.version, lock.packages?.['']?.version, manifest.version, packaged.version], tag);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tag = process.argv[2];
  if (!tag) throw new Error('Provide a release tag: npm run release:check -- v0.7.1');
  const info = await readReleaseInfo(tag);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `version=${info.version}\nasset=${info.asset}\n`);
  }
  console.log(`Verified ${info.tag}; release asset: ${info.asset}`);
}
