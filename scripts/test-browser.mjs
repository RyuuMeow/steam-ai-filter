import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const cache = path.join(local, 'ms-playwright');
const installs = existsSync(cache) ? (await readdir(cache)).filter(name => /^chromium_headless_shell-/.test(name)).sort().reverse() : [];
const candidates = [process.env.BROWSER_BIN, ...installs.map(name => path.join(cache,name,'chrome-headless-shell-win64','chrome-headless-shell.exe')),
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
const executable = candidates.find(file => file && existsSync(file));
if (!executable) throw new Error('Set BROWSER_BIN to a Chromium browser executable.');
await mkdir('artifacts/browser-tests', {recursive:true});
const profile = path.resolve('artifacts/browser-tests', `profile-${process.pid}`);
const server = spawn(process.execPath, ['scripts/serve.mjs'], {windowsHide:true, stdio:['ignore','ignore','pipe']});
let serverError = '';
server.stderr.on('data', chunk => { serverError += chunk; });
const browser = spawn(executable, ['--headless', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-gpu', '--window-size=1280,1000', 'about:blank'], {windowsHide:true, stdio:['ignore','ignore','pipe']});
let browserLog = '', socket;
browser.stderr.on('data', chunk => { browserLog += chunk; });
browser.on('error', error => { browserLog += error.message; });
const tests = [
  ['categories','/tests/categories.html?test=1'], ['removal','/tests/removal.html?test=1'], ['automation','/tests/automation.html?test=1'],
  ['settings','/tests/settings.html?test=1'], ['interactions','/tests/interactions.html?test=1'], ['popup-sizing','/tests/popup-sizing.html'], ['home','/?test=1'], ['search','/search/?test=1'],
  ['mask-performance','/tests/mask-performance.html'],
  ['home-single','/tests/home-single.html?test=1'], ['layout','/tests/layout.html?test=1'], ['lookup','/?lookup=1'],
  ['storewide','/sale/nextfest?coverage=1'], ['recommendations','/app/620/?coverage=1'], ['detail','/app/4517370/'],
  ...['sync','async','id','pending','storage'].flatMap(kind => [false,true].map(remove => [`invalidation-${kind}${remove?'-hide':''}`,`/tests/invalidation.html?case=${kind}${remove?'&remove=1':''}`]))
];
let failures = 0;
try {
  let endpoint;
  for(let i=0;i<100;i++) {
    endpoint = browserLog.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
    if(endpoint) break;
    if(browser.exitCode !== null) throw new Error(browserLog || 'Browser exited');
    await delay(100);
  }
  if(!endpoint) throw new Error(`Browser did not start: ${browserLog}`);
  const debugOrigin = endpoint.replace(/^ws:/,'http:').replace(/\/devtools\/.*/, '');
  let up=false;
  for(let i=0;i<50;i++) {
    if(server.exitCode !== null) throw new Error(serverError);
    try { if((await fetch('http://127.0.0.1:4173/tests/bridge.js')).ok) { up=true; break; } } catch {}
    await delay(100);
  }
  if(!up) throw new Error('Preview server did not start');
  const target = await (await fetch(`${debugOrigin}/json/new?about:blank`,{method:'PUT'})).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject) => {socket.onopen=resolve;socket.onerror=reject;});
  let nextId=0;
  const pending = new Map();
  socket.onmessage = event => {
    const data=JSON.parse(event.data), entry=pending.get(data.id);
    if(entry) { pending.delete(data.id);clearTimeout(entry.timer);data.error?entry.reject(Error(data.error.message)):entry.resolve(data.result); }
  };
  function send(method,params={}) {
    return new Promise((resolve,reject)=>{
      const id=++nextId;
      const timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timeout: ${method}`));},15000);
      pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  for(const [name,route] of tests.filter(([name])=>!process.argv[2]||process.argv.slice(2).includes(name))) {
    await send('Page.navigate',{url:`http://127.0.0.1:4173${route}`});
    await delay(300);
    let state;
    for(let i=0;i<160;i++) {
      const result=await send('Runtime.evaluate',{expression:'({status:document.documentElement.dataset.tests, output:document.querySelector("#test-results")?.textContent, pointer:window.testPointerAction})',returnByValue:true});
      state=result.result.value;
      if(state?.pointer) {
        const {type,x,y,toX,toY}=state.pointer;
        await send('Runtime.evaluate',{expression:'window.testPointerAction=null'});
        await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
        if(type==='click'||type==='drag') {
          await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
          if(type==='drag') for(let n=1;n<=12;n++) {
            await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+(toX-x)*n/12,y:y+(toY-y)*n/12,buttons:1});
            await delay(15);
          }
          await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:toX??x,y:toY??y,button:'left',clickCount:1});
        }
        await send('Runtime.evaluate',{expression:'window.testPointerDone=true'});
      }
      if(state?.status)break;
      await delay(100);
    }
    await writeFile(`artifacts/browser-tests/${name}.txt`,state?.output||'Timed out');
    if(state?.status==='passed') console.log(`PASS ${name}`);
    else {
      failures++;console.error(`FAIL ${name}\n${state?.output||'Timed out'}`);
      const screenshot=await send('Page.captureScreenshot',{format:'png'});
      await writeFile(`artifacts/browser-tests/${name}.png`,Buffer.from(screenshot.data,'base64'));
    }
  }
  if(process.argv.includes('--preview')) {
    await send('Page.navigate',{url:'http://127.0.0.1:4173/tests/settings.html'});
    await delay(700);
    for(const mode of ['mark','mask','hide']) {
      await send('Runtime.evaluate',{expression:`testSettings({mode:'${mode}'})`,awaitPromise:true});
      await delay(300);
      const shot=await send('Page.captureScreenshot',{format:'png'});
      await writeFile(`artifacts/browser-tests/preview-${mode}.png`,Buffer.from(shot.data,'base64'));
    }
    await send('Runtime.evaluate',{expression:"testSettings({mode:'mask'})",awaitPromise:true});
    const cardPoint=await send('Runtime.evaluate',{expression:"(()=>{const r=document.querySelector('#mixed').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()",returnByValue:true});
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',...cardPoint.result.value});await delay(250);
    let shot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile('artifacts/browser-tests/preview-mask-actions.png',Buffer.from(shot.data,'base64'));
    await send('Runtime.evaluate',{expression:"document.querySelector('#mixed [data-action=reveal]').click()"});await delay(200);
    shot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile('artifacts/browser-tests/preview-revealed.png',Buffer.from(shot.data,'base64'));
    for(const language of ['en','zh-Hans']) {
      await send('Runtime.evaluate',{expression:`testSettings({mode:'mark',language:'${language}'})`,awaitPromise:true});await delay(200);
      shot=await send('Page.captureScreenshot',{format:'png'});
      await writeFile(`artifacts/browser-tests/preview-${language}.png`,Buffer.from(shot.data,'base64'));
    }
    await send('Runtime.evaluate',{expression:"testSettings({language:'zh-Hant'})",awaitPromise:true});
    await send('Runtime.evaluate',{expression:'document.querySelector("iframe").contentDocument.querySelector("#settings").click()'});
    for(const page of ['settings','network']) {
      if(page==='network') await send('Runtime.evaluate',{expression:'document.querySelector("iframe").contentDocument.querySelector("[data-open=network]").click()'});
      await delay(300);
      const shot=await send('Page.captureScreenshot',{format:'png'});
      await writeFile(`artifacts/browser-tests/preview-${page}.png`,Buffer.from(shot.data,'base64'));
    }
    const selectPoint=await send('Runtime.evaluate',{expression:"(()=>{const frame=document.querySelector('iframe'),f=frame.getBoundingClientRect(),r=frame.contentDocument.querySelector('#request-gap-trigger').getBoundingClientRect();return{x:f.left+r.left+r.width/2,y:f.top+r.top+r.height/2}})()",returnByValue:true});
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...selectPoint.result.value,button:'left',clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',...selectPoint.result.value,button:'left',clickCount:1});await delay(200);
    shot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile('artifacts/browser-tests/preview-dropdown.png',Buffer.from(shot.data,'base64'));
    console.log('Saved mode and settings screenshots in artifacts/browser-tests/.');
  }
} finally { socket?.close();browser.kill();server.kill(); }
if(failures)process.exitCode=1;
