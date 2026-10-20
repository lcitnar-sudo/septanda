/* Purchases are monotone, priced by the server and safe across simultaneous devices. */
import assert from 'node:assert/strict';
import {puzzles,engine,daily} from '../game.mjs';
import {createCloudAPI} from '../backend/api.mjs';
import {createProgressTools} from '../backend/progress.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(copy(a),copy(b),m);checks++;};
const id='11111111-1111-4111-8111-111111111111',date='2026-10-19',now=new Date(date+'T12:00:00Z');
const tools=createProgressTools({puzzles,engine,daily});
const seed=daily.createState(null);daily.bindPlayer(seed,id);
const prior=daily.ensureDay(seed,'2026-10-18'),priorId=prior.ids[0];
prior.progress[priorId]={...daily.blankRound(),status:'won',attempts:[{id:'previous-day-winning',text:puzzles.find(p=>p.id===priorId).answer,time:now.getTime()-86400000}]};
const day=daily.ensureDay(seed,date,{mode:'classic'}),pid=day.ids[0];
const initial=tools.merge(null,seed,{now,playerId:id});
let row={state:copy(initial.state),revision:1,stats:initial.stats},commits=0;
const db={ready(){},async verifiedUser(){return{id,email:'synthetic@example.test',email_confirmed_at:now.toISOString()};},async isAdmin(){return false;},
 async read(table){if(table==='septanda_profiles')return{data:[{display_name:'Tester'}]};if(table==='septanda_progress')return{data:[copy(row)]};if(table==='septanda_marketing_consents')return{data:[{granted:false}]};throw Error(table);},
 async rpc(name,b){assert.equal(name,'septanda_commit_progress');if(row.revision!==b.p_expected_revision)return{saved:false};row={state:copy(b.p_state),revision:row.revision+1,stats:b.p_stats};commits++;return{saved:true};}};
const api=createCloudAPI({game:{puzzles,engine,daily},db,clock:()=>now});
const call=(body={})=>api(new Request('https://synthetic.test/.netlify/functions/player',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic',Origin:'https://synthetic.test'},body:JSON.stringify({action:'chain-step',date,id:pid,...body})}),'player');
const racing=await Promise.all([call({level:1}),call({level:1})]);
eq(racing.map(r=>r.status),[200,200],'Same-target requests from two devices both succeed');
eq(commits,1,'Two devices buy the same step only once');eq(row.stats.points,250,'First step costs 50');
eq((await call({level:3})).status,409,'Cannot jump over the next step in purchase API');eq(row.stats.points,250,'Invalid jump spends nothing');
for(let level=2;level<=4;level++) {eq((await call({level})).status,200,'Purchase next transmission');eq(row.stats.points,300-level*50,'Each next step costs exactly 50');}
eq(row.state.days[date].progress[pid].chainLevel,4,'All four earlier transmissions stored');
eq(row.stats.spent,200,'Four steps cost 200');eq(tools.dayScores(row.state).find(s=>s.date===date).points,-200,'Daily ranking includes transmission purchases');
eq((await call({level:4})).status,200,'Repeat of final purchase is idempotent');eq(row.stats.points,100,'Final step is never charged twice');
eq((await call({level:5})).status,400,'Cannot buy a fifth step or the original answer');
for(const level of [-1,0,1.5,'1',null])eq((await call({level})).status,400,'Invalid target rejected');
eq((await call({level:1,date:'2026-10-21'})).status,400,'Cannot buy future transmissions');
eq((await call({level:1,id:day.ids[1]})).status,409,'Cannot buy hints on locked later puzzle');
const stale=copy(initial.state),merged=tools.merge(row.state,stale,{now,playerId:id});
eq(merged.stats.points,100,'Stale sync cannot refund steps');eq(merged.state.days[date].progress[pid].chainLevel,4,'Stale sync preserves highest step');
eq(daily.totals(daily.sanitizeState(row.state)).points,100,'Reload retains all charges');
eq(daily.totals(daily.mergeForSync(row.state,stale).state).points,100,'Cloud reconciliation retains all charges');
eq((await call({action:'skip'})).status,200,'Can skip with the remaining 100');eq(row.stats.points,0,'Skip charges 100 in addition to transmissions');
eq(row.state.days[date].progress[pid].skipCharge,100,'New skip has its amount recorded');
eq((await call({action:'skip'})).status,200,'Repeated skip is idempotent');eq(row.stats.points,0,'Repeated skip does not spend twice');
eq((await call({level:1,id:day.ids[1]})).status,409,'No purchase with insufficient wallet');eq(row.stats.points,0,'Rejected step changes no saved data');
// An older paid skip without an amount is an immutable 200-point transaction.
const old=copy(initial.state);old.days[date].progress[pid]={...daily.blankRound(),status:'revealed',paidSkip:true};
const forged=copy(old);forged.days[date].progress[pid].skipCharge=1;forged.days[date].progress[pid].chainLevel=4;
const historical=tools.merge(old,forged,{now,playerId:id});
eq(historical.stats.points,100,'Old 200-point skip cannot be repriced by a client');eq(historical.state.days[date].progress[pid].skipCharge,200,'Old price is recorded durably');
eq(historical.state.days[date].progress[pid].chainLevel||0,0,'No charge for buying already-free terminal chain');
eq(daily.totals(daily.mergeForSync(old,forged).state).spent,200,'Completed remote rounds do not charge for their already-free chain');
const poor=daily.createState(null);daily.bindPlayer(poor,id);const poorDay=daily.ensureDay(poor,date,{mode:'classic'}),poorID=poorDay.ids[0];
let base=tools.merge(null,poor,{now,playerId:id});const buy=copy(base.state);buy.days[date].progress[poorID]={...daily.blankRound(),chainLevel:2};
base=tools.merge(base.state,buy,{now,playerId:id});eq(base.stats.points,0,'Offline sync charges each of two steps');
const overspend=copy(base.state);overspend.days[date].progress[poorID].chainLevel=3;
assert.throws(()=>tools.merge(base.state,overspend,{now,playerId:id}),/dost bodů/);checks++;
for(const bad of [-1,5,1.5,'2']){const invalid=copy(base.state);invalid.days[date].progress[poorID].chainLevel=bad;assert.throws(()=>tools.merge(base.state,invalid,{now,playerId:id}),/Neplatný krok/);checks++;}
console.log(JSON.stringify({transmissionAndHistoricalFeeChecks:checks,perStep:daily.chainCost,newSkip:daily.skipCost}));
