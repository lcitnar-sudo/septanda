import {readFile,writeFile,mkdir,copyFile,cp,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {build} from 'esbuild';
import {makeCatalog} from './catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root,'client'), destination = path.join(root,'public');
await makeCatalog();
await mkdir(destination,{recursive:true});
const version = JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
const exists = async file => { try {return (await stat(file)).isFile();} catch{return false;} };
let html = await readFile(path.join(source,'index.html'),'utf8');
const scriptNames = [...html.matchAll(/<script defer src="([a-z-]+)\.js(?:\?[^"<]*)?"><\/script>/g)].map(m=>m[1]);
html = html.replace(/\s*<script defer src="[a-z-]+\.js(?:\?[^"<]*)?"><\/script>/g,'');
const css = await readFile(path.join(source,'fonts.css'),'utf8') + '\n' + await readFile(path.join(source,'styles.css'),'utf8');
html = html.replace(/<link rel="stylesheet" href="styles.css[^"<]*">/,()=>'<style id="septanda-styles">\n'+css+'\n</style>');
const icon = await readFile(path.join(source,'favicon.svg'),'utf8');
html = html.replace('href="favicon.svg"','href="data:image/svg+xml;base64,'+Buffer.from(icon).toString('base64')+'"');
html = html.replace('<meta name="theme-color"','<meta name="septanda-build" content="'+version+'">\n  <meta name="theme-color"');
html = html.replace('5.0 · Lokální vydání', version+' · Archiv slov');
const context = vm.createContext({});
const gameParts = [];
for (const name of ['puzzles','authors-data','authors','engine','daily']) {
  const code = await readFile(path.join(source,name+'.js'),'utf8');
  vm.runInContext(code,context); gameParts.push(code);
}
const game = 'const root = {};\n(function(globalThis){\n'+gameParts.join('\n')+'\n})(root);\nexport const puzzles=root.SEPTANDA_PUZZLES, engine=root.SeptandaEngine, daily=root.SeptandaDaily;\n';
await writeFile(path.join(root,'game.mjs'),game);
// The old login endpoint uses precisely the same content and scoring as the new cloud.
await writeFile(path.join(root,'legacy-server/game.mjs'),game);
const escape = value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceList = context.SEPTANDA_PUZZLES.map(p=>'<li><strong>'+escape(p.answer)+'</strong><p>'+escape(p.attribution)+'</p>'+p.sources.map(s=>'<a href="'+escape(s.url)+'" target="_blank" rel="noopener noreferrer">'+escape(s.label)+'</a>').join(' · ')+'</li>').join('\n');
html = html.replace('<p><a class="underlined" href="ZDROJE.md" target="_blank" rel="noopener">Úplný přehled pramenů</a></p>','<details class="chain-details"><summary>Úplný přehled pramenů (obsahuje řešení)</summary><ol class="rules-list">'+sourceList+'</ol></details>');
const sdk = await build({stdin:{contents:'export {createClient} from "@supabase/supabase-js";',resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',globalName:'SeptandaSupabase',platform:'browser',target:['es2022'],minify:true,legalComments:'inline'});
const blocks = [{name:'supabase-sdk',code:sdk.outputFiles[0].text}];
for (const name of scriptNames.filter(name=>name!=='supabase-vendor')) {
  let code=await readFile(path.join(source,name+'.js'),'utf8');
  if (name==='mascot-assets') {
    const assetsContext=vm.createContext({});vm.runInContext(code,assetsContext);
    const embedded={};
    for(const [state,asset] of Object.entries(assetsContext.SEPTANDA_MASCOT_ASSETS || {})) {
      const file=path.resolve(source,typeof asset==='string'?asset:asset.src);
      if(!file.startsWith(source+path.sep))throw new Error('Mascot asset outside client');
      const mime=path.extname(file)==='.webp'?'image/webp':'image/png';
      embedded[state]='data:'+mime+';base64,'+(await readFile(file)).toString('base64');
    }
    code='globalThis.SEPTANDA_MASCOT_ASSETS='+JSON.stringify(embedded)+';';
  }
  blocks.push({name,code});
}
const hashes=[];
const inline = blocks.map(({name,code})=>{
  if (/<\/script/i.test(code)) throw new Error('Unsafe script terminator: '+name);
  const block='\n'+code.trimEnd()+'\n';
  hashes.push("'sha256-"+createHash('sha256').update(block).digest('base64')+"'");
  return '<script id="septanda-'+name+'">'+block+'</script>';
}).join('\n');
html=html.replace('</body>',()=>inline+'\n</body>');
await writeFile(path.join(destination,'index.html'),html);
await writeFile(path.join(destination,'_headers'),`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; script-src ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
  Cache-Control: public, max-age=0, must-revalidate
`);
for(const file of ['ZDROJE.md','FONTY-LICENCE.txt','SOUKROMI.md']) if(await exists(path.join(source,file))) await copyFile(path.join(source,file),path.join(destination,file));
const privacy = await readFile(path.join(source,'SOUKROMI.md'),'utf8');
const privacyInline = text => escape(text).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,'<a href="$2">$1</a>');
const privacyBody = privacy.trim().split(/\n\n+/).map(block=>{
  const heading=block.match(/^(#{1,2}) (.*)$/);
  return heading ? `<h${heading[1].length}>${privacyInline(heading[2])}</h${heading[1].length}>` : `<p>${privacyInline(block)}</p>`;
}).join('\n');
await writeFile(path.join(destination,'soukromi.html'),`<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Soukromí · Šeptanda</title><style>body{margin:0;background:#e8e6dc;color:#252b26;font:17px/1.7 system-ui,sans-serif}main{max-width:760px;margin:auto;padding:36px 24px 80px}h1{font-size:clamp(28px,5vw,40px);line-height:1.15;margin:40px 0 24px}h2{font-size:23px;line-height:1.3;margin:38px 0 14px}a{color:#963c2c;text-underline-offset:3px}p{margin:0 0 18px}header{border-bottom:2px solid #252b26;padding-bottom:20px}</style></head><body><main><header><a href="./">← Zpět do Šeptandy</a></header>${privacyBody}</main></body></html>`);
try{await cp(path.join(source,'assets'),path.join(destination,'assets'),{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
console.log(JSON.stringify({version,puzzles:context.SEPTANDA_PUZZLES.length,htmlBytes:Buffer.byteLength(html),scripts:blocks.map(x=>x.name)}));
