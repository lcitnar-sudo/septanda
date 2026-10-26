import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as game from '../emoji-game.mjs';
const E=game.engine,items=game.data.items;
assert.equal(items.length,10);
const segmenter=new Intl.Segmenter('cs',{granularity:'grapheme'});
for(const p of items){
  assert.equal(p.emoji.length,3);assert(p.emoji.every(e=>[...segmenter.segment(e)].length===1),'exactly three visible emoji, including joined characters');
  for(const alias of [p.title,...p.aliases])assert.equal(E.identify(alias,items)[0]?.id,p.id,alias);
  const s=E.fresh(p.id);E.open(s,p.id,'2026-10-26');assert.equal(E.answer(s,p,p.author,items,'2026-10-26').kind,'try-again','asks for book, not author');
  assert.equal(E.answer(s,p,p.title.toUpperCase()+'!',items,'2026-10-26').kind,'correct');
  E.reveal(s,p.id,'2026-10-26');E.hint(s,p.id,'2026-10-26');assert.equal(s.rounds[p.id].status,'solved');assert.equal(s.rounds[p.id].hints,0,'terminal results immutable');
}
assert.equal(E.identify('Frankenstien',items)[0]?.id,'E09');assert.equal(E.identify('Moby-Dick',items)[0]?.id,'E08');
assert.equal(E.identify('Malý princ nebo Dracula',items).length,0);assert.equal(E.identify('ne Dracula',items).length,0);assert.equal(E.identify('',items).length,0);
const state=E.fresh('daily'),ids=[];
for(let n=1;n<=10;n++){const date='2026-11-'+String(n).padStart(2,'0');const id=E.assign(state,date,items);ids.push(id);assert.equal(E.assign(state,date,[...items].reverse()),id);}
assert.equal(new Set(ids).size,10);assert.equal(E.assign(state,'2026-11-11',items),null,'never repeat on exhaustion');
assert.equal(new Set(Array.from({length:40},(_,i)=>E.assign(E.fresh('player-'+i),'2026-10-26',items))).size>6,true);
assert.equal(E.day(new Date('2026-10-25T22:30Z')),'2026-10-25');assert.equal(E.day(new Date('2026-10-25T23:30Z')),'2026-10-26');
assert.deepEqual(E.parse(JSON.stringify(state)),state);assert.throws(()=>E.parse('{"version":2}'));
const page=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),headers=await readFile(new URL('../public/_headers',import.meta.url),'utf8');
assert(page.includes('id="mode-emoji"')&&page.includes('id="emoji-form"'));assert(page.includes('Bonus hraješ pro radost'));
for(const [,code] of page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))assert(headers.includes('sha256-'+createHash('sha256').update(code).digest('base64')));
console.log('Emoji engine: ten reviewed three-symbol puzzles, aliases/typos, personal daily selection, no repeats, terminal preservation and published CSP passed.');
