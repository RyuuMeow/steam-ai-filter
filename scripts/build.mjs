import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
await mkdir('dist', {recursive:true});
await cp('public', 'dist', {recursive:true});
const manifest = JSON.parse(await readFile('dist/manifest.json','utf8'));
if (manifest.permissions.join(',') !== 'storage') throw new Error('Unexpected permission');
// Keep preview and test shims outside the extension package.
console.log('Built dist/: Manifest V3, storage only, Steam home/search/app scopes.');
