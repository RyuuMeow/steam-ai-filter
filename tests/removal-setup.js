testBridge.data.mode = 'mask';
testBridge.data.allow = {'704': 'Allowed game'};
let finishLookup;
window.testLookup = id => id === '708'
  ? new Promise(resolve => { finishLookup = resolve; })
  : Promise.resolve({state: 'unavailable', disclosure: null, checkedAt: Date.now(), expiresAt: Date.now() + 300000, issue: 'Offline fixture'});
