/* Run the actual game and cloud modules against a synthetic DOM and transport. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const copy=x=>JSON.parse(JSON.stringify(x)),nodes=new Map(),events=new Map(),storage=new Map();
const fixed=Date.parse('2026-10-20T12:00:00Z');
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
for(const file of ['puzzles.js','engine.js','daily.js','guidance.js','app.js'])vm.runInContext(await readFile(new URL(file,import.meta.url),'utf8'),context);
const game=context.SeptandaGame,daily=context.SeptandaDaily,date='2026-10-20';
const puzzle=id=>context.SEPTANDA_PUZZLES.find(p=>p.id===id);
let state=game.exportState(),id=state.days[date].ids[0],p=puzzle(id);
assert.equal(state.assignmentVersion,1);
assert.equal(game.hasAccount(),false);
assert.equal(node('balance-control').hidden,true,'Guest wallet stays hidden');
node('guess').value=p.answer.split(/\s+/).slice(0,2).join(' ');
node('guess-form').fire('submit');
assert.match(node('result-panel').innerHTML,/STOPA Z TVÉHO TIPU/);
assert.ok(!/%/.test(node('result-panel').innerHTML),'Unsuccessful guidance has no numeric percentages');
const hint=node('hint-clue');hint.dataset.hint='clue';
for(let n=1;n<=3;n++){
  events.get('click')({target:hint});
  state=game.exportState();
  assert.equal(state.days[date].progress[id].hintLevel,n);
  assert.equal(daily.totals(state).spent,50,'Additional clue levels are free');
  assert.match(node('hint-clue-content').innerHTML,new RegExp('Stopa '+n));
}
assert.equal(hint.disabled,true,'A fourth hint cannot charge again');
node('guess').value=p.answer;node('guess-form').fire('submit');
state=game.exportState();
assert.equal(state.days[date].progress[id].status,'won');
assert.equal(daily.totals(state).points,250,'A real accepted answer earns the existing reward');
assert.equal(node('guess-form').hidden,true);
assert.match(node('result-panel').innerHTML,/Rozluštěno/);
assert.match(node('reveal-panel').innerHTML,/\+200 bodů připsáno/);
const accountID='11111111-1111-4111-8111-111111111111';
game.setAccount(accountID,{importGuest:false});
assert.equal(daily.totals(game.exportState()).solved,0,'Guest progress is not silently claimed by another account');
game.backupPending(state);const second=copy(state);second.days[date].progress[id].draft='jiný tip';game.backupPending(second);
assert.equal(game.pendingBackup().snapshots.length,2,'Different conflict snapshots are both preserved');
game.setAccount('22222222-2222-4222-8222-222222222222',{importGuest:false});
assert.equal(game.pendingBackup(),null,'Private conflict backup does not cross accounts');
// Real cloud client + real game: cold account restoration, past win and today's server reservation.
const remote=daily.createState(null);daily.bindPlayer(remote,accountID);
const prior=daily.ensureDay(remote,'2026-10-19'),priorID=prior.ids[0];
prior.progress[priorID]={...daily.blankRound(),attempts:[{text:puzzle(priorID).answer,id:'previous-win',time:fixed-86400000}],status:'won'};
daily.ensureDay(remote,date);
const server={account:{id:accountID,name:'Tester',email:'test@example.test',emailConfirmed:true},state:copy(remote),consent:{granted:false},admin:false};
const session={access_token:'synthetic',user:{id:accountID}};
context.SeptandaSupabase={createClient(){return{auth:{onAuthStateChange(){},async getSession(){return{data:{session}};}}};}};
context.fetch=async(url,opts={})=>{
  if(url.includes('cloud-leaderboard'))return{ok:true,json:async()=>({date,entries:[],total:0})};
  if(opts.body){const body=JSON.parse(opts.body);assert.equal(body.importLegacy,undefined);server.state=copy(body.state);}
  return{ok:true,json:async()=>copy(server)};
};
node('player-dialog').showModal();
vm.runInContext(await readFile(new URL('cloud.js',import.meta.url),'utf8'),context);
await context.SeptandaCloud.start({consent:{version:'v1',text:'Synthetic'},supabase:{url:'https://synthetic.supabase.test',publishableKey:'synthetic'}});
state=game.exportState();
assert.equal(state.days['2026-10-19'].progress[priorID].status,'won','Actual cloud client restores older account wins');
assert.equal(daily.totals(state).points,300);
assert.deepEqual(copy(state.days[date].ids),copy(remote.days[date].ids));
assert.equal(node('player-dialog').open,false,'Restored login closes and returns to playing');
assert.equal(node('profile-dialog').open,false,'Account settings do not interrupt the game');
console.log('PASS actual game UI: word guidance, three clues / one charge, reward, guest isolation, private backups and cold cloud account restoration.');
