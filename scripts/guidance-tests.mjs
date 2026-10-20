import assert from 'node:assert/strict';
import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import {puzzles,engine,daily} from '../game.mjs';
import {createProgressTools} from '../backend/progress.mjs';
const context=vm.createContext({});for(const file of ['authors-data','authors'])vm.runInContext(await readFile(new URL('../client/'+file+'.js',import.meta.url),'utf8'),context);
const authors=context.SeptandaAuthors,byId=new Map(puzzles.map(p=>[p.id,p])),copy=x=>JSON.parse(JSON.stringify(x));
let checks=0;const ok=(x,m)=>{assert.ok(x,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(copy(a),copy(b),m);checks++;};
const may=byId.get('poem-may'),folk=byId.get('proverb-archive-8a156ea0364c');
const nemcova=authors.proximity('Němcová',may),neruda=authors.proximity('Jan Neruda',may);
eq(nemcova.matches,3,'Same Czech 19th-century literary background, different focus');eq(neruda.matches,4,'Poetry gives Neruda one more shared clue with Macha');
const hotter=authors.feedback('Neruda',may,false,'Němcová');ok(hotter.comparison.includes('sedí více'),'Closer is tied to additional factual match');
const colder=authors.feedback('Němcová',may,false,'Neruda');ok(colder.comparison.includes('sedí méně'),'Moving away is explained');
const tie=authors.feedback('Hálek',may,false,'Neruda');ok(tie.comparison.includes('stejně blízko'),'Equal clues do not invent a ranking');
eq(authors.feedback('Neruda',may,false,'Neruda').comparison,'','Repeating the same identity is not a warmer guess');
eq(authors.proximity('Sartre',may),null,'Unknown identity has no fake distance');
eq(authors.proximity('Neruda nebo Němcová',may),null,'Lists are not one personality');eq(authors.proximity('nebyl to Neruda',may),null,'Negative claim is not a personality guess');
eq(authors.proximity('René',may),null,'Ambiguous first name is not compared');eq(authors.proximity('autor neznámý',may),null,'Folk origin has no personal distance');eq(authors.proximity('Newton',folk),null,'Anonymous target has no fake personal distance');
ok(authors.proximity('Shakespeare',may).traits.find(t=>t.key==='period').text.includes('později'),'Earlier guess points later');ok(authors.proximity('Neruda',byId.get('quote-newton-giants')).traits.find(t=>t.key==='period').text.includes('dříve'),'Later guess points earlier');
const jirasekID=authors.ids.find(id=>authors.get(id).profile==='jirasek');ok(authors.proximity('Čapek',byId.get(jirasekID)).traits.find(t=>t.key==='period').match,'Spanning periods are preserved');
for(const id of authors.ids){
 const p=byId.get(id),entry=authors.get(id);
 for(const name of ['Bulánci','bulanci','Bulánky','hra Bulánci','BULÁNCI 2.0'])eq(engine.evaluate(name,p,'author-v1').accepted,id===folk.id,'Related use is strictly question-specific');
 if(entry.profile!=='folk'){
  const near=authors.proximity(authors.profile(id).name,p);eq(near.matches,4,'Canonical author shares every trait');
  ok(near.traits.every(t=>t.text&&t.label),'Every shared clue is readable');
 }
}
for(const name of ['ne Bulánci','Bulánci nebo Neruda','polštáře','SleepTeam'])ok(!engine.evaluate(name,folk,'author-v1').accepted,'No unreviewed shortcut or mixed answer');
ok(!engine.evaluate('Bulánci',folk,'classic').accepted,'Classic reconstruction is unchanged');
const feedback=authors.feedback('Bulánci',folk,true);ok(feedback.relatedUse,'Recognized game is identified as later use');ok(feedback.detail.includes('Kdo se vleče')&&feedback.detail.includes('Co se vleče'),'Both different wordings are explained');
const user='11111111-1111-4111-8111-111111111111',date='2026-10-20',now=new Date(date+'T13:00:00Z'),state=daily.createState(null);daily.bindPlayer(state,user);
state.days[date]={mode:'author-v1',ids:[folk.id,'poem-may','descartes'],selected:folk.id,progress:{[folk.id]:{...daily.blankRound(),attempts:[{id:'bulanci-original-tip',text:'Bulánci',time:now.getTime()}]}},seen:[folk.id],skipped:[]};
const tools=createProgressTools({puzzles,engine,daily}),saved=tools.merge(state,copy(state),{now,playerId:user});
eq(saved.state.days[date].progress[folk.id].status,'won','Previously unrecognized valid association is accepted on regrade');eq(saved.stats.points,300,'One 200-point reward on server');eq(tools.merge(saved.state,copy(state),{now,playerId:user}).stats.points,300,'Stale sync cannot duplicate reward');
const closed=copy(state);Object.assign(closed.days[date].progress[folk.id],{status:'revealed',paidSkip:true,skipCharge:100});const preserved=tools.merge(closed,copy(closed),{now,playerId:user});eq(preserved.state.days[date].progress[folk.id].status,'revealed','Closed skip does not turn into a new win');eq(preserved.stats.points,0,'Historical skip price is preserved');
console.log(JSON.stringify({factualGuidanceChecks:checks,example:{nemcova:nemcova.matches,neruda:neruda.matches,total:4},bulanciAcceptedOnlyFor:folk.id}));
