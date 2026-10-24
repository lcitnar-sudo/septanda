import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHandler} from './legacy-server/service.mjs';
import {fileStore} from './legacy-server/file-store.mjs';
import {createCloudAPI} from './backend/api.mjs';
import * as game from './game.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.argv[2] || path.join(here,'public'));
const port=Number(process.argv[3] || 8785);
const data=path.resolve(process.argv[4] || path.join(here,'.local-data'));
const legacy=createHandler(fileStore(data),{local:true}),cloud=createCloudAPI({game});
const types={'.html':'text/html; charset=utf-8','.md':'text/plain; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.txt':'text/plain; charset=utf-8'};
createServer(async(req,res)=>{
  try {
    const headerText=await readFile(path.join(root,'_headers'),'utf8');
const headers=Object.fromEntries(headerText.split('\n').filter(l=>l.startsWith('  ') && l.includes(': ')).map(l=>l.trim().split(/: (.*)/s).slice(0,2)));
    const url=new URL(req.url,`http://127.0.0.1:${port}`);
    if(url.pathname.startsWith('/.netlify/functions/')) {
      const name=url.pathname.split('/').at(-1);
      if(!['leaderboard','runtime-config','player','cloud-leaderboard','admin-users'].includes(name)){res.writeHead(404);res.end();return;}
      const buffers=[];let size=0;for await(const part of req){size+=part.length;if(size>2*1024*1024){res.writeHead(413);res.end();return;}buffers.push(part);}
      const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(buffers)}:{})});
      const reply=name==='leaderboard'?await legacy(request):await cloud(request,name);
      res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));return;
    }
    // Netlify detects and receives this form only on the deployed site.
    if(req.method==='POST' && url.pathname==='/') {res.writeHead(501,{'Content-Type':'text/plain; charset=utf-8'});res.end('Kontaktní formulář přijímá zprávy až na Netlify.');return;}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const relative=decodeURIComponent(url.pathname)==='/'?'index.html':['/vyzva','/procvicit','/ukazka','/literatura'].includes(url.pathname)?url.pathname.slice(1)+'.html':decodeURIComponent(url.pathname).slice(1);
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    if(!(await stat(file)).isFile())throw new Error('missing');
    res.writeHead(200,{...headers,'Content-Type':types[path.extname(file)] || 'application/octet-stream'});res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Nenalezeno');}
}).listen(port,'127.0.0.1',()=>console.log(`Šeptanda: http://127.0.0.1:${port}/`));
