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
for(const file of ['puzzles.js','authors-data.js','authors.js','engine.js','daily.js','guidance.js','app.js'])vm.runInContext(await readFile(new URL(file,import.meta.url),'utf8'),context);
const game=context.SeptandaGame,daily=context.SeptandaDaily,authors=context.SeptandaAuthors,date='2026-10-20';
const byId=id=>context.SEPTANDA_PUZZLES.find(p=>p.id===id);
let state=game.exportState(),id=state.days[date].selected,p=byId(id),profile=authors.profile(p);
assert.equal(state.days[date].mode,'author-v1');
assert.equal(node('distorted-message').textContent,p.answer,'The exact quotation is visible');
assert.equal(node('puzzle-category').textContent,'PÁTRÁNÍ PO PŮVODU','Category does not reveal anonymous origin');
assert.equal(node('intro-title').innerHTML,'Šeptá se to po staletí.<br><em>Víš, kdo to řekl a proč?</em>');
assert.equal(node('guess').placeholder,'Jméno autora nebo lidový původ');
assert.equal(node('transmission-section').hidden,true,'Distorted transmissions are absent in author mode');
assert.equal(node('hint-options').hidden,true,'No multiple choice before hints');
assert.ok(!node('collection-list').innerHTML.includes('Lidové přísloví'),'Collection does not leak the origin');
node('guess').value=p.answer;node('guess-form').fire('submit');
assert.equal(game.exportState().days[date].progress[id].status,'playing','Copying the displayed quote does not win');
assert.ok(node('result-panel').innerHTML.includes('Zkus jiné jméno'));
const hint=node('hint-clue');hint.dataset.hint='clue';
for(let level=1;level<=3;level++){
 events.get('click')({target:hint});state=game.exportState();
 assert.equal(state.days[date].progress[id].hintLevel,level);
 assert.equal(daily.totals(state).points,50,'Three stages cost one 50-point bundle');
 assert.equal(node('hint-options').hidden,level<3);
}
assert.equal((node('hint-options').innerHTML.match(/data-author-choice=/g)||[]).length,4,'Four choices appear only after stage three');
const correct=node('correct-option');correct.dataset.authorChoice=authors.get(p).profile;
events.get('click')({target:correct});state=game.exportState();
assert.equal(state.days[date].progress[id].status,'won','Choosing the unlocked correct name submits a valid guess');
assert.equal(daily.totals(state).points,250,'Hint and reward counted exactly once');
assert.ok(node('reveal-panel').innerHTML.includes(profile.name));
assert.ok(!node('reveal-panel').innerHTML.includes('Co slova znamenají'));
assert.ok(node('reveal-panel').innerHTML.includes('quote-story'));
assert.ok(node('reveal-panel').innerHTML.includes('Doložený pramen'));
assert.ok(!node('reveal-panel').innerHTML.includes('Celá cesta tiché pošty'),'Old distortion chain is not in new reveal');
assert.equal(node('hint-options').hidden,false);
assert.ok(node('hint-options').innerHTML.includes('disabled'),'Completed choices cannot submit more guesses');
game.replaceState(game.exportState());
assert.equal(daily.totals(game.exportState()).points,250,'Reload retains the correct mode and rewards');
const next=node('next-author');next.setAttribute('data-next','');events.get('click')({target:next});
const nextID=game.exportState().days[date].selected;
node('give-up').fire('click');await node('confirm-action').fire('click');
state=game.exportState();assert.equal(state.days[date].progress[nextID].skipCharge,100);assert.equal(daily.totals(state).points,150,'New concept keeps 100-point skips');
// A returning player's current classic day is archived and replaced immediately.
const old=daily.createState(null);daily.bindPlayer(old,'11111111-1111-4111-8111-111111111111');const oldDay=daily.ensureDay(old,date,{mode:'classic'}),oldID=oldDay.ids[0];
oldDay.progress[oldID]={...daily.blankRound(),hints:['clue'],hintLevel:2,chainLevel:1,draft:'rozepsaný původní tip'};
const oldBalance=daily.totals(old).points;
game.replaceState(old);const migrated=game.exportState();
assert.equal(migrated.days[date].mode,'author-v1');
assert.equal(node('history-access').hidden,false,'Preserved history remains accessible from the collection');
assert.ok(migrated.days[date].ids.every(id=>!oldDay.ids.includes(id)),'The old quotes are not repeated');
assert.equal(node('distorted-message').textContent,byId(migrated.days[date].selected).answer);
assert.equal(node('guess').placeholder,'Jméno autora nebo lidový původ');
assert.equal(node('transmission-section').hidden,true);
assert.equal(migrated.archivedDays[date].progress[oldID].chainLevel,1);
assert.equal(migrated.archivedDays[date].progress[oldID].draft,'rozepsaný původní tip');
assert.ok(node('classic-history-content').innerHTML.includes('rozepsaný původní tip'));
assert.equal(daily.totals(migrated).points,oldBalance,'Migration conserves the whole wallet');
console.log('PASS actual author UI and immediate migration with preserved archive, wallet, drafts, purchases and no repeated quote.');
// Meaningful feedback uses the actual UI, with no real account or transport.
const guided=daily.createState(null);daily.bindPlayer(guided,'11111111-1111-4111-8111-111111111111');
guided.days[date]={mode:'author-v1',ids:['poem-may','prose-bab-10','proverb-archive-8a156ea0364c'],selected:'poem-may',progress:{},seen:[],skipped:[]};
game.replaceState(guided);
node('guess').value='Němcová';node('guess-form').fire('submit');
assert.ok(node('result-panel').innerHTML.includes('označené shody')); 
assert.equal((node('result-panel').innerHTML.match(/<dt>/g)||[]).length,4);
node('guess').value='Neruda';node('guess-form').fire('submit');
assert.ok(node('result-panel').innerHTML.includes('všem obecným vodítkům'));
assert.ok(node('result-panel').innerHTML.includes('sedí více vodítek'));
assert.equal(game.exportState().days[date].progress['poem-may'].status,'playing','Four shared traits are not the correct identity');
const related=daily.createState(null);daily.bindPlayer(related,'11111111-1111-4111-8111-111111111111');
related.days[date]={mode:'author-v1',ids:['proverb-archive-8a156ea0364c','poem-may','descartes'],selected:'proverb-archive-8a156ea0364c',progress:{},seen:[],skipped:[]};
game.replaceState(related);node('guess').value='Bulánci';node('guess-form').fire('submit');
assert.equal(game.exportState().days[date].progress['proverb-archive-8a156ea0364c'].status,'won');
assert.equal(node('result-panel').hidden,true,'Success is integrated into the reveal');
assert.ok(node('reveal-panel').innerHTML.includes('Kdo se vleče, neuteče'));
assert.ok(node('reveal-panel').innerHTML.includes('https://www.bulanci.cz/'));
assert.ok(node('reveal-panel').innerHTML.includes('Lidové rčení – autor neznámý'));
console.log('PASS author trait cards, warmer comparison and verified game association in actual UI.');
// Original-language guidance is available before any guess and never charges points.
const foreignIDs=authors.ids.filter(id=>authors.get(id).original);
assert.equal(foreignIDs.length,25);
for(const quoteID of foreignIDs){
 const sample=daily.createState(null);daily.bindPlayer(sample,'11111111-1111-4111-8111-111111111111');
 sample.days[date]={mode:'author-v1',ids:[quoteID,'poem-may','poem-erben-poklad-01'],selected:quoteID,progress:{},seen:[],skipped:[]};
 game.replaceState(sample);const o=authors.get(quoteID).original;
 assert.equal(node('quote-original').hidden,false,'Original visible without a paid hint: '+quoteID);
 assert.ok(node('quote-original').innerHTML.includes('lang="'+o.lang+'"'));
 assert.ok(node('quote-original').innerHTML.includes(o.language));
 assert.ok(!node('quote-original').innerHTML.includes(o.source.url),'Source must not reveal author before a guess');
 assert.ok(!node('quote-original').innerHTML.includes(authors.profile(quoteID).name));
 assert.equal(daily.totals(game.exportState()).points,100,'Reading an original is free');
 game.replaceState(game.exportState());assert.equal(node('quote-original').hidden,false,'Original survives restored state');
}
assert.ok(node('quote-original').innerHTML.includes('&amp; par-tout'),'Original punctuation is escaped');
node('guess').value='Rousseau';node('guess-form').fire('submit');
assert.ok(node('reveal-panel').innerHTML.includes(authors.get('quote-rousseau-chains').original.source.url),'Original source is available after solving');
const native=daily.createState(null);daily.bindPlayer(native,'11111111-1111-4111-8111-111111111111');
native.days[date]={mode:'author-v1',ids:['poem-may','descartes','proverb-work'],selected:'poem-may',progress:{},seen:[],skipped:[]};
game.replaceState(native);assert.equal(node('quote-original').hidden,true);assert.equal(node('quote-original').innerHTML,'','A Czech quote clears the previous foreign original');
console.log('PASS 25 originals in seven languages: free before guessing, escaped, persistent, no author/source leak, no duplication for Czech.');
// Actual cloud module restores a mixed classic/author history and synchronizes names.
const accountID='22222222-2222-4222-8222-222222222222';
const remote=daily.createState(null);daily.bindPlayer(remote,accountID);
const before=daily.ensureDay(remote,'2026-10-19'),beforeID=before.ids[0];
before.progress[beforeID]={...daily.blankRound(),status:'won',attempts:[{id:'old-account-win',text:byId(beforeID).answer,time:fixed-86400000}]};
const current=daily.ensureDay(remote,date),currentID=current.ids[0];
const server={account:{id:accountID,name:'Tester',email:'test@example.test',emailConfirmed:true},state:copy(remote),consent:{granted:false},admin:false};
const session={access_token:'synthetic',user:{id:accountID}};
context.SeptandaSupabase={createClient(){return{auth:{onAuthStateChange(){},async getSession(){return{data:{session}};}}};}};
context.fetch=async(url,opts={})=>{
 if(url.includes('cloud-leaderboard'))return{ok:true,json:async()=>({date,entries:[],total:0})};
 if(opts.body){const body=JSON.parse(opts.body);if(body.action==='sync')server.state=copy(body.state);}
 return{ok:true,json:async()=>copy(server)};
};
vm.runInContext(await readFile(new URL('cloud.js',import.meta.url),'utf8'),context);
await context.SeptandaCloud.start({consent:{version:'v1',text:'Synthetic'},supabase:{url:'https://synthetic.supabase.test',publishableKey:'synthetic'}});
state=game.exportState();assert.equal(state.days[date].mode,'author-v1');
assert.equal(state.days['2026-10-19'].progress[beforeID].status,'won');
assert.equal(daily.totals(state).points,300,'Cold cloud restore retains old earned points');
assert.ok(!state.days[date].ids.includes(beforeID),'Account history excludes old quotes');
assert.equal(node('distorted-message').textContent,byId(currentID).answer);
node('guess').value=authors.profile(currentID).name;node('guess-form').fire('submit');
assert.equal(daily.totals(game.exportState()).points,500,'New author win adds to the preserved balance');
console.log('PASS actual cloud client restores mixed modes, old points and personal author selection.');
