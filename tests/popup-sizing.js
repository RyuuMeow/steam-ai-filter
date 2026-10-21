const frame = document.querySelector('iframe');
const out = document.querySelector('#test-results');
frame.addEventListener('load', async () => {
  const wait = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const assert = (ok, label) => {
    out.textContent += `${ok ? 'PASS' : 'FAIL'} ${label}\n`;
    if (!ok) throw new Error(label);
  };
  const doc = frame.contentDocument;
  try {
    await wait();
    // The action popup host measures content; a fixed-width iframe cannot expose this feedback loop.
    for (const initial of [95, 25, 800, 375, 1280]) {
      frame.style.width = `${initial}px`;
      await wait();
      const preferred = doc.body.getBoundingClientRect().width;
      assert(Math.abs(preferred - 320) < 1, `${initial}px initial viewport yields 320px content (actual ${preferred})`);
      frame.style.width = `${preferred}px`;
      await wait();
      assert(doc.documentElement.scrollWidth === 320, 'measured popup has no horizontal overflow');
    }
    doc.querySelector('#settings').click();
    await wait();
    for(const category of ['checking','network','display','automation']) {
      doc.querySelector(`[data-open="${category}"]`).click();await wait();
      assert(Math.abs(doc.body.getBoundingClientRect().width-320)<1&&doc.documentElement.scrollWidth===320, `${category} page stays within popup width`);
      doc.querySelector('#back').click();await wait();
    }
    doc.querySelector('#back').click();await wait();
    assert(doc.querySelectorAll('#category-list input').length===7&&doc.documentElement.scrollWidth===320, 'seven direct categories fit the 320px popup');
    assert([...doc.querySelectorAll('#category-list label')].every(row => {
      const bounds=row.getBoundingClientRect();
      return bounds.width>0&&bounds.right<=320&&bounds.height>=36;
    }), 'all category labels and switches remain inside the popup with usable row heights');
    frame.style.height = '600px';
    await wait();
    assert(frame.contentWindow.getComputedStyle(doc.documentElement).overflowX==='hidden'
      && [...doc.querySelectorAll('#category-list input')].every(input=>input.getBoundingClientRect().right<=doc.documentElement.clientWidth),
      'height-limited popup scrolls vertically without a horizontal bar or clipped switches');
    frame.style.height = `${doc.body.scrollHeight}px`;
    out.textContent += 'ALL POPUP SIZING TESTS PASSED';
    document.documentElement.dataset.tests = 'passed';
  } catch (error) {
    document.documentElement.dataset.tests = 'failed';
    out.textContent += error.message;
  }
});
