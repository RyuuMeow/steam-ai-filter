// Real resolver, synthetic HTTP responses. No external requests or credentials.
void chrome.storage.local.set({mode:'off'});
window.lookupCalls=[];
const makeHTML=(id,disclosure)=>`<html><head><meta property="og:url" content="https://store.steampowered.com/app/${id}/"></head><body>
<div id="appHubAppName">Fixture</div><div id="game_area_description">About This Game</div>
${disclosure?`<div id="game_area_content_descriptors"><h2>AI Generated Content Disclosure</h2><p><i>Artwork was generated with AI.</i></p></div>`:''}
</body></html>`;
window.testResolver=new SAFLookup.Resolver({
  load:async()=>(await chrome.storage.local.get('disclosureCache')).disclosureCache,
  save:data=>chrome.storage.local.set({disclosureCache:data}),
  gap:20,
  fetch:async url=>{
    const id=url.match(/app\/(\d+)/)[1];lookupCalls.push(id);
    await new Promise(r=>setTimeout(r,100));
    return new Response(id==='503'?'Age verification':makeHTML(id,id==='501'||id==='504'),{headers:{'Content-Type':'text/html'}});
  }
});
window.testLookup=id=>testResolver.get(id);
window.testClearCache=()=>testResolver.clear();
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&changes.mode)testResolver.setEnabled(changes.mode.newValue!=='off');
});
document.addEventListener('click',event=>{if(event.target.closest('a'))event.preventDefault();});
