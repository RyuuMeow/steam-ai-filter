(async()=>{
  const out=document.querySelector('#test-results'),wait=ms=>new Promise(r=>setTimeout(r,ms));
  const assert=(value,label)=>{if(!value)throw Error(label);out.textContent+=`PASS ${label}\n`;};
  const status=()=>chrome.tabs.sendMessage(1,{type:'SAF_STATUS'});
  const until=async fn=>{for(let i=0;i<80;i++){if(await fn())return;await wait(50);}throw Error('Timed out');};
  const gallery=document.querySelector('#gallery'),react=document.querySelector('#react-card'),shelf=document.querySelector('#event-shelf');
  try{
    await until(()=>gallery.classList.contains('saf-blocked'));
    assert((await status()).kind===(location.pathname.startsWith('/app/')?'app':'store'),'generic store path activates content script');
    assert(!document.querySelector('.home_page_content,#search_resultsRows,.responsive_page_template_content'),'fixture needs no legacy page container');
    assert([...gallery.querySelectorAll('img')].every(img=>img.closest('.saf-blocked')===gallery),'one mask covers recommendation cover and all four screenshots');
    assert(!document.querySelector('#recommendation').classList.contains('saf-blocked'),'recommendation heading with another app stays outside the mask');
    assert(gallery.querySelectorAll('.saf-mask').length===1,'single-game group is not covered by nested duplicate masks');
    assert(react.classList.contains('saf-blocked')&&react.querySelector('.saf-mask-label').textContent==='AI 生成內容','React item-key wrapper uses detail disclosure cache');
    assert(document.querySelector('#wishlist').classList.contains('saf-blocked'),'data-app-id cards are covered');
    assert(document.querySelector('#background-card').classList.contains('saf-blocked'),'CSS-background app card is covered');
    assert(!shelf.classList.contains('saf-blocked')&&!document.querySelector('#ordinary').classList.contains('saf-blocked'),'mixed-game shelves and unmatched neighbours remain visible');
    assert(!document.querySelector('#fixture-navigation .saf-mask,#excluded .saf-mask'),'navigation, bundle and external links are excluded by semantics');
    assert(!document.documentElement.classList.contains('saf-blocked')&&!document.body.classList.contains('saf-blocked'),'no page root can be masked');
    if(location.pathname.startsWith('/app/')){
      assert(!document.querySelector('#main-product').classList.contains('saf-blocked'),'current product remains visible while other-game cards are filtered');
      assert((await status()).hidden>=4,'product detail page also filters its recommendations');
    }
    react.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    const shadow=document.querySelector('#saf-root').shadowRoot;
    assert(react.tabIndex===0&&shadow.querySelector('dialog').open,'non-link container mask supports keyboard activation');
    shadow.querySelector('#close').click();
    const oldRect=gallery.getBoundingClientRect();
    await chrome.storage.local.set({level:0});
    assert(!document.querySelector('.saf-mask')&&react.getAttribute('tabindex')==='-1','off restores original container tabindex and removes all masks');
    assert(gallery.getBoundingClientRect().height===oldRect.height,'group masking preserves layout dimensions');
    await chrome.storage.local.set({level:3});
    react.dataset.dsItemkey='App_621';react.querySelector('a').href='https://store.steampowered.com/app/621/';
    await until(()=>!react.classList.contains('saf-blocked'));
    assert(true,'recycled React card drops the previous game match');
    react.dataset.dsItemkey='App_5151540';react.querySelector('a').href='https://store.steampowered.com/app/5151540/';
    await until(()=>react.classList.contains('saf-blocked'));
    assert(true,'updated React app identity is detected again');
    const tagLink=gallery.querySelector('a');tagLink.dataset.dsTagids='[19]';
    await until(()=>!gallery.classList.contains('saf-blocked'));
    assert(true,'child tag changes invalidate grouped evidence');
    tagLink.dataset.dsTagids='[7926]';await until(()=>gallery.classList.contains('saf-blocked'));
    const added=document.createElement('a');added.className='tile';added.href='https://store.steampowered.com/app/5151540/';added.innerHTML='<img alt="Late card"><span>動態新增</span>';added.querySelector('img').src=art;shelf.append(added);
    await until(()=>added.classList.contains('saf-blocked'));
    assert(true,'new cards anywhere in the document receive cached filtering');
    history.pushState({},'','/future/new-layout/?coverage=1');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await until(async()=>(await status()).kind==='store');
    assert(gallery.classList.contains('saf-blocked')&&react.classList.contains('saf-blocked'),'SPA navigation to an unknown path keeps filtering');
    out.textContent+='ALL STOREWIDE TESTS PASSED';document.documentElement.dataset.tests='passed';
  }catch(e){out.textContent+=`FAIL ${e.stack}`;document.documentElement.dataset.tests='failed';console.error(e);}
})();
