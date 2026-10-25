import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import * as game from '../literature-game.mjs';
const mem=new Map(),elements=new Map(),events=new Map();
function el(id){if(!elements.has(id))elements.set(id,{id,value:'',hidden:false,attributes:{},listeners:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},focus(){},querySelector(){return {focus(){}};},close(){}});return elements.get(id);}
const localStorage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v)};
const document={getElementById:el,activeElement:null,addEventListener(k,fn){events.set(k,fn);},querySelector(){return null;},querySelectorAll(){return [];}};
class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-10-24T10:00:00Z']));}}
const context=vm.createContext({document,localStorage,Date:Clock,Intl,crypto:globalThis.crypto,navigator:{},console,Map,Set,Promise,setInterval(){},setTimeout(){return 1;},clearTimeout(){},addEventListener(){},SEPTANDA_LITERATURE:game.data,SeptandaLiterature:{...game.engine,day:(now=new Clock())=>game.engine.day(now)}});
vm.runInContext(await readFile(new URL('./literature.js',import.meta.url),'utf8'),context);
const G=context.SeptandaLiteraryGame,E=game.engine,clone=x=>JSON.parse(JSON.stringify(x));
const a=E.fresh('a'),b=E.fresh('b');a.days['2026-10-24']='L01';b.days['2026-10-24']='L02';E.open(a,'L01','2026-10-24');E.open(b,'L02','2026-10-24');
await G.setIdentity(null);const guestBefore=mem.get(E.KEY);
context.SeptandaLiteratureCloud={signedIn:()=>true,async command(){throw Error('offline');}};
await G.setIdentity('A',a);el('author').value='Rozpracovaný soukromý tip';el('author').listeners.input();await new Promise(r=>setImmediate(r));
assert.equal(JSON.parse(mem.get(E.KEY+'.account.A')).pendingDrafts.L01,'Rozpracovaný soukromý tip');
await assert.rejects(G.flushDrafts(),/offline/);
G.pause(true);assert.equal(el('round').hidden,true);assert.equal(el('reading-companion').hidden,true);assert.equal(el('author').value,'');assert.equal(el('book-list').innerHTML,'');
await G.setIdentity('B',b);assert.equal(el('round').hidden,true,'account remains covered until authenticated load completes');G.pause(false);assert.equal(el('author').value,'');assert(!JSON.stringify(G.exportState()).includes('soukromý'));
await G.setIdentity('A',a);assert.equal(el('author').value,'Rozpracovaný soukromý tip','unsent draft survives a restored remote snapshot');
context.SeptandaLiteratureCloud.command=async(action,body)=>{assert.equal(action,'draft');a.rounds[body.id].draft=body.text;return {state:clone(a)};};
await G.flushDrafts();assert.deepEqual(Object.keys(JSON.parse(mem.get(E.KEY+'.account.A')).pendingDrafts),[]);
assert.equal(a.rounds.L01.draft,'Rozpracovaný soukromý tip');assert.equal(mem.get(E.KEY),guestBefore,'account progress never changes guest history');
// A terminal result on another device takes precedence over a stale pending draft.
el('author').value='stale';el('author').listeners.input();await new Promise(r=>setImmediate(r));a.rounds.L01.status='revealed';await G.setIdentity('A',a);assert.deepEqual(Object.keys(G.exportState().pendingDrafts),[]);assert.equal(G.exportState().rounds.L01.status,'revealed');
context.SeptandaLiteratureCloud.signedIn=()=>false;await G.setIdentity(null);assert.equal(mem.get(E.KEY),guestBefore);
// The enriched story is only rendered for a finished synthetic round and keeps its award.
await G.setIdentity('B',b);assert.equal(el('story').hidden,true);
const finished=clone(b);finished.rounds.L02.status='solved';finished.rounds.L02.hints=1;
await G.apply(finished);assert.equal(el('story').hidden,false);assert(el('story').innerHTML.includes('/assets/literature-authors/nemcova.jpg'));assert(el('story').innerHTML.includes('O knize'));assert.equal(E.award(G.exportState().rounds.L02),150);
console.log('Literary storage: guest/account isolation, separate accounts, offline pending draft recovery, acknowledgement and terminal cross-device result preservation passed.');
