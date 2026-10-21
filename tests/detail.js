(async()=>{
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const out=document.querySelector('#test-results');
  const assert=(v,msg)=>{if(!v)throw Error(msg);out.textContent+=`PASS ${msg}\n`;};
  try{
    await pause(200);await testSettings({mode:'mask'});
    const evidence=SAF.readEvidence(document,'4517370','Detail fixture');
    assert(evidence.disclosure.includes('Some art')&&!evidence.disclosure.includes('Violence'),'AI and mature descriptors distinguished');
    assert(evidence.disclosure.includes('\n'),'disclosure line breaks preserved');
    assert(evidence.tagMatch,'product-specific tags detected');
    assert(!document.documentElement.classList.contains('saf-blocked') && !document.querySelector('.saf-mask'),'detail page is never hidden');
    const section=Array.from(document.querySelectorAll('.game_area_description')).at(-1);
    section.querySelector('h2').textContent='AI 生成内容披露';await pause(200);
    assert(SAF.readEvidence(document,'4517370','Detail').disclosure!==null,'simplified Chinese heading recognized');
    section.querySelector('h2').textContent='AI Generated Content Disclosure';await pause(200);
    assert(SAF.readEvidence(document,'4517370','Detail').disclosure!==null,'English heading recognized');
    section.remove();document.querySelector('.glance_tags').remove();await pause(200);
    const message=await chrome.tabs.sendMessage(1,{type:'SAF_STATUS'});
    assert(message.matched===0&&message.unknown===1,'removing signals yields unknown, not AI-free');
    out.textContent+='ALL DETAIL TESTS PASSED';document.documentElement.dataset.tests='passed';
  }catch(e){out.textContent+=`FAIL ${e.stack}`;document.documentElement.dataset.tests='failed';}
})();
