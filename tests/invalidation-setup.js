// Chrome API lifecycle simulation only; never shipped with the extension.
testBridge.data.mode = new URLSearchParams(location.search).has('remove') ? 'hide' : 'mask';
document.querySelector('.card').insertAdjacentHTML('beforeend','<section class="game_area_description" hidden><h2>AI Generated Content Disclosure</h2><i>AI artwork.</i></section>');
chrome.runtime.id = 'fixture-extension';
const lifecycleCase = new URLSearchParams(location.search).get('case') || 'sync';
const lifecycleProbe = {calls: 0, errors: [], armed: false, settle: null};
const originalSend = chrome.runtime.sendMessage;
chrome.runtime.sendMessage = message => {
  lifecycleProbe.calls++;
  if (message.type === 'SAF_UPDATED') return Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
  if (message.type === 'SAF_LOOKUP' && lifecycleProbe.armed) {
    if (lifecycleCase === 'sync') throw new Error('Extension context invalidated.');
    if (lifecycleCase === 'async') return Promise.reject(new Error('Extension context invalidated.'));
    if (lifecycleCase === 'pending') return new Promise(resolve => { lifecycleProbe.settle = resolve; });
  }
  return originalSend(message);
};
for (const type of ['error', 'unhandledrejection']) {
  window.addEventListener(type, event => {
    lifecycleProbe.errors.push(String(event.error || event.reason || event.message));
    event.preventDefault();
  });
}
