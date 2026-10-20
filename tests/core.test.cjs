const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync('dist/core.js', 'utf8'), ctx);
const S = ctx.SAF;
const evidence = (patch={}) => ({id:'42',title:'Test',tagMatch:false,tagAvailable:false,disclosure:null,parseIssue:false,...patch});
test('all four levels: disclosure, tag-only and unknown', () => {
  for (const level of [0,1,2,3]) {
    assert.equal(S.shouldHide(evidence({disclosure:'Original disclosure'}), level, {}), level >= 2);
    assert.equal(S.shouldHide(evidence({tagMatch:true}), level, {}), level === 3);
    assert.equal(S.shouldHide(evidence(), level, {}), false);
  }
});
test('allowlist wins over every match and level', () => {
  for (const level of [0,1,2,3]) assert.equal(S.shouldHide(evidence({disclosure:'yes',tagMatch:true}), level, {'42':'Test'}), false);
});
test('invalid storage values do not activate broad filtering', () => {
  for (const v of [-1,4,NaN,undefined,null,'3',1.5]) assert.equal(S.normalizeLevel(v), 1);
  assert.equal(S.normalizeLevel(0),0);
  assert.deepEqual(Object.keys(S.cleanAllow({'42':'Valid','__proto__':'no',abc:'no',43:5})),['42']);
});
test('exact multilingual tag match, not title keywords or combat AI', () => {
  for (const text of ['人工智慧','人工智能',' Artificial   Intelligence ']) assert.equal(S.isAITag(text),true);
  for (const text of ['AI','AI companion','Artificial Intelligence Simulator','Railway']) assert.equal(S.isAITag(text),false);
});
test('tag JSON errors are distinguished from missing data', () => {
  assert.equal(S.parseTagIds('[7926,19]').ids.includes('7926'),true);
  assert.equal(S.parseTagIds('["7926"]').issue,false);
  for (const raw of ['broken','{}','null','[null]','[true]']) assert.equal(S.parseTagIds(raw).issue,true);
  assert.equal(S.parseTagIds(null).issue,false);
});
test('AI disclosure headings are separated from mature-content descriptors', () => {
  for (const text of ['AI Generated Content Disclosure','AI 生成內容聲明','AI 生成内容声明','AI 生成内容披露']) assert.equal(S.isDisclosureHeading(text),true);
  for (const text of ['Mature Content Description','About This Game','Artificial Intelligence']) assert.equal(S.isDisclosureHeading(text),false);
});
test('manifest is restricted and every referenced asset exists', () => {
  const m=JSON.parse(fs.readFileSync('dist/manifest.json','utf8'));
  assert.equal(m.manifest_version,3);
  assert.deepEqual(m.permissions,['storage']);
  assert.equal(m.host_permissions,undefined);
  assert.ok(m.content_scripts[0].matches.includes('https://store.steampowered.com/'));
  assert.ok(m.content_scripts[0].matches.includes('https://store.steampowered.com/?*'));
  assert.ok(m.content_scripts[0].js.includes('mask.js'));
  for(const f of [...m.content_scripts[0].js,...m.content_scripts[0].css,m.action.default_popup]) assert.ok(fs.existsSync('dist/'+f));
});
test('homepage, search and details are supported, unrelated pages are not',()=>{
  assert.equal(S.pageKind('/'),'home');
  assert.equal(S.pageKind('/search/'),'search');
  assert.equal(S.pageKind('/app/100/'),'app');
  assert.equal(S.pageKind('/account/'),null);
});
test('same-page app evidence merges and clears without retaining old positives',()=>{
  const first={},second={};
  const sources=new Map([[first,evidence({tagMatch:true})],[second,evidence()]]);
  assert.equal(S.mergeEvidence(sources).get(second).tagMatch,true);
  sources.delete(first);
  assert.equal(S.mergeEvidence(sources).get(second).tagMatch,false);
});
