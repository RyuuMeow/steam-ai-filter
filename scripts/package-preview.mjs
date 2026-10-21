import {readFile,writeFile,mkdir} from 'node:fs/promises';
const read=name=>readFile(name,'utf8');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;');
const script=s=>`<script>${s.replaceAll('</script','<\\/script')}</script>`;
const eyeData=`data:image/svg+xml;base64,${(await readFile('dist/icons/eye.svg')).toString('base64')}`;
let popup=await read('dist/popup.html');
popup=popup.replace('<head>','<head>'+script(await read('tests/bridge.js')));
for(const name of ['tokens','popup'])popup=popup.replace(`<link rel="stylesheet" href="${name}.css">`,`<style>${await read(`dist/${name}.css`)}</style>`);
const popupScripts=['i18n','disclosure-keywords','disclosure','core','popup'];
for(const name of popupScripts)popup=popup.replace(`<script src="${name}.js" defer></script>`,'');
popup=popup.replace('</body>',(await Promise.all(popupScripts.map(async name=>script(await read(`dist/${name}.js`))))).join('')+'</body>');
popup=popup.replace('src="icons/settings.svg"',`src="data:image/svg+xml;base64,${(await readFile('dist/icons/settings.svg')).toString('base64')}"`);
await mkdir('artifacts',{recursive:true});
for (const mode of ['automation','home','search']) {
  let page=await read(mode==='automation'?'tests/automation.html':mode==='home'?'tests/home.html':'tests/fixture.html');
  page=page.replace('<link rel="stylesheet" href="/dist/content.css">',`<style>${await read('dist/content.css')}</style>`);
  page=page.replace('data-preview="/preview-popup.html"',`srcdoc="${escape(popup)}"`);
  page=page.replace('src="/dist/icons/icon32.png"',`src="data:image/png;base64,${(await readFile('dist/icons/icon32.png')).toString('base64')}"`);
  const files=mode==='automation'
    ? ['tests/bridge','dist/i18n','dist/lookup','dist/disclosure-keywords','dist/disclosure','dist/core','dist/ignore','tests/automation-setup','dist/mask','dist/layout','dist/content','tests/automation']
    : mode==='home'
    ? ['tests/bridge','tests/home-setup','dist/i18n','dist/lookup','dist/disclosure-keywords','dist/disclosure','dist/core','dist/mask','dist/layout','dist/content','tests/home']
    : ['tests/bridge','dist/i18n','dist/lookup','dist/disclosure-keywords','dist/disclosure','dist/core','dist/mask','dist/layout','dist/content','tests/fixture'];
  for(const name of files){
    let js=await read(`${name}.js`);
    if(name==='tests/bridge')js=js.replace("getURL:path=>'/dist/'+path",`getURL:path=>path==='icons/eye.svg'?'${eyeData}':'/dist/'+path`);
    page=page.replace(`<script src="/${name}.js"></script>`,script(js));
  }
  await writeFile(`artifacts/${mode==='automation'?'preview':mode==='home'?'home-preview':'search-preview'}.html`,page);
}
console.log('Created standalone current, home and search previews in artifacts/.');
