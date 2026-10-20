const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ctx = vm.createContext({});
for (const file of ['disclosure-keywords', 'disclosure', 'core']) vm.runInContext(fs.readFileSync(`dist/${file}.js`, 'utf8'), ctx);
const classify = text => Array.from(ctx.SAFDisclosure.classifyUses(text));
const S = ctx.SAF;
const evidence = disclosure => ({id:'42',title:'Test',disclosure,tagMatch:true,tagAvailable:true,parseIssue:false});

test('each local pack classifies its own English and Chinese disclosure', () => {
  const cases = {
    art:['AI generated artwork, icons and textures.','AI generated 2D assets.','AI-generated images based on hand-drawn references.','Midjourney was used for portraits.','AI 生成美術、插畫與背景圖。','使用 AI 生成图片和立绘。'],
    music:['AI generated background music and sound effects.','Music was generated with Suno.','AI 產生音樂和音效。'],
    voice:['AI generated voice acting.','We used text-to-speech.','使用 AI 配音與語音合成。'],
    text:['AI generated dialogue and story.','AI helped with copywriting.','AI 產生劇情、對話和文案。'],
    translation:['AI used for translating the existing dialogue and text.','AI text translation.','使用 AI 翻譯遊戲對話。','文字翻译使用 AI。'],
    code:['AI used for code assistance.','AI helps with writing code.','GitHub Copilot helped with debugging.','AI 輔助程式碼與除錯。','AI 辅助代码编写。']
  };
  for(const [category, examples] of Object.entries(cases)) for(const text of examples) assert.deepEqual(classify(text),[category],text);
});
test('mixed disclosures retain each positive category and ignore denied uses', () => {
  const cases = [
    ['AI was used for art, translation and code.',['art','translation','code']],
    ['AI was used only for code. No AI-generated art, music or dialogue is used.',['code']],
    ['AI used for translation, not art.',['translation']],
    ['AI was not used for code. AI art only.',['art']],
    ['All art is hand-drawn and AI music is included.',['music']],
    ['All art is hand-drawn except the backgrounds.',['art']],
    ['No AI art is used and music is generated.',['music']],
    ['AI was not only used for code and art.',['art','code']],
    ['AI artwork was generated, then manually edited.',['art']],
    ['AI was used to translate text and generate dialogue.',['text','translation']],
    ['AI 僅用於程式碼。沒有 AI 美術，但是配音是 AI 生成。',['voice','code']],
    ['AI 不僅用於美術，也用於翻譯。',['art','translation']],
    ['所有美術均為手繪。AI 翻譯對話。',['translation']],
    ['AI 仅用于代码。没有 AI 生成的美术或音乐。',['code']]
  ];
  for(const [text, expected] of cases) assert.deepEqual(classify(text),expected,text);
});
test('ambiguous words, negations and missing disclosures do not guess a use',()=>{
  for(const text of ['',null,'AI assisted development.','AI models and assets.','Scripts and characters.','No AI art or music.','No AI art and music is used.','We did not use AI for artwork.','All artwork and music were created by humans.','沒有 AI 生成的美術或音樂。']) assert.deepEqual(classify(text),[],text);
});
test('only selected categories filter; formal unknowns and unselected uses stay visible even in broad mode',()=>{
  for(const level of [0,1,2,3]) {
    assert.equal(S.shouldHide(evidence('AI art and code.'),level,{}),level>=2);
    assert.equal(S.shouldHide(evidence('AI translation and code.'),level,{}),false);
    assert.equal(S.shouldHide(evidence('AI used during development.'),level,{}),false);
    assert.equal(S.shouldHide(evidence('AI translation.'),level,{},S.normalizeCategories({translation:true})),level>=2);
    assert.equal(S.shouldHide(evidence('AI art.'),level,{},S.normalizeCategories({})),false);
    assert.equal(S.shouldHide(evidence(null),level,{},S.normalizeCategories({})),false);
    assert.equal(S.shouldHide(evidence('AI art.'),level,{'42':'Manual'}),false);
  }
  assert.equal(S.shouldHide(evidence(null),3,{}),true);
});
test('new and legacy installs default to art alone without changing other settings', async()=>{
  for(const value of [undefined,null,[],false,'art']) assert.deepEqual(JSON.parse(JSON.stringify(S.normalizeCategories(value))),{art:true,music:false,voice:false,text:false,translation:false,code:false});
  assert.deepEqual(JSON.parse(JSON.stringify(S.normalizeCategories({code:true,art:'true',music:1,unknown:true}))),{art:false,music:false,voice:false,text:false,translation:false,code:true});
  for(const acceptAICode of [undefined,true,false]) {
    ctx.chrome={storage:{local:{get:async()=>({acceptAICode,level:3,presentation:'remove',allow:{42:'Game'},autoIgnore:true,showChecked:false})}}};
    const s=await S.getSettings();
    assert.equal(s.filterCategories.art,true);assert.equal(s.filterCategories.code,false);
    assert.equal(s.level,3);assert.equal(s.presentation,'remove');assert.equal(s.allow['42'],'Game');assert.equal(s.autoIgnore,true);assert.equal(s.showChecked,false);
    assert.equal('acceptAICode' in s,false);
  }
  ctx.chrome.storage.local.get=async()=>({filterCategories:{}});
  assert.ok(Object.values((await S.getSettings()).filterCategories).every(value=>value===false));
});
test('cached classification is independent of selection and disclosure changes',()=>{
  for(let i=0;i<510;i++) classify(`AI code ${i}.`);
  assert.deepEqual(classify('AI code.'),['code']);
  assert.deepEqual(classify('AI code and art.'),['art','code']);
  assert.equal(S.shouldHide(evidence('AI code.'),2,{}),false);
  assert.equal(S.shouldHide(evidence('AI code.'),2,{},S.normalizeCategories({code:true})),true);
  assert.equal(S.shouldHide(evidence('AI code.'),2,{}),false);
});
