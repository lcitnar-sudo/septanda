import {readFile,writeFile,mkdir,copyFile,cp,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {build} from 'esbuild';
import {makeCatalog} from './catalog.mjs';
import {buildLiterature} from './literature-build.mjs';

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
html = html.replace('<p><a class="underlined" href="ZDROJE.md" target="_blank" rel="noopener">Úplný přehled pramenů</a></p>','<p><a class="underlined" href="prameny.html" target="_blank" rel="noopener">Úplný přehled pramenů (obsahuje řešení) →</a></p>');
await writeFile(path.join(destination,'prameny.html'),'<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Prameny Šeptandy</title><style>body{max-width:800px;margin:40px auto;padding:20px;font:17px/1.6 system-ui;background:#e8e6dc;color:#252b26}li{margin-bottom:24px}a{color:#963c2c}</style><a href="./">← Zpět do hry</a><h1>Prameny a původ výroků</h1><p>Tento přehled obsahuje řešení. Příběhy odhalených výroků najdeš ve svém Deníku objevů.</p><ol>'+sourceList+'</ol></html>');
const sdk = await build({stdin:{contents:'export {createClient} from "@supabase/supabase-js";',resolveDir:root,loader:'js'},bundle:true,write:false,format:'iife',globalName:'SeptandaSupabase',platform:'browser',target:['es2022'],minify:true,legalComments:'inline'});
const blocks = [{name:'supabase-sdk',code:sdk.outputFiles[0].text}];
for (const name of scriptNames.filter(name=>name!=='supabase-vendor')) {
  let code=await readFile(path.join(source,name+'.js'),'utf8');
  if(name==='puzzles'){
    const imageContext=vm.createContext({});vm.runInContext(code,imageContext);
    const images=imageContext.SEPTANDA_IMAGES||{};
    await mkdir(path.join(destination,'assets/portraits'),{recursive:true});
    for(const [key,item]of Object.entries(images)){
      if(!item.data?.startsWith('data:'))continue;const match=item.data.match(/^data:(image\/[a-z]+);base64,(.*)$/s);if(!match)continue;
      const bytes=Buffer.from(match[2],'base64'),filename=createHash('sha256').update(bytes).digest('hex').slice(0,20)+'.'+(match[1]==='image/jpeg'?'jpg':match[1].split('/')[1]);
      await writeFile(path.join(destination,'assets/portraits',filename),bytes);code=code.replaceAll(item.data,'assets/portraits/'+filename);
    }
  }
  blocks.push({name,code});
}
const hashes=new Set();
const renderScripts = parts => parts.map(({name,code})=>{
  if (/<\/script/i.test(code)) throw new Error('Unsafe script terminator: '+name);
  const block='\n'+code.trimEnd()+'\n';
  hashes.add("'sha256-"+createHash('sha256').update(block).digest('base64')+"'");
  return '<script id="septanda-'+name+'">'+block+'</script>';
}).join('\n');
const pageTemplate=html;
html=html.replace('</body>',()=>renderScripts(blocks)+'\n</body>');
await writeFile(path.join(destination,'index.html'),html);
// Reuse the actual game UI, but omit all account, network and form modules.
const demoParts=blocks.filter(({name})=>!['supabase-sdk','cloud','leaderboard','community'].includes(name)).map(part=>part.name==='app'?{...part,code:part.code.replace("'septanda.v6.daily'","'septanda.demo.authors.v1'").replace("'septanda.v5.progress'","'septanda.demo.legacy.v1'")}:part);
demoParts.splice(demoParts.findIndex(p=>p.name==='app'),0,{name:'demo',code:await readFile(path.join(source,'demo.js'),'utf8')});
const demoCSS=`.header-account,.leaderboard-section,.edition-slip,[data-open="contact-dialog"],[data-open="stats-dialog"]{display:none!important}.demo-banner{margin:0 0 30px;padding:20px;border-left:3px solid var(--oxide);background:var(--paper)}.demo-banner p{margin:8px 0 12px}.demo-banner a{display:inline-block}.demo-label{font-family:var(--mono);font-size:11px;letter-spacing:.08em}.demo-banner strong{font-size:21px}.demo-return{margin-left:auto}`;
const banner='<section class="demo-banner" aria-label="Cvičná hra"><span class="demo-label">UKÁZKA NOVÉ ŠEPTANDY</span><p><strong>Tři výroky na zkoušku. Hledej autora.</strong></p><p>Začni psát jméno nebo „lidové rčení“. Za 50 cvičných bodů postupně získáš stopy a čtyři možnosti. Cvičné body i výsledky zůstávají jen v této ukázce; tvůj účet a denní postup se nemění.</p><a class="underlined" href="./">Zpět do mé hry →</a></section>';
let demo=pageTemplate.replace('<main>','<main>'+banner).replace('</head>','<meta name="robots" content="noindex,follow"><style>'+demoCSS+'</style></head>');
demo=demo.replace(/<title>[^<]*<\/title>/,'<title>Vyzkoušej hádání autorů · Šeptanda</title>').replace('</nav>','<a class="text-button demo-return" href="./">Zpět do mé hry →</a></nav>');
demo=demo.replace('</body>',()=>renderScripts(demoParts)+'\n</body>');
await writeFile(path.join(destination,'ukazka.html'),demo);
const practiceParts=blocks.filter(({name})=>!['supabase-sdk','cloud','leaderboard','community'].includes(name)).map(part=>part.name==='app'?{...part,code:part.code.replace("'septanda.v6.daily'",'globalThis.SEPTANDA_PRACTICE.key').replace("'septanda.v5.progress'","'septanda.practice.legacy.unused'").replaceAll('Připsáno 200 bodů.','Připsáno 200 cvičných bodů.').replaceAll('+200 bodů připsáno','+200 cvičných bodů').replaceAll('Dnešní sada je hotová. Tvoje výsledky zůstávají uložené.','Cvičný výrok je hotový. Denní postup a body se nezměnily.').replaceAll('Prohlédnout dnešní sadu','Prohlédnout cvičný výrok')}:part);
practiceParts.splice(practiceParts.findIndex(p=>p.name==='app'),0,{name:'practice',code:await readFile(path.join(source,'practice.js'),'utf8')});
for(const [route,label]of [['vyzva','Výzva pro kamaráda'],['procvicit','Dobrovolné procvičení']]){
 const banner='<section class="practice-banner"><p class="eyebrow">'+label.toUpperCase()+'</p><h2>Jeden výrok na zkoušku.</h2><p>Tato hra je samostatná. Nemění tvé body, historii ani osobní denní trojici.</p><a class="underlined" href="./">Zpět do mé hry →</a> <button type="button" class="text-button underlined" id="practice-reset">Zkusit znovu</button></section>';
 let page=pageTemplate.replace('<main>','<main>'+banner).replace('</head>','<meta name="robots" content="noindex,follow"></head>').replace(/<title>[^<]*<\/title>/,'<title>'+label+' · Šeptanda</title>');
 page=page.replace('</body>',()=>renderScripts(practiceParts)+'\n</body>');await writeFile(path.join(destination,route+'.html'),page);
}

await buildLiterature(root,version,renderScripts);
await writeFile(path.join(destination,'_headers'),`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; script-src ${[...hashes].join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
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
