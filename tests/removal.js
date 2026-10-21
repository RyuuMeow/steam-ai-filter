const frame = document.querySelector('iframe');
frame.addEventListener('load', () => {
  const doc = frame.contentDocument;
  new ResizeObserver(() => { frame.style.height = `${doc.body.scrollHeight + 8}px`; }).observe(doc.body);
});
document.querySelector('.catalog').addEventListener('click', event => event.preventDefault());
if (new URLSearchParams(location.search).has('test')) (async () => {
  const out = document.querySelector('#test-results');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async predicate => {
    for (let i = 0; i < 120; i++) { if (predicate()) return; await wait(25); }
    throw new Error('Timed out waiting for state');
  };
  const assert = (ok, label) => { if (!ok) throw new Error(label); out.textContent += `PASS ${label}\n`; };
  const popup = () => frame.contentDocument;
  const shadow = () => document.querySelector('#saf-root').shadowRoot;
  const removed = () => document.querySelectorAll('.saf-removed').length;
  const visible = card => card.getBoundingClientRect().height > 0;
  const level = async value => {
    const input=popup().querySelector('#strength');input.value=value;input.dispatchEvent(new Event('input'));input.dispatchEvent(new Event('change'));
    await until(()=>testBridge.data.mode===['off','mark','mask','hide'][value]);await wait(50);
  };
  const choose = value=>level(value==='remove'?3:2);
  const card = id => document.querySelector(`#${id}`);
  const addCard = (id, tags) => {
    const node = document.createElement('a'); node.className = 'card';
    node.href = `https://store.steampowered.com/app/${id}/`;
    if (tags) node.dataset.dsTagids = tags;
    node.innerHTML = `<img alt="New arrival ${id}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"><span class="title">New arrival ${id}</span>`;
    document.querySelector('.catalog').append(node); return node;
  };
  try {
    await until(() => popup()?.querySelector('#strength')?.disabled === false && document.querySelectorAll('.saf-blocked').length === 2);
    assert(popup().querySelector('#strength').value==='2' && removed() === 0, 'existing installs default to masks');
    const normalY = card('unknown').getBoundingClientRect().top;
    const original = card('disclosed');
    await choose('remove');
    assert(removed() === 2 && !document.querySelector('.saf-mask'), 'disclosure level removes both matching cards, without masks');
    assert(!visible(original) && original.isConnected, 'removed card occupies zero space and can be recovered');
    assert(card('unknown').getBoundingClientRect().top < normalY, 'remaining grid cards close the gap');
    assert(visible(card('tagged')) && visible(card('unknown')) && visible(card('allowed')), 'tag-only, unknown and allowlisted games remain visible');
    assert(original.getAttribute('aria-label') === 'Original game link' && !original.querySelector('img').inert, 'switching away from masks restores original accessibility');
    assert(popup().querySelector('#status').textContent.includes('已隱藏 2 / 5') && popup().querySelector('#rule-text').textContent.includes('隱藏'), 'popup describes the committed removal mode');
    assert(shadow().querySelector('#stat').textContent.includes('已隱藏 2 / 5'), 'page count includes removed cards with the correct action');
    popup().querySelector('#reveal').click(); await until(() => removed() === 0);
    assert(visible(original) && original === card('disclosed'), 'temporary reveal restores the same original card');
    popup().querySelector('#reveal').click(); await until(() => removed() === 2);
    assert(!visible(original), 'resume filtering restores removal');
    await level(3);
    assert(removed() === 2 && visible(card('allowed')) && visible(card('tagged')), 'hide mode preserves exceptions and ignores topic tags');
    await choose('mask');
    assert(removed() === 0 && document.querySelectorAll('.saf-mask').length === 2 && visible(original), 'switching back restores card dimensions and masks');
    assert(original.querySelector('img').inert, 'restored masks suppress child interaction again');
    await choose('remove');
    const reason = Array.from(shadow().querySelectorAll('#list button')).find(button => button.textContent.startsWith('Generated Worlds'));
    reason.click(); shadow().querySelector('#allow').click();
    await until(() => removed() === 0); shadow().querySelector('#close').click();
    assert(visible(original) && visible(card('duplicate')), 'reason list can allow a removed game and restore all its cards');
    popup().querySelector('#settings').click();popup().querySelector('[data-open=automation]').click();
    popup().querySelector('#allow-list button[aria-label*="Generated Worlds"]').click();
    await until(() => removed() === 2);
    assert(!visible(original), 'removing an exception reapplies removal');
    const appended = addCard(706, '[7926]');
    appended.insertAdjacentHTML('beforeend','<section class="game_area_description" hidden><h2>AI Generated Content Disclosure</h2><i>AI art.</i></section>');await until(() => removed() === 3);
    assert(!visible(appended), 'new matching cards are removed without a page reload');
    appended.href = 'https://store.steampowered.com/app/707/'; appended.dataset.dsTagids = '[19]';appended.querySelector('.game_area_description').remove();
    await until(() => removed() === 2);
    assert(visible(appended), 'Steam recycling a removed card to a different game restores it');
    const pending = addCard(708); await until(() => finishLookup);
    assert(visible(pending), 'unknown card remains visible while disclosure lookup is pending');
    finishLookup({state:'disclosed', disclosure:'Demo: AI art', checkedAt:Date.now(), expiresAt:Date.now()+60000});
    await until(() => removed() === 3);
    assert(!visible(pending), 'background disclosure applies the selected removal mode');
    await level(1);
    assert(removed() === 0 && !document.querySelector('.saf-mask') && !popup().querySelector('#presentation'), 'mark-only retains every card and hides the irrelevant toggle');
    await level(0);
    assert(!document.querySelector('.saf-badge,.saf-mask,.saf-removed') && visible(original), 'off restores all card presentation');
    await level(3);
    assert(removed() === 3 && popup().querySelector('#strength').value==='3', 'returning to filtering remembers removal');
    frame.contentWindow.location.reload();
    await until(() => popup()?.querySelector('#strength')?.disabled === false);
    assert(popup().querySelector('#strength').value==='3', 'reopening popup restores the saved selection');
    await testSettings({mode:'mask'}); await wait(50);
    assert(popup().querySelector('#strength').value==='2' && removed() === 0, 'external setting changes sync the popup and page');
    const local = frame.contentWindow.chrome.storage.local, originalSet = local.set;
    local.set = async () => { throw new Error('Simulated storage failure'); };
    const slider=popup().querySelector('#strength');slider.value=3;slider.dispatchEvent(new Event('change'));await wait(100);
    assert(!popup().querySelector('#error').hidden && popup().querySelector('#strength').value==='2' && removed() === 0, 'failed save reports the error and restores the committed selection');
    local.set = originalSet;
    await choose('remove');
    assert(popup().querySelector('#error').hidden && removed() === 3, 'a successful retry clears the save error');
    out.textContent += 'ALL REMOVAL TESTS PASSED';
    document.documentElement.dataset.tests = 'passed';
  } catch (error) {
    out.textContent += `FAIL ${error.stack}`;
    document.documentElement.dataset.tests = 'failed';
  }
})();
