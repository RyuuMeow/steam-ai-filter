import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    let name=url.pathname;
    if(url.searchParams.has('coverage')) name='/tests/storewide.html';
    if(name==='/') name=url.searchParams.has('lookup')?'/tests/lookup.html':'/tests/home.html';
    if(name==='/search/') name='/tests/fixture.html';
    if(name.startsWith('/app/')) name='/tests/detail.html';
    if(name==='/preview-popup.html'){
      let html=await readFile(path.join(root,'dist/popup.html'),'utf8');
      html=html.replace('<head>','<head><base href="/dist/"><script src="/tests/bridge.js"></script>');
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(html);
    }
    const file=path.resolve(root,'.'+decodeURIComponent(name));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:4173/search/'));
