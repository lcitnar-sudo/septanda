/* Run the actual game and cloud modules against a synthetic DOM and transport. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const copy=x=>JSON.parse(JSON.stringify(x)),nodes=new Map(),events=new Map(),storage=new Map();
let fixed=Date.parse('2026-10-21T12:00:00Z');
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
const context=vm.createContext({console,Date:Clock,Intl,Math,JSON,Map,Set,Promise,Error,TypeError,URL,URLSearchParams,AbortController,Blob,Image:class{},
  Event:class{constructor(type){this.type=type;}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
  crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  setInterval(){},setTimeout,clearTimeout,
  document:{documentElement:{classList:{add(){},remove(){},contains(){return false;}}},hidden:false,getElementById:node,querySelectorAll:()=>[],createElement:t=>node(t+Math.random()),createDocumentFragment:()=>node('fragment'+Math.random()),
    addEventListener(k,f){const before=events.get(k);events.set(k,e=>{before?.(e);f(e);});},dispatchEvent(){},body:{append(){}}},
  window:{addEventListener(){}},location:{origin:'https://synthetic.test',pathname:'/vyzva',href:'https://synthetic.test/vyzva?id=proverb-work',search:'?id=proverb-work'},history:{replaceState(){}}});

const privateKeys=new Map([['septanda.v6.daily','real guest results'],['septanda.v6.daily.account.11111111111141118111111111111111','real private results'],['sb-private-auth-token','private auth']]);for(const[k,v]of privateKeys)storage.set(k,v);
const touched=[];context.localStorage={getItem(k){touched.push(k);return storage.get(k)||null;},setItem(k,v){touched.push(k);storage.set(k,v);},removeItem(k){touched.push(k);storage.delete(k);}};context.fetch=()=>{throw Error('Practice must not synchronize');};
const html=await readFile(new URL('../public/vyzva.html',import.meta.url),'utf8'),scripts=[...html.matchAll(/<script id="septanda-([^"]+)">([\s\S]*?)<\/script>/g)];
for(const[,name,code]of scripts)if(!['mascot','mascot-assets'].includes(name))vm.runInContext(code,context,{filename:name});
const Game=context.SeptandaGame,Daily=context.SeptandaDaily,Authors=context.SeptandaAuthors,date='2026-10-21',id='proverb-work';
assert.equal(Game.storageKey(),'septanda.practice.v1.'+id);assert.equal(Game.exportState().days[date].mode,'author-v2');assert.equal(node('guess').hidden,true);assert.equal((node('meaning-options').innerHTML.match(/data-meaning-choice=/g)||[]).length,4);
const option=node('test-meaning-choice');option.dataset.meaningChoice='meaning';events.get('click')({target:option});assert.equal(Game.exportState().days[date].progress[id].status,'won');assert.ok(node('reveal-panel').innerHTML.includes('cvičných bodů'));assert.ok(node('reveal-panel').innerHTML.includes('Bez práce nejsou koláče'));assert.equal(node('daily-recap').hidden,true);
for(const[k,v]of privateKeys)assert.equal(storage.get(k),v);assert.ok(touched.every(k=>k.startsWith('septanda.practice.')),'Practice never reads or writes account/guest/auth storage');
const midnight=context.SeptandaExperience.nextMidnight(new Date('2026-10-24T23:30:00Z'));assert.equal(midnight.toISOString().slice(0,16),'2026-10-25T23:00','Next Prague midnight is correct across autumn DST change');
const state=Game.inspect();state.days['2026-10-19']={ids:[id],progress:{[id]:{status:'won'}}};state.days['2026-10-20']={ids:[id],progress:{[id]:{status:'revealed'}}};assert.ok(context.SeptandaExperience.records(state).length===1,'The journal deduplicates completed IDs');
console.log('PASS modern practice UI: meaning choices, one outcome, no real storage or account access, no network, cvičné scoring, Prague DST midnight and journal deduplication.');
