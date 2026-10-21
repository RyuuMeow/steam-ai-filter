const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({setTimeout, clearTimeout, AbortController, URL});
vm.runInContext(fs.readFileSync('dist/lookup.js', 'utf8'), context);
const S = context.SAFLookup;
const html = (id, disclosure = null) => `<html><head><meta property="og:url" content="https://store.steampowered.com/app/${id}/Game/"></head><body>
<div id="appHubAppName">Game</div><div id="game_area_description">About This Game</div>
<div id="game_area_content_descriptors"><h2>Mature Content Description</h2><i>Violence</i></div>
${disclosure === null ? '' : `<div id="game_area_content_descriptors"><h2>AI Generated Content Disclosure</h2><p><i>${disclosure}</i></p></div>`}
</body></html>`;
const response = body => new Response(body, {headers:{'Content-Type':'text/html'}});
function setup(fetch, extra={}) {
  let saved;
  const resolver = new S.Resolver({load:async()=>saved,save:async data=>{saved=structuredClone(data);},fetch,gap:0,...extra});
  return {resolver, saved:()=>saved};
}
test('complete, correctly identified HTML: disclosure vs absent, never mature description', () => {
  const yes = S.parse(html('42','Art &amp; music.<br>Line &#x4E8C;.'),'42',1000);
  assert.equal(yes.state,'disclosed');
  assert.equal(yes.disclosure,'Art & music.\nLine 二.');
  assert.equal(yes.expiresAt-yes.checkedAt,7*86400000);
  const no = S.parse(html('42'),'42',1000);
  assert.equal(no.state,'not-found');
  assert.equal(no.expiresAt-no.checkedAt,86400000);
});

test('cache policy recomputes existing successful results and keeps failure retry deadlines',()=>{
  const day=86400000, now=1000, positive=S.parse(html('42','AI art.'),'42',now), negative=S.parse(html('43'),'43',now);
  assert.equal(S.fresh(positive,now+2*day,1),false);
  assert.equal(S.fresh(negative,now+2*day,7),true);
  assert.equal(S.fresh(positive,now+20*day,30),true);
  assert.equal(S.fresh(positive,now+30*day,30),false);
  assert.equal(S.fresh(negative,now+day,0),false);
  const failed=S.unavailable(now,'offline');
  assert.equal(S.fresh(failed,now+300001,30),false);
  assert.equal(S.fresh({...positive,expiresAt:Infinity},now,30),false);
});

test('30-day policy survives restart; shortening the interval refetches saved results',async()=>{
  let now=1000,count=0;
  const first=setup(async()=>{count++;return response(html('42','AI art.'));},{now:()=>now,cacheDays:30});
  const result=await first.resolver.get('42');
  assert.equal(result.expiresAt-result.checkedAt,30*86400000);
  now+=15*86400000;
  const second=setup(async()=>{count++;return response(html('42'));},{now:()=>now,cacheDays:30,load:async()=>first.saved()});
  assert.equal((await second.resolver.get('42')).state,'disclosed');assert.equal(count,1);
  second.resolver.configure({cacheDays:1,requestGap:0,concurrency:2});
  assert.equal((await second.resolver.get('42')).state,'not-found');assert.equal(count,2);
});

test('live concurrency reduction drains active work and completion uses the latest cache policy',async()=>{
  const releases=[],started=[];
  const {resolver}=setup(url=>new Promise(resolve=>{started.push(url);releases.push(()=>resolve(response(html(url.match(/app\/(\d+)/)[1]))));}),{concurrency:3});
  const requests=['1','2','3','4','5'].map(id=>resolver.get(id));
  await new Promise(r=>setImmediate(r));assert.equal(started.length,3);
  resolver.configure({requestGap:0,concurrency:1,cacheDays:30});
  releases.shift()();await new Promise(r=>setImmediate(r));assert.equal(started.length,3);
  releases.shift()();await new Promise(r=>setImmediate(r));assert.equal(started.length,3);
  releases.shift()();await new Promise(r=>setImmediate(r));assert.equal(started.length,4);
  releases.shift()();await new Promise(r=>setImmediate(r));assert.equal(started.length,5);
  releases.shift()();
  const results=await Promise.all(requests);
  assert.ok(results.every(result=>result.expiresAt-result.checkedAt===30*86400000));
});

