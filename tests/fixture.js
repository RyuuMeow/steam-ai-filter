let nextId=200;
document.querySelector('#search_resultsRows').addEventListener('click',event=>{
  // Fictional preview games should not navigate to real Steam product URLs.
  if(event.target.closest('a'))event.preventDefault();
});
const previewFrame=document.querySelector('iframe');
previewFrame.addEventListener('load',()=>{
  const doc=previewFrame.contentDocument;
  if(doc?.body)new ResizeObserver(()=>{previewFrame.style.height=`${doc.body.scrollHeight+8}px`;}).observe(doc.body);
});
document.querySelector('#append').onclick=()=>{
  const id=nextId++;
  const row=document.createElement('a');
  row.className='search_result_row';row.href=`https://store.steampowered.com/app/${id}/`;
  row.dataset.dsAppid=String(id);row.dataset.dsTagids='[7926]';
  row.innerHTML=`<span class="cover">✦</span><div class="search_name"><span class="title">New Arrival ${id}</span><span class="meta">新增卡片 · 人工智慧標籤</span></div>`;
  document.querySelector('#search_resultsRows').append(row);
};
document.querySelector('#reset').onclick=()=>location.reload();
if(new URLSearchParams(location.search).has('test')) {
  const output=document.querySelector('#test-results');
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const assert=(condition,message)=>{if(!condition)throw Error(message);output.textContent+=`PASS ${message}\n`;};
  const shadow=()=>document.querySelector('#saf-root').shadowRoot;
  const hidden=()=>document.querySelectorAll('.saf-hidden').length;
  const message=type=>chrome.tabs.sendMessage(1,{type});
  (async()=>{
    await pause(250);
    assert(hidden()===0 && document.querySelectorAll('.saf-badge').length===2,'default labels only; sidebar tag ignored');
    await chrome.storage.local.set({level:2});
    assert(hidden()===0,'tag-only games survive disclosure level');
    await chrome.storage.local.set({level:3});
    assert(hidden()===2,'broad level hides exactly the two tag matches');
    assert(!document.querySelector('[data-ds-appid="104"]').classList.contains('saf-hidden'),'AI in title is not a match');
    await message('SAF_REVEAL');assert(hidden()===0,'temporarily reveal restores cards');
    await message('SAF_REVEAL');assert(hidden()===2,'restore filtering works');
    await chrome.storage.local.set({allow:{101:'Neon Companion'}});
    assert(hidden()===1,'allowlist overrides broad filtering');
    await chrome.storage.local.set({allow:{}});
    assert(hidden()===2,'removing exception reapplies filter');
    document.querySelector('#append').click();await pause(250);
    assert(hidden()===3,'dynamically appended cards are filtered');
    const row=document.querySelector('[data-ds-appid="200"]');
    row.dataset.dsTagids='[19]';await pause(250);
    assert(hidden()===2 && !row.querySelector('.saf-badge'),'changed tag attributes remove stale matches');
    row.dataset.dsTagids='bad-json';await pause(250);
    assert(!row.classList.contains('saf-hidden'),'malformed tag data remains visible');
    const e=SAF.readEvidence(row,'200','Changed');assert(e.parseIssue,'parse issue is explicit');
    await chrome.storage.local.set({level:0});
    assert(hidden()===0 && document.querySelectorAll('.saf-badge').length===0,'off restores all cards and removes badges');
    const before=document.querySelectorAll('#saf-root').length;
    await pause(400);
    assert(before===1 && document.querySelectorAll('#saf-root').length===1,'no duplicate toolbar');
    // Synthetic disclosure: only tests policy/extraction, not a claim that search cards provide one.
    const section=document.createElement('div');section.className='game_area_description';
    section.innerHTML='<h2>AI Generated Content Disclosure</h2><p><i>Some artwork uses AI.</i></p>';
    row.append(section);await pause(250);await chrome.storage.local.set({level:2});
    assert(hidden()===1 && row.classList.contains('saf-hidden'),'explicit disclosure is hidden at level 2');
    row.remove();await pause(250);
    assert((await message('SAF_STATUS')).total===4,'removed cards are dropped from counts');
    // Dialog text must remain inert.
    const target=document.querySelector('[data-ds-appid="101"] .title');
    target.textContent='<img src=x onerror=alert(1)>';await pause(250);
    document.querySelector('[data-ds-appid="101"] .saf-badge').click();
    assert(shadow().querySelector('dialog').open && !shadow().querySelector('#dialog-title img'),'reason dialog uses safe text');
    shadow().querySelector('#allow').click();await pause(150);
    assert(Object.hasOwn(testBridge.data.allow,'101'),'dialog saves allowlist');
    shadow().querySelector('#close').click();
    assert(!shadow().querySelector('dialog').open,'dialog closes');
    target.textContent='Neon Companion';await chrome.storage.local.set({level:1,allow:{}});
    await pause(200);
    const fragment=document.createDocumentFragment();
    for(let i=1000;i<1500;i++){
      const card=document.createElement('a');card.className='search_result_row';card.dataset.dsAppid=String(i);
      card.dataset.dsTagids=i%2===0?'[7926]':'[19]';
      card.href=`https://store.steampowered.com/app/${i}/`;card.innerHTML=`<div class="search_name"><span class="title">Load ${i}</span></div>`;
      fragment.append(card);
    }
    const started=performance.now();
    document.querySelector('#search_resultsRows').append(fragment);
    await pause(400);await chrome.storage.local.set({level:3});
    assert(hidden()===252,'500-card batch filters exactly the matching half');
    assert(document.querySelectorAll('.saf-badge').length===252,'no duplicated badges after long-list update');
    output.textContent+=`500-card render completed within ${Math.round(performance.now()-started)} ms (includes scheduled wait)\n`;
    document.querySelectorAll('[data-ds-appid]').forEach(e=>{if(Number(e.dataset.dsAppid)>=1000)e.remove();});
    await pause(200);
    const frame=document.querySelector('iframe').contentDocument;
    assert(frame.querySelector('#status').textContent.includes('2 / 4'),'open popup receives updated page counts');
    await chrome.storage.local.set({level:1});
    output.textContent+='ALL BROWSER TESTS PASSED\n';document.documentElement.dataset.tests='passed';
  })().catch(e=>{output.textContent+=`FAIL ${e.stack}`;document.documentElement.dataset.tests='failed';console.error(e);});
}
