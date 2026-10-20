const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('real background message routing gates opt-in, trusted senders, alarm deduplication and confirmed writes',async()=>{
  let listener,change,alarmListener,alarm,now=1800000000000,posts=0,requests=0;
  const data={level:2,allow:{}},ignored={};
  class Clock extends Date {static now(){return now;}}
  const until=async predicate=>{for(let i=0;i<60;i++){if(predicate())return;await new Promise(r=>setTimeout(r,1));}throw Error('Timed out');};
  const worker=vm.createContext({
    Date:Clock,setTimeout,clearTimeout,AbortController,AbortSignal,URL,URLSearchParams,structuredClone,console,
    fetch:async(url,init)=>{
      requests++;
      if(url==='https://store.steampowered.com/')return new Response('var g_AccountID = 123; var g_sessionID = "abcdef0123456789abcdef01";');
      if(url.includes('/dynamicstore/userdata/'))return Response.json({rgIgnoredApps:ignored});
      assert.equal(url,'https://store.steampowered.com/recommended/ignorerecommendation/');
      posts++;ignored[init.body.get('appid')]=0;return Response.json({success:1});
    },
    chrome:{
      runtime:{id:'extension',getURL:p=>'chrome-extension://extension/'+p,onMessage:{addListener:fn=>listener=fn}},
      alarms:{
        get:async()=>alarm,
        create:async(name,options)=>{alarm={name,scheduledTime:options.when};},
        clear:async()=>{alarm=undefined;return true;},
        onAlarm:{addListener:fn=>alarmListener=fn}
      },
      storage:{
        local:{get:async()=>structuredClone(data),set:async values=>{
          const changes={};
          for(const[k,v]of Object.entries(values)){if(JSON.stringify(data[k])!==JSON.stringify(v))changes[k]={newValue:v};data[k]=structuredClone(v);}
          if(Object.keys(changes).length&&change)change(changes,'local');
        }},
        onChanged:{addListener:fn=>change=fn}
      }
    }
  });
  worker.importScripts=(...files)=>files.forEach(f=>vm.runInContext(fs.readFileSync('dist/'+f,'utf8'),worker));
  vm.runInContext(fs.readFileSync('dist/background.js','utf8'),worker);
  await until(()=>data.ignoreState);
  assert.equal(requests,0);
  const steam={id:'extension',url:'https://store.steampowered.com/sale/nextfest'};
  const popup={id:'extension',url:'chrome-extension://extension/popup.html'};
  const foreign={id:'other',url:steam.url};
  const item={id:'42',title:'Game',disclosure:'AI generated art.',tagMatch:false};
  const call=(message,sender)=>new Promise(resolve=>listener(message,sender,resolve));
  assert.equal(listener({type:'SAF_IGNORE_ENABLE'},steam,()=>{}),undefined);
  assert.equal(listener({type:'SAF_IGNORE_ENABLE'},foreign,()=>{}),undefined);
  assert.equal(listener({type:'SAF_IGNORE_CANDIDATES',items:[item]},foreign,()=>{}),undefined);
  assert.equal(listener({type:'SAF_IGNORE_CANDIDATES',items:[item]},{...steam,url:'https://example.com/'},()=>{}),undefined);
  await call({type:'SAF_IGNORE_CANDIDATES',items:[item]},steam);
  assert.equal(data.ignoreState.queue.length,0);assert.equal(requests,0);
  assert.equal((await call({type:'SAF_IGNORE_ENABLE'},popup)).ok,true);
  await call({type:'SAF_IGNORE_CANDIDATES',items:[item]},steam);
  const first=alarm.scheduledTime;
  now+=1000;
  await call({type:'SAF_IGNORE_CANDIDATES',items:[item]},steam);
  assert.equal(alarm.scheduledTime,first,'repeat sightings never postpone a pending alarm');
  now=first;alarm=undefined;alarmListener({name:'saf-auto-ignore'});
  await until(()=>data.ignoreState.done['42']);
  assert.equal(posts,1);
  await call({type:'SAF_IGNORE_CANDIDATES',items:[item]},steam);
  assert.equal(data.ignoreState.queue.length,0);
  assert.ok(!JSON.stringify(data).includes('abcdef0123456789abcdef01'),'session token is never persisted');
  await call({type:'SAF_IGNORE_CANDIDATES',items:[{...item,id:'43'}]},steam);
  data.autoIgnore=false;change({autoIgnore:{newValue:false}},'local');
  await until(()=>data.ignoreState.queue.length===0&&!alarm);
  assert.equal(posts,1);
});
