testBridge.data={};
const art = "data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225"><rect width="400" height="225" fill="#416579"/><circle cx="310" cy="55" r="22" fill="#f2d798"/><path d="M0 190 110 55 220 190 300 100 400 210V225H0" fill="#799b95"/><path d="M0 225 170 130 270 225" fill="#2c4d5e"/></svg>');
const quote = text=>`<section class="game_area_description"><h2>AI Generated Content Disclosure</h2><i>${text}</i></section>`;
const ai = 'AI was used to generate character artwork and backgrounds.';
const code = 'AI was used only for programming.';
const trailer = document.createElement('section');
trailer.className='SaleSectionCtn trailercarousel expanded discoveryqueue Panel Focusable';
trailer.innerHTML=`<div class="Panel Focusable"><div class="SaleSectionLabelCtn"><h2>探索新品節</h2></div><div role="button" tabindex="0" class="Panel Focusable">
<div class="trailer-game"><div class="trailer-media"><video poster="${art}"></video><button aria-label="播放 / 暫停">▶</button></div>
<div class="description"><a href="https://store.steampowered.com/app/5010/"><img src="${art}" alt="龍之預告片"></a><p>影片、遊戲介紹與安裝按鈕屬於同一款遊戲。</p><button>安裝試玩版</button>${quote(ai)}</div></div>
<div class="trailer-navigation"><button aria-label="上一款">‹</button><span>自動前進</span><button aria-label="下一款">›</button></div></div></div>`;
trailer.querySelector('.game_area_description').hidden=true;
document.querySelector('#trailer-slot').append(trailer);
function game(id,title,disclosure,tag=false){
  const el=document.createElement('a');el.className='game';el.href=`https://store.steampowered.com/app/${id}/`;
  el.dataset.dsTagids=tag?'[7926]':'[19]';
  el.innerHTML=`<img src="${art}" alt="${title}"><span class="title">${title}</span>${disclosure?quote(disclosure):''}`;
  return el;
}
const games=document.querySelector('#games');
games.append(game('5011','山間日常'),game('5012','僅程式碼輔助',code),game('5013','人工智慧題材',null,true),game('5014','混合 AI 美術',ai),game('5015','等待查詢完成'),game('5016','尚未確認'));
let releaseLate;
window.testLookup=async id=> id==='5015' ? new Promise(resolve=>{releaseLate=resolve;})
  :{state:id==='5011'?'not-found':'unavailable',disclosure:null,checkedAt:Date.now(),expiresAt:Date.now()+60000};
const fake={now:Date.now(),posts:[],ignored:{},calls:[],scheduled:null,failEnable:false};
window.testIgnore=new SAFIgnore.Service({
  load:async()=>testBridge.data.ignoreState,
  settings:()=>SAF.getSettings(),
  cache:async()=>testBridge.data.disclosureCache?.items||{},
  save:(ignoreState,enabled)=>chrome.storage.local.set(enabled===undefined?{ignoreState}:{ignoreState,autoIgnore:enabled}),
  schedule:async when=>{fake.scheduled=when;},
  now:()=>fake.now,
  fetch:async(url,init)=>{
    fake.calls.push({url,method:init.method||'GET'});
    if(url==='https://store.steampowered.com/') return new Response(`var g_AccountID = ${fake.failEnable?0:12345}; var g_sessionID = "abcdef0123456789abcdef01";`);
    if(url.includes('/dynamicstore/userdata/'))return Response.json({rgIgnoredApps:fake.ignored});
    if(url.endsWith('/recommended/ignorerecommendation/')){
      const id=init.body.get('appid');fake.posts.push(id);fake.ignored[id]=0;return Response.json({success:1});
    }
    throw Error('Unexpected endpoint');
  }
});
