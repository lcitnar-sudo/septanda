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
assert.equal(state.days[date].ids.length,3);
assert.equal(node('balance-control').hidden,true,'Guest wallet stays hidden');
assert.equal(node('give-up').disabled,true,'The initial wallet cannot afford a skip');
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
const next=node('next-test');next.setAttribute('data-next','');events.get('click')({target:next});
const skippedID=game.exportState().days[date].selected;
node('give-up').fire('click');
assert.equal(node('confirm-dialog').open,true,'Spending points requires a clear game confirmation');
assert.equal(daily.totals(game.exportState()).points,250,'Opening the confirmation spends nothing');
node('confirm-dialog').close();node('confirm-dialog').fire('close');
assert.equal(daily.totals(game.exportState()).points,250,'Cancelling spends nothing');
node('give-up').fire('click');await node('confirm-action').fire('click');
let skippedState=game.exportState();
assert.equal(skippedState.days[date].progress[skippedID].paidSkip,true);
assert.equal(daily.totals(skippedState).points,50,'A confirmed skip costs 200 without a reward');
assert.equal(skippedState.days[date].selected,skippedState.days[date].ids[2],'Skip immediately advances within the triple');
assert.equal(node('give-up').disabled,true,'Cannot overspend the remaining balance');
await node('confirm-action').fire('click');assert.equal(daily.totals(game.exportState()).points,50,'Repeated confirmation never charges twice');
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
  if(opts.body){const body=JSON.parse(opts.body);assert.equal(body.importLegacy,undefined);if(body.action==='sync')server.state=copy(body.state);else if(body.action==='skip'){const r=server.state.days[body.date].progress[body.id]||daily.blankRound();server.state.days[body.date].progress[body.id]={...r,status:'revealed',paidSkip:true,draft:''};}}
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
const accountSkipID=state.days[date].selected;
node('give-up').fire('click');await node('confirm-action').fire('click');
state=game.exportState();
assert.equal(state.days[date].progress[accountSkipID].paidSkip,true,'Cloud skip adopts the acknowledged server result');
assert.equal(daily.totals(state).points,100,'Cloud skip spends the saved account balance once');
const originalFive=daily.plan(date),withFive=daily.createState(null);daily.bindPlayer(withFive,accountID);
withFive.days[date]={ids:originalFive,selected:originalFive[4],seen:[originalFive[4]],skipped:[],progress:{
 [originalFive[3]]:{...daily.blankRound(),status:'won',attempts:[{id:'archived-fourth-win',text:puzzle(originalFive[3]).answer,time:fixed}]},
 [originalFive[4]]:{...daily.blankRound(),draft:'Můj původní pátý tip'}}};
game.replaceState(withFive);const capped=game.exportState();
assert.match(node('edition-count').textContent,/03 VÝROKY/,'A previously issued five now visibly says three');
assert.match(node('daily-position').textContent,/Z 3$/);
assert.equal((node('collection-list').innerHTML.match(/class="collection-item"/g)||[]).length,3,'The actual collection UI offers three buttons');
assert.equal(capped.days[date].ids.length,5,'Stored issued IDs remain complete');
assert.equal(daily.totals(capped).points,300,'The earlier fourth-slot win remains awarded');
assert.equal(capped.days[date].progress[originalFive[4]].draft,'Můj původní pátý tip');
assert.match(node('stats-content').innerHTML,/Dřívější výsledky z dneška/,'Existing extra work is accessible in the archive');
console.log('PASS actual game UI: word guidance, three clues / one charge, reward, guest isolation, private backups and cold cloud account restoration.');
