import {readFile,writeFile,mkdir} from 'node:fs/promises';
const read=name=>readFile(name,'utf8');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
const script=s=>`<script>${s.replaceAll('</script','<\\/script')}</script>`;
let popup=await read('dist/popup.html');
popup=popup.replace('<head>','<head>'+script(await read('tests/bridge.js')));
for(const name of ['tokens','popup'])popup=popup.replace(`<link rel="stylesheet" href="${name}.css">`,`<style>${await read(`dist/${name}.css`)}</style>`);
for(const name of ['core','popup'])popup=popup.replace(`<script src="${name}.js" defer></script>`,'');
popup=popup.replace('</body>',script(await read('dist/core.js'))+script(await read('dist/popup.js'))+'</body>');
await mkdir('artifacts',{recursive:true});
for (const mode of ['home','search']) {
  let page=await read(mode==='home'?'tests/home.html':'tests/fixture.html');
  page=page.replace('<link rel="stylesheet" href="/dist/content.css">',`<style>${await read('dist/content.css')}</style>`);
  page=page.replace('src="/preview-popup.html"',`srcdoc="${escape(popup)}"`);
  const files=mode==='home'
    ? ['tests/bridge','tests/home-setup','dist/lookup','dist/disclosure-keywords','dist/disclosure','dist/core','dist/mask','dist/layout','dist/content','tests/home']
    : ['tests/bridge','dist/lookup','dist/disclosure-keywords','dist/disclosure','dist/core','dist/mask','dist/layout','dist/content','tests/fixture'];
  for(const name of files){
    let js=await read(`${name}.js`);
    page=page.replace(`<script src="/${name}.js"></script>`,script(js));
  }
  await writeFile(`artifacts/${mode==='home'?'preview':'search-preview'}.html`,page);
}
console.log('Created standalone home and search previews in artifacts/.');
