const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ctx = vm.createContext({});
for (const file of ['disclosure-keywords', 'disclosure', 'core']) vm.runInContext(fs.readFileSync(`dist/${file}.js`, 'utf8'), ctx);
const classify = ctx.SAFDisclosure.isCodeOnly;
const S = ctx.SAF;

test('explicit code-only disclosures in English and Chinese are accepted', () => {
  for (const text of [
    'AI was used only for code assistance.',
    'We used ChatGPT exclusively to help write and debug code.',
    'AI was used solely for programming and debugging.',
    'Only coding assistance.',
    'AI Generated Content Disclosure: AI was used only for programming.',
    'AI was used only for code. No AI-generated art, music or dialogue is used.',
    'AI was used only for programming. All art and music were created by humans.',
    '本作僅使用 AI 輔助程式碼撰寫與除錯。',
    '仅使用 AI 辅助代码编写和调试。',
    'AI 僅用於程式開發。沒有 AI 生成的美術或音樂。',
    'AI 仅用于代码编写。所有美术均为手工制作。'
  ]) assert.equal(classify(text), true, text);
});
test('mixed uses and ambiguous descriptions never get the code exception', () => {
  for (const text of [
    'AI was used for code assistance.',
    'AI was used only for code and art.',
    'AI was used only for code, translation and localization.',
    'AI was used only for code and voice generation.',
    'AI was used only for code and NPC dialogue.',
    'AI was used only for code and game design.',
    'AI was used only for scripts.',
    'Only the code is human-written.',
    'Only the code is human, the rest is AI generated.',
    '只有程式碼是手寫。',
    'AI was used only for code. Music was generated with Suno.',
    'AI was used only for code. We used another tool to help us too.',
    'AI was primarily used for code.',
    'AI was not only used for code.',
    'AI was used only for programming etc.',
    'AI was used only for code and other purposes.',
    'AI was used only for code. No AI-generated art is used but music is generated.',
    'AI was used only for code. No AI-generated art is used and music is generated.',
    'AI was used only for code. All art is hand-drawn and AI music is included.',
    'AI was used only for code. All art is hand-drawn except the backgrounds.',
    'No AI was used for code. AI art only.',
    'AI is only used for code while playing in real time.',
    'AI 僅用於程式碼和美術。',
    'AI 僅用於程式碼。沒有 AI 美術，但是配音是 AI 生成。',
    '本作主要使用 AI 輔助程式碼。',
    'AI used for translating store page only.',
    'We used AI to generate some game scene images, icons, translation and code.',
    '', null, 'AI was used only for code.' + ' '.repeat(2000)
  ]) assert.equal(classify(text), false, text);
});
test('default enabled exception applies to known code-only evidence, not tag-only guesses', () => {
  const evidence = {id:'42',title:'Test',disclosure:'AI was used only for programming.',tagMatch:true,tagAvailable:true,parseIssue:false};
  for (const level of [0,1,2,3]) {
    assert.equal(S.shouldHide(evidence, level, {}), false);
    assert.equal(S.shouldHide(evidence, level, {}, false), level >= 2);
    assert.equal(S.shouldHide(evidence, level, {'42':'Test'}, false), false);
  }
  assert.equal(S.shouldHide({...evidence,disclosure:null},3,{},true),true);
  assert.equal(S.shouldHide({...evidence,disclosure:'AI code and art.'},2,{},true),true);
});
test('new and existing installs default on; saved off remains off', async () => {
  for (const value of [undefined,null,true,0,'false',{}]) assert.equal(S.normalizeAcceptAICode(value),true);
  assert.equal(S.normalizeAcceptAICode(false),false);
  ctx.chrome = {storage:{local:{get:async()=>({level:2,presentation:'remove',allow:{}})}}};
  assert.equal((await S.getSettings()).acceptAICode,true);
  ctx.chrome.storage.local.get=async()=>({acceptAICode:false});
  assert.equal((await S.getSettings()).acceptAICode,false);
});
test('classification depends only on current disclosure, not previous results', () => {
  for (let i=0;i<510;i++) classify(`AI was used only for code ${i}.`);
  assert.equal(classify('AI was used only for code.'),true);
  assert.equal(classify('AI was used only for code and images.'),false);
  assert.equal(classify('AI was used only for code.'),true);
});
