const assert = require('node:assert/strict');
const test = require('node:test');
const release = import('../scripts/release-info.mjs');

test('release versions agree across package, lockfile and installable manifests', async () => {
  const {readReleaseInfo} = await release;
  const info = await readReleaseInfo();
  assert.equal(info.tag, `v${info.version}`);
  assert.equal(info.asset, `artifacts/steam-ai-filter-v${info.version}.rar`);
});

test('release rejects a tag for a different version or a non-version ref', async () => {
  const {validateReleaseVersion} = await release;
  for (const tag of ['v0.7.2', '0.7.1', 'main', 'v0.7.1-beta.1', 'v0.7.1\nasset=bad']) {
    assert.throws(() => validateReleaseVersion(['0.7.1', '0.7.1'], tag), /Release tag must/);
  }
  assert.equal(validateReleaseVersion(['0.7.1', '0.7.1'], 'v0.7.1').version, '0.7.1');
});

test('release rejects a stale lockfile or manifest, including missing versions', async () => {
  const {validateReleaseVersion} = await release;
  for (const versions of [['0.7.1', '0.7.0'], ['0.7.1', undefined]]) {
    assert.throws(() => validateReleaseVersion(versions), /Versions differ/);
  }
});

test('release rejects versions unsupported by the extension or archive naming', async () => {
  const {validateReleaseVersion} = await release;
  for (const version of ['0.0.0', '65536.1.1', '01.7.1', '0.7.1-beta.1', '../bad', '', undefined]) {
    assert.throws(() => validateReleaseVersion([version]));
  }
});
