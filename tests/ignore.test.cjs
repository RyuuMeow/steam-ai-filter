const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ctx = vm.createContext({URL, URLSearchParams, AbortSignal, structuredClone, console, setTimeout, clearTimeout});
for (const name of ['lookup','disclosure-keywords','disclosure','core','ignore'])
  vm.runInContext(fs.readFileSync(`dist/${name}.js`,'utf8'),ctx);
const I = ctx.SAFIgnore;
const item = (id='101', patch={}) => ({id,title:`Game ${id}`,disclosure:'AI generated character art.',tagMatch:false,tagAvailable:true,parseIssue:false,...patch});
function harness(saved) {
  const h = {now:1_800_000_000_000, state:saved, settings:ctx.SAF.normalizeSettings(),
    calls:[], posts:[], ignored:{}, accountId:'12345', scheduled:null, cache:{}, override:null};
  h.deps = {
    load:async()=>structuredClone(h.state),
    settings:async()=>structuredClone(h.settings),
    cache:async()=>h.cache,
    save:async(state,enabled)=>{h.state=structuredClone(state); if(enabled!==undefined)h.settings.autoIgnore=enabled;},
    schedule:async when=>{h.scheduled=when;},
    now:()=>h.now,
    fetch:async(url,init)=>{
      h.calls.push({url,method:init.method||'GET',credentials:init.credentials,redirect:init.redirect});
      if(h.override){const r=await h.override(url,init);if(r)return r;}
      if(url==='https://store.steampowered.com/')return new Response(`var g_AccountID = ${h.accountId}; var g_sessionID = "abcdef0123456789abcdef01";`);
      if(url.includes('/dynamicstore/userdata/'))return Response.json({rgIgnoredApps:h.ignored});
      assert.equal(url,'https://store.steampowered.com/recommended/ignorerecommendation/');
      assert.equal(init.method,'POST');
      assert.equal(init.body.get('remove'),'0');
      assert.equal(init.body.get('sessionid'),'abcdef0123456789abcdef01');
      h.posts.push(init.body.get('appid')); h.ignored[init.body.get('appid')]=0;
      return Response.json({success:1});
    }
  };
  h.service=new I.Service(h.deps);
  h.enable=()=>h.service.enable();
  h.tick=async(ms=30000)=>{h.now+=ms;await h.service.tick();};
  return h;
}
test('defaults are disclosure, mask, art selected, checks shown, and account changes off', async()=>{
  ctx.chrome={storage:{local:{get:async()=>({})}}};
  const s=await ctx.SAF.getSettings();
  assert.equal(s.mode,'mask');assert.equal(s.filterCategories.art,true);
  assert.equal(s.showChecked,true);assert.equal(s.autoIgnore,false);
  ctx.chrome.storage.local.get=async()=>({level:1,presentation:'remove',showChecked:false,autoIgnore:'true'});
  const existing=await ctx.SAF.getSettings();
  assert.equal(existing.mode,'mark');assert.equal(existing.showChecked,false);assert.equal(existing.autoIgnore,false);
});
test('off never fetches; opt in requires a valid logged-in session without persisting its token', async()=>{
  const h=harness();await h.service.enqueue([item()]);await h.tick();
  assert.equal(h.calls.length,0);
  h.accountId='0';assert.equal((await h.enable()).ok,false);assert.equal(h.settings.autoIgnore,false);
  h.accountId='12345';assert.equal((await h.enable()).ok,true);
  assert.equal(h.state.accountId,'12345');assert.ok(!JSON.stringify(h.state).includes('fixture_session'));
});
test('shared queue deduplicates cross-tab matches and verifies successful writes, one per 30 seconds', async()=>{
  const h=harness();await h.enable();
  await Promise.all([h.service.enqueue([item(),item('102')]),h.service.enqueue([item()])]);
  assert.equal(h.state.queue.length,2);
  await h.tick(29999);assert.equal(h.posts.length,0);
  await h.tick(1);assert.deepEqual(h.posts,['101']);assert.ok(h.state.done['101']);assert.equal(h.state.queue.length,1);
  await h.tick(29999);assert.equal(h.posts.length,1);
  await h.tick(1);assert.deepEqual(h.posts,['101','102']);
  await h.service.enqueue([item()]);assert.equal(h.state.queue.length,0);
  assert.ok(h.calls.every(c=>c.credentials==='include'&&c.redirect==='error'));
});
test('every candidate respects current level, selected categories and manual allowlist, including late cache updates', async()=>{
  const h=harness();await h.enable();h.settings.allow['101']='allowed';
  await h.service.enqueue([item(),item('102',{disclosure:'AI was used only for code.'}),item('103',{disclosure:null,tagMatch:true}),item('104')]);
  assert.deepEqual(h.state.queue.map(x=>x.id),['104']);
  h.cache['104']={state:'disclosed',disclosure:'AI was used only for programming.',checkedAt:h.now,expiresAt:h.now+60000};
  await h.tick();assert.equal(h.posts.length,0);
  h.settings.mode='hide';await h.service.enqueue([item('103',{disclosure:null,tagMatch:true})]);
  await h.tick();assert.deepEqual(h.posts,[]);
  h.settings.filterCategories.code=true;await h.service.enqueue([item('102',{disclosure:'AI was used only for code.'})]);await h.tick();
  assert.deepEqual(h.posts,['102']);
});
test('unknown/malformed candidates cannot trigger writes and queue size is bounded', async()=>{
  const h=harness();await h.enable();
  await h.service.enqueue([null,{id:'../bad'},item('103',{disclosure:null}),{id:'104',disclosure:7}]);
  assert.equal(h.state.queue.length,0);
  await h.service.enqueue(Array.from({length:250},(_,i)=>item(String(i+1000))));
  assert.equal(h.state.queue.length,200);
});
test('disabling, marking-only, or adding an exception cancels queued work', async()=>{
  for(const change of [s=>s.autoIgnore=false,s=>s.mode='mark',s=>s.filterCategories.art=false,s=>s.allow['101']='allowed']){
    const h=harness();await h.enable();await h.service.enqueue([item()]);
    change(h.settings);await h.service.reconcile();await h.tick();
    assert.equal(h.state.queue.length,0);assert.equal(h.posts.length,0);assert.equal(h.scheduled,null);
  }
});
test('off and selected categories changed during a request are checked again before POST', async()=>{
  for(const change of [h=>h.settings.autoIgnore=false,h=>h.settings.filterCategories.art=false,h=>h.settings.allow['101']='allowed',
    h=>h.cache['101']={state:'disclosed',disclosure:'AI was used only for code.',checkedAt:h.now,expiresAt:h.now+60000}]){
    const h=harness();await h.enable();await h.service.enqueue([item()]);
    h.override=async url=>{if(url.includes('/dynamicstore/userdata/'))change(h);};
    await h.tick();assert.equal(h.posts.length,0);assert.equal(h.state.queue.length,0);
  }
});
test('account switching and expired authentication pause without writing to another account', async()=>{
  for(const newAccount of ['67890','0']){
    const h=harness();await h.enable();await h.service.enqueue([item()]);h.accountId=newAccount;
    await h.tick();assert.equal(h.posts.length,0);assert.ok(h.state.paused);assert.equal(h.scheduled,null);
  }
});
test('already ignored games are deduplicated from Steam itself before writing', async()=>{
  const h=harness();h.ignored['101']=0;await h.enable();await h.service.enqueue([item()]);await h.tick();
  assert.equal(h.posts.length,0);assert.ok(h.state.done['101']);assert.match(h.state.last,/已在忽略清單/);
});
test('429/503 Retry-After survives restart and off/on cannot reset cooldown', async()=>{
  for(const code of [429,503]){
    const h=harness();await h.enable();await h.service.enqueue([item()]);
    h.override=async url=>url.includes('/dynamicstore/userdata/')?new Response('',{status:code,headers:{'Retry-After':'1800'}}):undefined;
    await h.tick();assert.equal(h.posts.length,0);assert.equal(h.state.cooldownUntil,h.now+1800000);
    const future=h.state.cooldownUntil;h.service=new I.Service(h.deps);
    h.override=null;await h.enable();assert.equal(h.state.cooldownUntil,future);
    await h.tick(60000);assert.equal(h.posts.length,0);
    h.now=future;await h.service.enqueue([item()]);await h.service.tick();assert.equal(h.posts.length,1);
  }
});
test('unknown write outcome is not reported successful and a retry first reconciles actual Steam state', async()=>{
  const h=harness();await h.enable();await h.service.enqueue([item()]);
  let once=false;
  h.override=async(url,init)=>{
    if(init.method==='POST'&&!once){once=true;h.ignored['101']=0;throw new Error('connection lost after server committed');}
  };
  await h.tick();assert.equal(h.state.done['101'],undefined);assert.equal(h.state.queue[0].attempts,1);
  await h.tick(120000);assert.ok(h.state.done['101']);assert.equal(h.posts.length,0);
});
test('HTTP 200 without confirmed ignore membership is retried then pauses after three failures', async()=>{
  const h=harness();await h.enable();await h.service.enqueue([item()]);
  h.override=async(url,init)=>init.method==='POST'?Response.json({success:0}):undefined;
  await h.tick();assert.equal(h.state.done['101'],undefined);
  await h.tick(120000);assert.equal(h.state.done['101'],undefined);
  await h.tick(600000);assert.ok(h.state.paused);assert.equal(h.scheduled,null);
});
test('401/403 and incompatible list responses pause instead of retrying account writes', async()=>{
  for(const response of [new Response('',{status:401}),new Response('',{status:403}),Response.json({unexpected:true})]){
    const h=harness();await h.enable();await h.service.enqueue([item()]);
    h.override=async url=>url.includes('/dynamicstore/userdata/')?response:undefined;
    await h.tick();assert.ok(h.state.paused);assert.equal(h.posts.length,0);
  }
});
test('restart retains successful deduplication, pacing and pending items; stale sightings expire', async()=>{
  const h=harness();await h.enable();await h.service.enqueue([item(),item('102')]);await h.tick();
  h.service=new I.Service(h.deps);await h.service.enqueue([item()]);await h.tick(1);
  assert.equal(h.posts.length,1);assert.equal(h.state.queue.length,1);
  await h.tick(30000);assert.equal(h.posts.length,2);
  await h.service.enqueue([item('103')]);await h.tick(16*60000);
  assert.equal(h.posts.length,2);assert.equal(h.state.queue.length,0);
});
test('queued explicit code-only update cancels earlier tag-only detection', async()=>{
  const h=harness();h.settings.mode='hide';await h.enable();
  await h.service.enqueue([item('101',{disclosure:null,tagMatch:true})]);
  await h.service.enqueue([item('101',{disclosure:'AI was used only for code.',tagMatch:true})]);
  await h.tick();assert.equal(h.posts.length,0);
});
test('unexpected storage failure rejects the action before any POST', async()=>{
  const h=harness();await h.enable();await h.service.enqueue([item()]);
  h.deps.save=async()=>{throw Error('disk unavailable');};
  await assert.rejects(h.tick());assert.equal(h.posts.length,0);
});
test('disclosure-query throttling also postpones account requests', async()=>{
  const h=harness();await h.enable();await h.service.enqueue([item()]);
  h.deps.cooldown=async()=>h.now+60000;
  const count=h.calls.length;
  await h.tick();assert.equal(h.calls.length,count);assert.ok(h.scheduled>=h.now+60000);
});
