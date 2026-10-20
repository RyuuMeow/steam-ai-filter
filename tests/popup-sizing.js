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
    for (const initial of [95, 25, 800]) {
      frame.style.width = `${initial}px`;
      await wait();
      const preferred = doc.body.getBoundingClientRect().width;
      assert(Math.abs(preferred - 320) < 1, `${initial}px initial viewport yields 320px content (actual ${preferred})`);
      frame.style.width = `${preferred}px`;
      await wait();
      assert(doc.documentElement.scrollWidth === 320, 'measured popup has no horizontal overflow');
    }
    doc.querySelector('summary').click();
    await wait();
    assert(Math.abs(doc.body.getBoundingClientRect().width - 320) < 1, 'management does not change popup width');
    doc.querySelector('summary').click();
    frame.style.height = `${doc.body.scrollHeight}px`;
    out.textContent += 'ALL POPUP SIZING TESTS PASSED';
    document.documentElement.dataset.tests = 'passed';
  } catch (error) {
    document.documentElement.dataset.tests = 'failed';
    out.textContent += error.message;
  }
});
