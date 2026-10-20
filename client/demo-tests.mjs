/* Run the actual game and cloud modules against a synthetic DOM and transport. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const copy=x=>JSON.parse(JSON.stringify(x)),nodes=new Map(),events=new Map(),storage=new Map();
let fixed=Date.parse('2026-10-20T12:00:00Z');
class Clock extends Date{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}}
function node(id){
  if(nodes.has(id))return nodes.get(id);
  const listeners=new Map(),attrs=new Map();
  const n={id,value:'',textContent:'',innerHTML:'',hidden:false,open:false,disabled:false,dataset:{},children:[],
    classList:{toggle(){},add(){},remove(){}},
    setAttribute(k,v){attrs.set(k,v);},hasAttribute(k){return attrs.has(k);},closest(s){return s==='button'?n:null;},
    querySelector(s){return node(id+':'+s);},append(...a){this.children.push(...a);},replaceChildren(...a){this.children=a;this.innerHTML='';},
    addEventListener(k,f){listeners.set(k,f);},fire(k,e={}){return listeners.get(k)?.({preventDefault(){},...e});},
    focus(){},scrollIntoView(){},showModal(){this.open=true;},close(){this.open=false;},remove(){},click(){},
    reset(){},reportValidity(){return true;}};
  nodes.set(id,n);return n;
}
const context=vm.createContext({console,Date:Clock,Intl,Math,JSON,Map,Set,Promise,Error,TypeError,URL,URLSearchParams,AbortController,Blob,
  Event:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
  crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  setInterval(){},setTimeout,clearTimeout,
  document:{hidden:false,getElementById:node,querySelectorAll:()=>[],createElement:t=>node(t+Math.random()),createDocumentFragment:()=>node('fragment'+Math.random()),
    addEventListener(k,f){events.set(k,f);},dispatchEvent(){},body:{append(){}}},
  window:{addEventListener(){}},location:{origin:'https://synthetic.test',pathname:'/',href:'https://synthetic.test/'},history:{replaceState(){}}});

const protectedData=new Map([
 ['septanda.v6.daily','existing guest history'],
 ['septanda.v6.daily.account.11111111111141118111111111111111','private account results, 900 points'],
 ['septanda.v5.progress','legacy history'],
 ['septanda.account-imported','existing migration marker'],
 ['sb-existing-auth-token','existing persistent login']
]);
for(const [key,value] of protectedData)storage.set(key,value);
const touched=[];
context.localStorage={getItem(key){touched.push(['read',key]);return storage.get(key)||null;},setItem(key,value){touched.push(['write',key]);assert.equal(key,'septanda.demo.authors.v1','Only sample storage may be written');storage.set(key,value);}};
context.fetch=()=>{throw new Error('The sample must never send a network request');};
const html=await readFile(new URL('../public/ukazka.html',import.meta.url),'utf8');
const headers=await readFile(new URL('../public/_headers',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script id="septanda-([^"]+)">([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length,10,'The sample has only local game modules');
assert.ok(!scripts.some(([,name])=>['supabase-sdk','cloud','community','leaderboard'].includes(name)));
assert.ok(html.includes('Cvičné body i výsledky'));
assert.ok(html.includes('href="./">Zpět do mé hry'));
assert.ok((await readFile(new URL('../public/index.html',import.meta.url),'utf8')).includes('data-open="classic-history-dialog"'));
for(const [,name,code] of scripts){
 assert.ok(headers.includes("'sha256-"+createHash('sha256').update(code).digest('base64')+"'"),'Authorized script '+name);
 if(name==='mascot-assets'||name==='mascot')continue;
 vm.runInContext(code,context,{filename:name});
}
const game=context.SeptandaGame,daily=context.SeptandaDaily,date='2026-10-20';
assert.equal(game.storageKey(),'septanda.demo.authors.v1');assert.equal(game.hasAccount(),false);
let state=game.exportState();
assert.equal(state.days[date].mode,'author-v1');
assert.deepEqual(copy(state.days[date].ids),['descartes','poem-may','proverb-work']);
assert.equal(daily.totals(state).points,100);
node('guess').value='descartes';node('guess-form').fire('submit');
assert.equal(daily.totals(game.exportState()).points,300);
assert.ok(node('reveal-panel').innerHTML.includes('René Descartes'));
assert.ok(node('reveal-panel').innerHTML.includes('Co slova znamenají'));
const hint=node('hint-clue');hint.dataset.hint='clue';
const next=node('next-demo');next.setAttribute('data-next','');events.get('click')({target:next});
for(let level=1;level<=3;level++)events.get('click')({target:hint});
assert.equal(daily.totals(game.exportState()).points,250);
assert.equal((node('hint-options').innerHTML.match(/data-author-choice=/g)||[]).length,4);
const saved=storage.get('septanda.demo.authors.v1');
vm.runInContext(scripts.find(([,name])=>name==='demo')[2],context);
vm.runInContext(scripts.find(([,name])=>name==='app')[2],context);
assert.equal(storage.get('septanda.demo.authors.v1'),saved,'Reload preserves the sample win and paid hints');
fixed=Date.parse('2026-11-01T12:00:00Z');
assert.equal(daily.dayKey(),date,'An evergreen example never consumes another personal day');
for(const [key,value] of protectedData)assert.equal(storage.get(key),value,'Real data unchanged: '+key);
assert.ok(touched.every(([,key])=>['septanda.demo.authors.v1','septanda.demo.legacy.v1'].includes(key)),'No real history or authentication storage is even read');
console.log('PASS public sample: immediate author game, three fixed examples, scoring/hints/reload, CSP, no cloud modules/network, real account and guest data untouched.');
