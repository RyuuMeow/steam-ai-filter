// Optional live smoke check: explicit public app IDs, production resolver.
// Node has no browser cookie jar, so this checks anonymous public access only.
import fs from 'node:fs/promises';
import vm from 'node:vm';
const scope=vm.createContext({setTimeout,clearTimeout,AbortController,URL});
vm.runInContext(await fs.readFile('dist/i18n.js','utf8'),scope);
vm.runInContext(await fs.readFile('dist/lookup.js','utf8'),scope);
const ids=process.argv.slice(2);
if(!ids.length||ids.some(id=>!scope.SAFLookup.validId(id)))throw Error('Pass one or more Steam App IDs');
let data, requests=0;
const resolver=new scope.SAFLookup.Resolver({
  load:async()=>data,
  save:async value=>{data=value;},
  fetch:(url,init)=>{requests++;return fetch(url,init);}
});
for(const id of ids){
  const result=await resolver.get(id);
  const before=requests;
  const repeat=await resolver.get(id);
  console.log({id,state:result.state,issue:result.issue,disclosureCharacters:result.disclosure?.length||0,cachedRepeat:requests===before&&repeat.state===result.state});
  if(result.state==='unavailable'||requests!==before)process.exitCode=1;
}
console.log({requests});
