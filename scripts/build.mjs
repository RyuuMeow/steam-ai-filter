import {copyFile, cp, mkdir, readFile} from 'node:fs/promises';
await mkdir('dist', {recursive:true});
await cp('public', 'dist', {recursive:true});
await copyFile('LICENSE', 'dist/LICENSE');
const manifest = JSON.parse(await readFile('dist/manifest.json','utf8'));
if (manifest.permissions.join(',') !== 'storage,alarms') throw new Error('Unexpected permission');
// Keep preview and test shims outside the extension package.
if (manifest.host_permissions.join(',') !== 'https://store.steampowered.com/*') throw new Error('Unexpected host');
console.log('Built dist/: Manifest V3, local cache, Steam-only background requests.');
