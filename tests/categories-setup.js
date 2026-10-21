testBridge.data.mode = 'hide';
const now = Date.now();
testBridge.data.disclosureCache = {version:1,sessionAware:true,items:{
  901:{state:'disclosed',disclosure:'AI was used only for code assistance.',checkedAt:now,expiresAt:now+60000},
  905:{state:'unavailable',disclosure:null,checkedAt:now,expiresAt:now+60000}
}};
let lookupCount = 0, resolveCodeLookup;
window.testLookup = id => {
  lookupCount++;
  return id === '908' ? new Promise(resolve => { resolveCodeLookup = resolve; })
    : {state:'unavailable',disclosure:null,checkedAt:Date.now(),expiresAt:Date.now()+60000};
};
