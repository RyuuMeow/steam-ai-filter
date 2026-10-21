const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dist/i18n.js','utf8');
function setup(language='en') {
  const context=vm.createContext({navigator:{language}});vm.runInContext(source,context);return context.SAFI18n;
}
test('all interface languages cover the same keys and interpolation parameters',()=>{
  const i=setup(),keys=Object.keys(i.messages.en).sort();
  for(const [language,messages] of Object.entries(i.messages)){
    assert.deepEqual(Object.keys(messages).sort(),keys);
    for(const key of keys){
      assert.ok(messages[key].length,`${language} ${key}`);
      assert.deepEqual(messages[key].match(/\{\w+\}/g)?.sort(),i.messages.en[key].match(/\{\w+\}/g)?.sort(),key);
    }
  }
});
test('browser language defaults, explicit choices, and worker fallback are deterministic',()=>{
  for(const [input,expected] of [['zh-TW','zh-Hant'],['zh_HK','zh-Hant'],['zh-Hant','zh-Hant'],['zh-CN','zh-Hans'],['zh-SG','zh-Hans'],['zh','zh-Hans'],['en-GB','en'],['ja','en']])
    assert.equal(setup(input).normalizeLanguage(undefined),expected);
  const i=setup('zh-TW');assert.equal(i.normalizeLanguage('en'),'en');
  const context=vm.createContext({chrome:{i18n:{getUILanguage:()=> 'zh-CN'}}});vm.runInContext(source,context);
  assert.equal(context.SAFI18n.normalizeLanguage(undefined),'zh-Hans');
});
test('language changes translate stored service notices while preserving titles and unknown source text',()=>{
  const i=setup();i.setLanguage('zh-Hant');const prior=i.t('automation.ignored',{title:'My <Game> 中文'});
  i.setLanguage('en');assert.equal(i.localizeStored(prior),'Ignored: My <Game> 中文');
  i.setLanguage('zh-Hans');assert.equal(i.localizeStored('Could not load store page (403)'),'商店页面读取失败（403）');
  assert.equal(i.localizeStored('Developer disclosure: AI artwork'),'Developer disclosure: AI artwork');
  i.setLanguage('zh-Hant');assert.equal(i.t('mask.label'),'AI生成內容');
});
