(async () => {
  const out = document.querySelector('#test-results');
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async predicate => {
    for (let i = 0; i < 60; i++) { if (predicate()) return; await wait(25); }
    throw new Error('Timed out waiting for lifecycle state');
  };
  const assert = (ok, label) => {
    out.textContent += `${ok ? 'PASS' : 'FAIL'} ${label}\n`;
    if (!ok) throw new Error(label);
  };
  const addCard = id => {
    const card = document.createElement('a');
    card.className = 'card'; card.href = `https://store.steampowered.com/app/${id}/`;
    card.innerHTML = `<img alt="Unknown game" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"><span class="title">Unknown ${id}</span>`;
    document.querySelector('main').append(card); return card;
  };
  try {
    const removeMode = testBridge.data.mode === 'hide';
    await until(() => document.querySelector(removeMode ? '.saf-removed' : '.saf-blocked'));
    await wait(100);
    assert(!lifecycleProbe.errors.length, 'closed popup receiver is an expected nonfatal condition');
    assert(removeMode ? document.querySelector('.card').getBoundingClientRect().height === 0 : document.querySelector('.card img').inert, 'known match starts in the selected presentation');
    lifecycleProbe.armed = true;
    if (lifecycleCase === 'id') chrome.runtime.id = undefined;
    if (lifecycleCase === 'storage') {
      chrome.storage.local.get = () => { throw new Error('Extension context invalidated.'); };
      document.querySelector('#saf-root').shadowRoot.querySelector('#list button').click();
      document.querySelector('#saf-root').shadowRoot.querySelector('#allow').click();
    } else addCard(602);
    if (lifecycleCase === 'pending') {
      await until(() => lifecycleProbe.settle);
      chrome.runtime.id = undefined;
      lifecycleProbe.settle({state:'disclosed',disclosure:'Late response',checkedAt:Date.now(),expiresAt:Date.now()+60000});
    }
    await wait(450);
    assert(!lifecycleProbe.errors.length, `invalidation produces no uncaught error (${lifecycleProbe.errors.join('; ')})`);
    assert(!document.querySelector('.saf-mask,.saf-badge,.saf-removed') && document.querySelector('.card').getBoundingClientRect().height > 0, 'all cards are restored, without old masks, removals or badges');
    assert(!document.querySelector('.card img').inert && !document.querySelector('.card').hasAttribute('role'), 'original card accessibility is restored');
    const shadow = document.querySelector('#saf-root').shadowRoot;
    assert(shadow.querySelector('#stat').textContent.includes('重新整理'), 'one visible refresh instruction replaces obsolete controls');
    assert(!shadow.querySelector('dialog').open, 'stale dialog is closed');
    const calls = lifecycleProbe.calls;
    addCard(603);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PopStateEvent('popstate'));
    await wait(450);
    assert(lifecycleProbe.calls === calls && !document.querySelector('.saf-mask,.saf-badge,.saf-removed'), 'later DOM and visibility events cannot restart the dead instance');
    out.textContent += `ALL INVALIDATION TESTS PASSED (${lifecycleCase})`;
    document.documentElement.dataset.tests = 'passed';
  } catch (error) {
    out.textContent += `FAIL ${error.message}\n`;
    document.documentElement.dataset.tests = 'failed';
  }
})();
