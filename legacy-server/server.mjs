import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHandler} from './service.mjs';
import {fileStore} from './file-store.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.argv[2] || path.join(here,'public'));
const port=Number(process.argv[3] || 8785);
const data=path.resolve(process.argv[4] || path.join(here,'.local-data'));
const api=createHandler(fileStore(data),{local:true});
const headerText=await readFile(path.join(root,'_headers'),'utf8');
const headers=Object.fromEntries(headerText.split('\n').filter(l=>l.startsWith('  ') && l.includes(': ')).map(l=>l.trim().split(/: (.*)/s).slice(0,2)));
createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://127.0.0.1:${port}`);
    if(url.pathname==='/.netlify/functions/leaderboard') {
      const buffers=[];let size=0;for await(const part of req){size+=part.length;if(size>8192){res.writeHead(413);res.end();return;}buffers.push(part);}
      const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(buffers)}:{})});
      const reply=await api(request);res.writeHead(reply.status,Object.fromEntries(reply.headers));res.end(Buffer.from(await reply.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const relative=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    if(!(await stat(file)).isFile())throw new Error('missing');
    const type=path.extname(file)==='.html'?'text/html; charset=utf-8':path.extname(file)==='.md'?'text/plain; charset=utf-8':'application/octet-stream';
    res.writeHead(200,{...headers,'Content-Type':type});res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Nenalezeno');}
}).listen(port,'127.0.0.1',()=>console.log(`Šeptanda: http://127.0.0.1:${port}/`));
