const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ctx = vm.createContext({});
for (const file of ['disclosure-keywords', 'disclosure', 'core']) vm.runInContext(fs.readFileSync(`dist/${file}.js`, 'utf8'), ctx);
const S = ctx.SAF;
const evidence = (patch={}) => ({id:'42',title:'Test',tagMatch:false,tagAvailable:false,disclosure:null,parseIssue:false,...patch});
test('all modes require formal selected-use evidence; tag-only never matches', () => {
  for (const mode of ['off','mark','mask','hide']) {
    assert.equal(S.shouldHide(evidence({disclosure:'AI-generated artwork'}), mode, {}), ['mask','hide'].includes(mode));
    assert.equal(S.shouldHide(evidence({tagMatch:true}), mode, {}), false);
    assert.equal(S.shouldHide(evidence(), mode, {}), false);
    assert.equal(S.shouldHide(evidence({disclosure:'AI art'}), mode, {'42':'Test'}), false);
  }
});
test('legacy mode migration preserves action and never interprets broad as hide', () => {
  for(const level of [0,1,2,3]) for(const presentation of ['mask','remove']) {
    const expected=level===0?'off':level===1?'mark':presentation==='remove'?'hide':'mask';
    const data={level,presentation,allow:{42:'Game'},autoIgnore:true,showChecked:false,filterCategories:{code:true}};
    const result=S.normalizeSettings(data);
    assert.equal(result.mode,expected);
    assert.equal(result.filterCategories.code,true);assert.equal(result.filterCategories.unknown,false);
    assert.equal(result.allow['42'],'Game');assert.equal(result.autoIgnore,true);assert.equal(result.showChecked,false);
    assert.equal(S.normalizeSettings({...data,mode:'off',settingsVersion:2}).mode,'off');
  }
  assert.equal(S.normalizeSettings({}).mode,'mask');
});
test('corrupt mode and query settings use conservative defaults', () => {
  for(const value of [-1,4,NaN,null,'3',1.5,{},'broad']) assert.equal(S.normalizeMode(value),'mask');
  const s=S.normalizeSettings({mode:'bad',requestGap:-1,concurrency:999,cacheDays:Infinity});
  assert.equal(s.requestGap,700);assert.equal(s.concurrency,2);assert.equal(s.cacheDays,0);
  assert.equal(S.normalizeSettings({requestGap:2000,concurrency:4,cacheDays:30}).cacheDays,30);
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
  assert.deepEqual(m.permissions,['storage','alarms']);
  assert.deepEqual(m.host_permissions,['https://store.steampowered.com/*']);
  assert.ok(fs.existsSync('dist/'+m.background.service_worker));
  assert.deepEqual(m.content_scripts[0].matches,['https://store.steampowered.com/*']);
  assert.ok(m.content_scripts[0].js.includes('mask.js'));
  assert.ok(m.content_scripts[0].js.includes('layout.js'));
  for(const f of [...m.content_scripts[0].js,...m.content_scripts[0].css,m.action.default_popup]) assert.ok(fs.existsSync('dist/'+f));
});
test('extension and toolbar use the supplied PNG icon sizes',()=>{
  const m=JSON.parse(fs.readFileSync('dist/manifest.json','utf8'));
  assert.deepEqual(m.icons,m.action.default_icon);
  for(const size of [16,32,48,128]){
    const image=fs.readFileSync('dist/'+m.icons[size]);
    assert.equal(image.subarray(1,4).toString(),'PNG');
    assert.equal(image.readUInt32BE(16),size);
    assert.equal(image.readUInt32BE(20),size);
  }
});
test('page labels never exclude any store route',()=>{
  assert.equal(S.pageKind('/'),'home');
  assert.equal(S.pageKind('/search/'),'search');
  assert.equal(S.pageKind('/app/100/'),'app');
  for(const path of ['/account/','/sale/nextfest','/category/rpg','/charts/topselling/','/wishlist/id/test/','/curator/123/','/future/new-layout/']) assert.equal(S.pageKind(path),'store');
});
test('same-page app evidence merges and clears without retaining old positives',()=>{
  const first={},second={};
  const sources=new Map([[first,evidence({tagMatch:true})],[second,evidence()]]);
  assert.equal(S.mergeEvidence(sources).get(second).tagMatch,true);
  sources.delete(first);
  assert.equal(S.mergeEvidence(sources).get(second).tagMatch,false);
});
