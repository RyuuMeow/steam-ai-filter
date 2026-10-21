testBridge.data.mode = 'hide';
const art = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
// Semantic wrappers and eight-deep slide nesting observed on the user's Next Fest tab.
function expandedRow(id, match) {
  const row = document.createElement('div'); row.className = 'SaleSectionContainer ItemCount_1'; row.dataset.fixtureRow = id;
  row.innerHTML = `<div><div class="LibraryAssetExpandedDisplay"><div class="ImpressionTrackedElement"><div class="expanded-content">
  <div class="cover-column"><div><a href="https://store.steampowered.com/app/${id}/" data-ds-tagids="${match ? '[7926]' : '[19]'}"><img src="${art}" alt="Game ${id}"></a></div></div>
  <div class="details"><p>Game ${id}<br>遊戲說明與發行資訊</p><div><img src="${art}" data-image-url="https://shared.fastly.steamstatic.com/steam/apps/257450032/movie.jpg" alt="Trailer"></div>
  <footer><span>Windows · 發行日期</span><button>安裝試玩版</button></footer></div>
  </div></div></div></div>`;
  if(match) {
    const now=Date.now(), cache=testBridge.data.disclosureCache||{version:1,sessionAware:true,items:{}};
    void chrome.storage.local.set({disclosureCache:{...cache,items:{...cache.items,[id]:{state:'disclosed',disclosure:'AI artwork.',checkedAt:now,expiresAt:now+86400000}}}});
  }
  return row;
}
document.querySelector('#rows').append(expandedRow('801',true), expandedRow('802',false));
function slide(id, match) {
  const el = document.createElement('div'); el.className = 'carousel__slide'; el.setAttribute('role','listitem'); el.style.width = '16.6666667%';
  el.innerHTML = `<div class="carousel__inner-slide"><div class="Panel"><div class="wrap"><div class="Panel"><div class="ImpressionTrackedElement"><div role="button" tabindex="0"><a class="capsule" href="https://store.steampowered.com/app/${id}/" data-ds-tagids="${match?'[7926]':'[19]'}"><img src="${art}" alt="Game ${id}"><span>Game ${id}</span></a></div></div></div></div></div></div>`;
  if(match)testDisclosure(el.querySelector('a'));
  return el;
}
const tray = document.querySelector('.carousel__slider-tray');
tray.append(...[811,812,813,814,815,816].map(id=>slide(String(id),id===812||id===814||id===816)));
let originalArrowCalls = 0;
document.querySelectorAll('#carousel button').forEach(button=>button.addEventListener('click',()=>originalArrowCalls++));
document.querySelector('#remove').onclick=()=>chrome.storage.local.set({mode:'hide'});
document.querySelector('#mask').onclick=()=>chrome.storage.local.set({mode:'mask'});
document.querySelector('#off').onclick=()=>chrome.storage.local.set({mode:'off'});
