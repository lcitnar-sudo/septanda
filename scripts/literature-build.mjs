import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

export async function buildLiterature(root,version,renderScripts,sdkBlock) {
  const client=path.join(root,'client'),data=JSON.parse(await readFile(path.join(root,'content/literature.json'),'utf8'));
  const registry=JSON.parse(await readFile(path.join(root,'content/authors.json'),'utf8'));
  const authors=new Map(Object.entries({...registry.profiles,...registry.guessProfiles}).map(([id,a])=>[id,{id,name:a.name,aliases:a.aliases,guidance:a.guidance}]));
  for(const a of [...data.extraAuthors,...data.samples.map(s=>({id:s.author,name:s.name,aliases:s.aliases,environment:s.environment,period:s.period,focus:s.focus}))]){
    const prior=authors.get(a.id);
    authors.set(a.id,{...a,aliases:[...new Set([...(prior?.aliases||[]),...a.aliases])],guidance:{environment:a.environment,periods:[...new Set([...(prior?.guidance?.periods||[]),a.period])],focus:a.focus}});
  }
  const publicData={samples:data.samples,authors:[...authors.values()].map(a=>({...a,...(data.authorDetails?.[a.id]?{details:data.authorDetails[a.id]}:{})}))};
  if(data.samples.length!==10 || new Set(data.samples.map(s=>s.id)).size!==10)throw Error('Literary pilot requires ten unique samples');
  for(const s of data.samples){
    if(!Array.isArray(s.about)||s.about.length<2||!s.readingTip||!data.authorDetails?.[s.author]?.bio||!data.authorDetails[s.author].portrait?.src.startsWith('/assets/literature-authors/')||s.text.includes('\ufffd') || s.hints.length!==2 || s.options.length!==4 || !s.options.includes(s.author) || s.options.some(id=>!authors.has(id)) || s.sources.some(x=>!x.url.startsWith('https://')))throw Error('Invalid literary source: '+s.id);
  }
  const code='globalThis.SEPTANDA_LITERATURE='+JSON.stringify(publicData).replaceAll('<','\\u003c')+';';
  const engine=await readFile(path.join(client,'literature-engine.js'),'utf8');
  await writeFile(path.join(root,'literature-game.mjs'),'const root={};\n(function(globalThis){\n'+code+'\n'+engine+'\n})(root);\nexport const data=root.SEPTANDA_LITERATURE,engine=root.SeptandaLiterature;\n');
  const parts=[sdkBlock,{name:'literature-data',code},...await Promise.all(['literature-engine','literature','literature-cloud'].map(async name=>({name,code:await readFile(path.join(client,name+'.js'),'utf8')})))];
  const css=await readFile(path.join(client,'fonts.css'),'utf8')+'\n'+await readFile(path.join(client,'literature.css'),'utf8');
  const icon=Buffer.from(await readFile(path.join(client,'favicon.svg'),'utf8')).toString('base64');
  const html=(await readFile(path.join(client,'literature.html'),'utf8')).replaceAll('__VERSION__',version).replace('href="/favicon.svg"','href="data:image/svg+xml;base64,'+icon+'"').replace('<!-- LITERATURE_STYLES -->',()=>'<style id="literature-styles">\n'+css+'\n</style>').replace('<!-- LITERATURE_SCRIPTS -->',()=>renderScripts(parts));
  await writeFile(path.join(root,'public/literatura.html'),html);
}