test('request spacing is shared across consumers and live policy changes retain server cooldown',async()=>{
  const starts=[];
  const {resolver}=setup(async url=>{starts.push(Date.now());return response(html(url.match(/app\/(\d+)/)[1]));},{gap:40,concurrency:4});
  await Promise.all(['1','2','3'].map(id=>resolver.get(id)));
  assert.ok(starts.slice(1).every((time,i)=>time-starts[i]>=35));
  let calls=0;
  const limited=setup(async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'120'}});});
  await limited.resolver.get('42');
  limited.resolver.configure({requestGap:0,concurrency:4,cacheDays:30});
  await limited.resolver.clear();await limited.resolver.get('43');assert.equal(calls,1);
});
test('redirect/age gate/truncated/changed layout/wrong app cannot poison negative cache', () => {
  for (const body of ['Age verification',html('43'),html('42').replace('</body></html>',''),
    html('42','yes').replace('id="game_area_content_descriptors"><h2>AI','id="changed"><h2>AI'),
    html('42','').replace('<i></i>','')]) {
    assert.equal(S.parse(body,'42',1000).state,'unavailable');
  }
  assert.equal(S.parse(html('42')+'<script>AI Generated Content Disclosure</script>','42',1000).state,'not-found');
});
test('same-app in-flight requests share one fetch; persisted cache survives a new resolver', async () => {
  let count=0,release;
  const gate=new Promise(r=>release=r);
  const first=setup(async()=>{count++;await gate;return response(html('42','Yes'));});
  const a=first.resolver.get('42'), b=first.resolver.get('42');
  await new Promise(r=>setImmediate(r)); assert.equal(count,1); release();
  assert.equal((await a).state,'disclosed'); assert.equal((await b).state,'disclosed');
  assert.equal((await first.resolver.get('42')).state,'disclosed');assert.equal(count,1);
  const second=setup(async()=>{throw Error('must not fetch');},{load:async()=>first.saved()});
  assert.equal((await second.resolver.get('42')).state,'disclosed');
});
test('expired negative cache refetches and can become a positive', async () => {
  let now=1000, count=0;
  const {resolver}=setup(async()=>response(html('42',++count===1?null:'New disclosure')),{now:()=>now});
  assert.equal((await resolver.get('42')).state,'not-found');
  now+=86400001;
  assert.equal((await resolver.get('42')).state,'disclosed');assert.equal(count,2);
});
test('global queue bounds concurrency to two across different consumers', async () => {
  let active=0,max=0;
  const {resolver}=setup(async url=>{
    active++;max=Math.max(max,active);
    await new Promise(r=>setTimeout(r,10));active--;
    return response(html(url.match(/app\/(\d+)/)[1]));
  });
  const results=await Promise.all(['1','2','3','4','5'].map(id=>resolver.get(id)));
  assert.equal(max,2);assert.ok(results.every(r=>r.state==='not-found'));
});
test('network failures remain unknown and are cached briefly, never false negatives', async () => {
  let count=0;
  const {resolver}=setup(async()=>{count++;throw Error('offline');});
  assert.equal((await resolver.get('42')).state,'unavailable');
  assert.equal((await resolver.get('42')).state,'unavailable');assert.equal(count,1);
});
test('upgrade retries failures from the old anonymous-fetch cache', async()=>{
  const now=Date.now();let count=0;
  const {resolver}=setup(async()=>{count++;return response(html('42','Session accessible'));},{
    load:async()=>({version:1,cooldownUntil:0,items:{42:S.unavailable(now,'Old anonymous failure')}})
  });
  assert.equal((await resolver.get('42')).state,'disclosed');
  assert.equal(count,1);
});
test('429 Retry-After stops the queue, persists cooldown, and cache clear cannot bypass it', async () => {
  let count=0;
  const first=setup(async()=>{count++;return new Response('',{status:429,headers:{'Retry-After':'120'}});});
  assert.equal((await first.resolver.get('42')).state,'unavailable');
  await first.resolver.clear();
  assert.equal((await first.resolver.get('43')).state,'unavailable');assert.equal(count,1);
  const second=setup(async()=>{throw Error('cooldown ignored');},{load:async()=>first.saved()});
  assert.match((await second.resolver.get('44')).issue,/限制/);
});
test('off cancels queued/in-flight work without persisting cancellation; re-enable can retry', async () => {
  let started=0;
  const {resolver,saved}=setup(async(url,init)=>{
    started++;
    return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('abort'))));
  });
  const requests=['1','2','3'].map(id=>resolver.get(id));
  await new Promise(r=>setImmediate(r));resolver.setEnabled(false);
  assert.ok((await Promise.all(requests)).every(r=>r.state==='unavailable'));
  assert.equal(started,2);assert.equal(saved(),undefined);
  assert.equal((await resolver.get('4')).state,'unavailable');assert.equal(started,2);
});
test('corrupt cache, invalid IDs, storage failures, and cache bounds are handled', async () => {
  let count=0;
  const {resolver,saved}=setup(async url=>{count++;return response(html(url.match(/app\/(\d+)/)[1]));},{
    load:async()=>({version:1,items:{42:{state:'disclosed',disclosure:null,checkedAt:1,expiresAt:Infinity}}})
  });
  assert.equal((await resolver.get('../account')).state,'unavailable');assert.equal(count,0);
  assert.equal((await resolver.get('42')).state,'not-found');assert.equal(count,1);
  const failed=setup(async()=>{throw Error('must not fetch');},{load:async()=>{throw Error('storage');}});
  assert.equal((await failed.resolver.get('42')).state,'unavailable');
  const now=Date.now();
  const items=Object.fromEntries(Array.from({length:600},(_,i)=>[String(i+1),S.parse(html(String(i+1)),String(i+1),now)]));
  const capped=setup(async()=>response(html('999')),{load:async()=>({version:1,items})});
  await capped.resolver.get('999');assert.equal(Object.keys(capped.saved().items).length,500);
  assert.ok(saved().items['42']);
});
test('clearing cached results forces the next request to fetch again', async()=>{
  let count=0;
  const {resolver}=setup(async()=>{count++;return response(html('42','Yes'));});
  await resolver.get('42');await resolver.clear();await resolver.get('42');
  assert.equal(count,2);
});
test('clear during a pending storage write cannot return or restore an obsolete result', async()=>{
  let saved,release,firstWrite=true;
  const gate=new Promise(resolve=>release=resolve);
  const {resolver}=setup(async()=>response(html('42','Yes')),{
    save:async value=>{if(firstWrite){firstWrite=false;await gate;}saved=structuredClone(value);}
  });
  const lookup=resolver.get('42');
  await new Promise(resolve=>setImmediate(resolve));
  const clearing=resolver.clear();
  await new Promise(resolve=>setImmediate(resolve));
  release();
  assert.equal((await lookup).state,'unavailable');
  await clearing;
  assert.deepEqual(Object.keys(saved.items),[]);
  assert.equal((await resolver.get('42')).state,'disclosed');
});
test('fetch uses the existing Steam session on a fixed app URL, without following redirects', async()=>{
  const {resolver}=setup(async(url,init)=>{
    assert.equal(url,'https://store.steampowered.com/app/42/?l=english');
    assert.equal(init.credentials,'include');assert.equal(init.redirect,'error');
    assert.ok(init.signal);
    return response(html('42'));
  });
  assert.equal((await resolver.get('42')).state,'not-found');
});
test('background entrypoint validates senders and supports only fixed app IDs', async()=>{
  let listener,change,requests=0;
  const storage={level:2,allow:{}};
  const worker=vm.createContext({
    setTimeout,clearTimeout,AbortController,AbortSignal,URL,URLSearchParams,structuredClone,console,
    fetch:async url=>{requests++;return response(html(url.match(/app\/(\d+)/)[1],'Yes'));},
    chrome:{
      runtime:{id:'extension',getURL:path=>'chrome-extension://extension/'+path,onMessage:{addListener:fn=>listener=fn}},
      alarms:{get:async()=>undefined,create:async()=>{},clear:async()=>true,onAlarm:{addListener:()=>{}}},
      storage:{local:{get:async()=>storage,set:async values=>Object.assign(storage,values)},onChanged:{addListener:fn=>change=fn}}
    }
  });
  worker.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),worker));
  vm.runInContext(fs.readFileSync('dist/background.js','utf8'),worker);
  assert.equal(listener({type:'SAF_LOOKUP',id:'42'},{id:'other',url:'https://store.steampowered.com/'},()=>{}),undefined);
  assert.equal(listener({type:'SAF_LOOKUP',id:'42'},{id:'extension',url:'https://evil.example/'},()=>{}),undefined);
  assert.equal(listener({type:'SAF_LOOKUP',id:'../account'},{id:'extension',url:'https://store.steampowered.com/'},()=>{}),undefined);
  const sender={id:'extension',url:'https://store.steampowered.com/'};
  const get=msg=>new Promise(resolve=>listener(msg,sender,resolve));
  assert.equal((await get({type:'SAF_LOOKUP',id:'42'})).state,'disclosed');
  for(const path of ['/sale/nextfest','/curator/123/','/wishlist/id/test/','/category/rpg','/charts/topselling/','/future/new-layout/']) {
    const result=await new Promise(resolve=>listener({type:'SAF_LOOKUP',id:'42'},{...sender,url:'https://store.steampowered.com'+path},resolve));
    assert.equal(result.state,'disclosed');
  }
  assert.equal(requests,1);
  storage.level=0;change({level:{newValue:0}},'local');
  assert.equal((await get({type:'SAF_LOOKUP',id:'43'})).state,'unavailable');assert.equal(requests,1);
  assert.equal(listener({type:'SAF_CLEAR_CACHE'},sender,()=>{}),undefined);
  assert.equal((await new Promise(resolve=>listener({type:'SAF_CLEAR_CACHE'},{id:'extension',url:'chrome-extension://extension/popup.html'},resolve))).ok,true);
});

