// Test/preview only. This adapter is NEVER copied into the extension's dist directory.
(() => {
  const owner = window.parent === window ? window : window.parent;
  owner.testBridge ||= {data:{level:1,allow:{}}, changes:[], messages:[]};
  const bridge = owner.testBridge;
  window.chrome = {
    storage:{
      local:{
        get: async () => structuredClone(bridge.data),
        set: async values => {
          const changes = {};
          for(const [key,value] of Object.entries(values)) {
            changes[key] = {oldValue:bridge.data[key],newValue:structuredClone(value)};
            bridge.data[key] = structuredClone(value);
          }
          for(const listener of bridge.changes) listener(changes,'local');
        }
      },
      onChanged:{addListener:fn=>bridge.changes.push(fn)}
    },
    runtime:{
      id:'fixture-extension',
      onMessage:{addListener:fn=>bridge.messages.push(fn)},
      sendMessage:async message=>{
        if(message.type==='SAF_LOOKUP') return owner.testLookup ? owner.testLookup(message.id) :
          {state:'unavailable',disclosure:null,checkedAt:Date.now(),expiresAt:Date.now()+300000,issue:'離線預覽'};
        if(message.type==='SAF_CLEAR_CACHE') {
          if(owner.testClearCache) await owner.testClearCache();
          else await chrome.storage.local.set({disclosureCache:{version:1,items:{},cooldownUntil:0}});
          return {ok:true};
        }
        for(const listener of bridge.messages) listener(message,{tab:{id:1}},()=>{});
      }
    },
    tabs:{
      query:async()=>[{id:1}],
      sendMessage:async (_id,message)=>new Promise(resolve=>{
        if(!bridge.messages.length) return resolve(null);
        setTimeout(()=>resolve(null),100);
        for(const listener of bridge.messages) listener(message,{},resolve);
      })
    }
  };
})();
