import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
export async function buildEmoji(root){
  const data=JSON.parse(await readFile(path.join(root,'content/emoji.json'),'utf8'));
  if(data.items.length<10||new Set(data.items.map(p=>p.id)).size!==data.items.length)throw Error('Emoji bonus needs ten unique reviewed puzzles.');
  const titles=new Set();
  for(const p of data.items){
    if(!/^E\d{2,5}$/.test(p.id)||p.emoji.length!==3||p.labels.length!==3||p.hints.length!==2||!p.author||!p.about||!p.explanation||!p.aliases.length||!p.source.startsWith('https://'))throw Error('Invalid emoji puzzle: '+p.id);
    const title=p.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(titles.has(title))throw Error('Duplicate emoji book: '+p.id);titles.add(title);
  }
  const code='globalThis.SEPTANDA_EMOJI='+JSON.stringify(data).replaceAll('<','\\u003c')+';';
  const engine=await readFile(path.join(root,'client/emoji-engine.js'),'utf8');
  await writeFile(path.join(root,'emoji-game.mjs'),'const root={};\n(function(globalThis){\n'+code+'\n'+engine+'\n})(root);\nexport const data=root.SEPTANDA_EMOJI,engine=root.SeptandaEmojiEngine;\n');
  return [{name:'emoji-data',code},{name:'emoji-engine',code:engine},{name:'emoji',code:await readFile(path.join(root,'client/emoji.js'),'utf8')}];
}