test('a delayed worker settings read cannot start a lookup after switching off',async()=>{
  let listener,change,hold=false,release,calls=0;
  const data={mode:'mask',allow:{}};
  const worker=vm.createContext({setTimeout,clearTimeout,AbortController,AbortSignal,URL,URLSearchParams,structuredClone,console,
    fetch:async()=>{calls++;return response(html('42','AI art.'));},
    chrome:{runtime:{id:'extension',getURL:path=>'chrome-extension://extension/'+path,onMessage:{addListener:fn=>listener=fn}},
      alarms:{get:async()=>undefined,create:async()=>{},clear:async()=>true,onAlarm:{addListener:()=>{}}},
      storage:{local:{get:async keys=>{
        const snapshot=structuredClone(data);
        if(hold&&Array.isArray(keys)&&keys.includes('mode')){hold=false;await new Promise(resolve=>release=resolve);}
        return snapshot;
      },set:async values=>Object.assign(data,values)},onChanged:{addListener:fn=>change=fn}}}});
  worker.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),worker));
  vm.runInContext(fs.readFileSync('dist/background.js','utf8'),worker);
  await new Promise(resolve=>setImmediate(resolve));
  hold=true;
  const lookup=new Promise(resolve=>listener({type:'SAF_LOOKUP',id:'42'},{id:'extension',url:'https://store.steampowered.com/'},resolve));
  await new Promise(resolve=>setImmediate(resolve));
  data.mode='off';change({mode:{newValue:'off'}},'local');
  await new Promise(resolve=>setImmediate(resolve));release();
  assert.equal((await lookup).state,'unavailable');assert.equal(calls,0);
});
