import {readFile,writeFile,mkdir} from 'node:fs/promises';
const read=name=>readFile(name,'utf8');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
const script=s=>`<script>${s.replaceAll('</script','<\\/script')}</script>`;
let popup=await read('dist/popup.html');
popup=popup.replace('<head>','<head>'+script(await read('tests/bridge.js')));
for(const name of ['tokens','popup'])popup=popup.replace(`<link rel="stylesheet" href="${name}.css">`,`<style>${await read(`dist/${name}.css`)}</style>`);
for(const name of ['core','popup'])popup=popup.replace(`<script src="${name}.js" defer></script>`,'');
popup=popup.replace('</body>',script(await read('dist/core.js'))+script(await read('dist/popup.js'))+'</body>');
let page=await read('tests/fixture.html');
page=page.replace('<link rel="stylesheet" href="/dist/content.css">',`<style>${await read('dist/content.css')}</style>`);
page=page.replace('src="/preview-popup.html"',`srcdoc="${escape(popup)}"`);
for(const name of ['tests/bridge','dist/core','dist/content','tests/fixture']){
  let js=await read(`${name}.js`);
  if(name==='dist/content')js=js.replace('const isSearch = /^\\/search\\/?$/.test(location.pathname);','const isSearch = true;');
  page=page.replace(`<script src="/${name}.js"></script>`,script(js));
}
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/preview.html',page);
console.log('Created standalone artifacts/preview.html');
