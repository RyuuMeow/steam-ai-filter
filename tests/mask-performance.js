(async()=>{
 const out=document.querySelector('#test-results'),wait=ms=>new Promise(r=>setTimeout(r,ms));
 const until=async fn=>{for(let i=0;i<100;i++){if(fn())return;await wait(30);}throw Error('Timed out');};
 const assert=(ok,label)=>{if(!ok)throw Error(label);out.textContent+=`PASS ${label}\n`;};
 const pointer=async action=>{window.testPointerDone=false;window.testPointerAction=action;await until(()=>window.testPointerDone);await wait(120);};
 try{
  await until(()=>document.querySelectorAll('.saf-mask').length===200);await wait(250);
  let writes=0;const mutations=new MutationObserver(records=>{writes+=records.length;});
  mutations.observe(cards,{subtree:true,childList:true,attributes:true,characterData:true});
  maskMetrics.calls=0;maskMetrics.milliseconds=0;
  const start=performance.now();
  for(let i=0;i<20;i++)await chrome.tabs.sendMessage(1,{type:'SAF_REFRESH'});
  await wait(50);
  out.textContent+=`METRICS ${JSON.stringify({...maskMetrics,writes,refreshMs:Math.round(performance.now()-start)})}\n`;
  assert(writes===0&&maskMetrics.calls===0,'unchanged settings do not rewrite 200 masked cards');
  const card=cards.firstElementChild,r=card.getBoundingClientRect();
  await pointer({type:'move',x:r.left+r.width/2,y:r.top+r.height/2});
  assert(!card.classList.contains('saf-blocked'),'hover reveals the target card');
  maskMetrics.calls=0;await pointer({type:'move',x:5,y:5});
  assert(card.classList.contains('saf-blocked')&&maskMetrics.calls<=1,'hover restore touches only one mask');
  assert(getComputedStyle(card.querySelector('.saf-mask')).backdropFilter==='none','mask does not sample the scrolling page backdrop');
  const added=document.createElement('button');added.textContent='new Steam control';card.append(added);
  await until(()=>added.inert);assert(added.getAttribute('aria-hidden')==='true','new Steam children still become inaccessible while covered');
  const title=card.querySelector('.title');title.textContent='Updated game';await until(()=>card.getAttribute('aria-label').includes('Updated game'));
  assert(card.getAttribute('aria-label').includes('Updated game'),'real Steam content changes still refresh the mask');
  await testSettings({mode:'off'});
  assert(!added.inert&&!added.hasAttribute('aria-hidden')&&!card.querySelector('.saf-mask'),'off restores dynamically added controls');
  mutations.disconnect();out.textContent+='ALL MASK PERFORMANCE TESTS PASSED';document.documentElement.dataset.tests='passed';
 }catch(e){out.textContent+=`FAIL ${e.stack}`;document.documentElement.dataset.tests='failed';}
})();
