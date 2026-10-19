import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {puzzles,engine,daily} from '../game.mjs';
import {createProgressTools} from '../backend/progress.mjs';
import {createCloudAPI} from '../backend/api.mjs';
import {CONSENT} from '../backend/config.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
let checks=0;
const ok=(x,label)=>{assert.ok(x,label);checks++;};
const eq=(a,b,label)=>{assert.deepEqual(clone(a),clone(b),label);checks++;};
const byID=new Map(puzzles.map(p=>[p.id,p]));
const approved=new Set(daily.approvedIDs);
ok(approved.size===135,'Explicit reviewed pool');
ok(!approved.has('quote-seneca-rest') && !approved.has('proverb-archive-3beea40a787e'),'Reported unfair puzzles cannot enter new assignments');
const review=JSON.parse(await readFile(new URL('../content/editorial-review.json',import.meta.url),'utf8'));
eq(Object.keys(review.entries).length,509,'Every retained identity has an editorial decision');
for(const id of approved)ok(byID.has(id) && review.entries[id].status==='approved','Admission: '+id);

const date='2026-10-20',now=new Date(date+'T12:00:00Z');
const userA='11111111-1111-4111-8111-111111111111',userB='22222222-2222-4222-8222-222222222222';
const tools=createProgressTools({puzzles,engine,daily});
const personal=id=>{const s=daily.createState(null);daily.bindPlayer(s,id);daily.ensureDay(s,date);return s;};
const a=personal(userA),b=personal(userB);
ok(a.days[date].ids.join()!==b.days[date].ids.join(),'Different players receive their own set');
eq(daily.ensureDay(daily.sanitizeState(clone(a)),date).ids,a.days[date].ids,'Reload preserves the exact assignment and order');
eq(daily.ensureDay(daily.sanitizeState(clone(a)),date).ids,a.days[date].ids,'A second device with the same identity and history agrees');
const variety=new Set();
for(let n=1;n<=1000;n++)variety.add(personal(n.toString(16).padStart(32,'0')).days[date].ids.join());
ok(variety.size>=990,'Personal selection has substantial variety across 1000 identities');
const seen=new Set(),long=daily.createState(null);daily.bindPlayer(long,userA);
let fullDays=0;
for(let n=0;n<35;n++){
  const key=new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  const d=daily.ensureDay(long,key);
  if(d.ids.length)fullDays++;
  for(const id of d.ids){ok(approved.has(id),'Only approved content is assigned');ok(!seen.has(id),'No prior assigned puzzle returns, including unopened slots');seen.add(id);}
}
eq(fullDays,27,'135 approved puzzles provide 27 complete personal sets');
eq(seen.size,135,'The complete reviewed pool is used exactly once');
eq(daily.ensureDay(long,'2027-05-01').ids,[],'Exhausted content never wraps around');

const guest=daily.createState(null);daily.ensureDay(guest,date,{personal:true});
ok(guest.assignmentSeed.startsWith('guest:'),'A guest has a browser-owned seed');
eq(daily.sanitizeState(clone(guest)).assignmentSeed,guest.assignmentSeed,'Guest identity persists through storage');
eq(daily.ensureDay(daily.sanitizeState(clone(guest)),date).ids,guest.days[date].ids,'A guest is not rerolled on reload');
const stored=tools.merge(null,a,{now,playerId:userA});
const forged=clone(a);forged.assignmentSeed=daily.accountSeed(userB);forged.days[date].ids=b.days[date].ids;
assert.throws(()=>tools.merge(stored.state,forged,{now,playerId:userA}),/sada se změnila/);checks++;
const held=clone(a);held.days[date].ids[0]='quote-seneca-rest';
assert.throws(()=>tools.merge(null,held,{now,playerId:userA}),/sada se změnila/);checks++;
const future=clone(a);future.days['2099-01-01']=future.days[date];delete future.days[date];
assert.throws(()=>tools.merge(null,future,{now,playerId:userA}),/budoucí/);checks++;
const emptyIncoming=daily.createState(null);
const retained=tools.merge(stored.state,emptyIncoming,{now,playerId:userA});
eq(retained.state.days[date].ids,stored.state.days[date].ids,'An empty device cannot remove the server assignment');

const first=a.days[date].ids[0];
const hinted=clone(a);hinted.days[date].progress[first]={...daily.blankRound(),hints:['clue'],hintLevel:3};
const hintSaved=tools.merge(stored.state,hinted,{now,playerId:userA});
eq(hintSaved.stats.points,50,'All three clues cost one 50-point purchase');
const stale=clone(hinted);stale.days[date].progress[first].hintLevel=1;
const hintMerged=tools.merge(hintSaved.state,stale,{now,playerId:userA});
eq(hintMerged.state.days[date].progress[first].hintLevel,3,'An older device cannot relock clues');
eq(hintMerged.stats.points,50,'A repeated clue sync never charges again');
eq(daily.sanitizeState(hintMerged.state).days[date].progress[first].hintLevel,3,'Clue level survives client reload');
// A cold second device must load the account history before allocating new content.
const priorDay='2026-10-19',archive=daily.createState(null);daily.bindPlayer(archive,userA);
const prior=daily.ensureDay(archive,priorDay),priorID=prior.ids[0];
prior.progress[priorID]={...daily.blankRound(),status:'won',attempts:[{id:'prior-win-1',text:byID.get(priorID).answer,time:Date.parse(priorDay+'T12:00:00Z')}]};
const archived=tools.merge(null,archive,{now,playerId:userA});
daily.ensureDay(archived.state,date);
const cold=personal(userA);daily.markSeen(cold.days[date],cold.days[date].ids[0]);
const coldMerge=daily.mergeForSync(archived.state,cold);
eq(coldMerge.state.days[priorDay].progress[priorID].status,'won','A cold device keeps earlier account wins');
eq(coldMerge.state.days[date].ids,archived.state.days[date].ids,'The account reservation replaces a cold-device guess');
eq(daily.totals(coldMerge.state).points,300,'Remote points survive a cold device with only a viewed puzzle');
ok(!coldMerge.backupRequired,'A cold device needs no conflict backup');
const offline=personal(userA);offline.days[date].progress[first]={...daily.blankRound(),draft:'tip z letadla'};
const reserved=clone(archived.state);reserved.days[date].seen=[];
const offlineMerge=daily.mergeForSync(reserved,offline);
eq(offlineMerge.state.days[date].ids,offline.days[date].ids,'Real offline work can replace an unused reservation');
eq(tools.merge(reserved,offlineMerge.state,{now,playerId:userA}).state.days[date].progress[first].draft,'tip z letadla','The server preserves an offline draft');
const conflict=clone(reserved);const remoteFirst=conflict.days[date].ids[0];
conflict.days[date].progress[remoteFirst]={...daily.blankRound(),draft:'rozepsáno na druhém zařízení'};
const conflictMerge=daily.mergeForSync(conflict,offline);
ok(conflictMerge.backupRequired,'Two genuinely worked-on different sets require a private backup before replacement');
eq(conflictMerge.state.days[date].ids,conflict.days[date].ids,'A worked-on cloud assignment stays frozen');
eq(conflictMerge.state.days[date].progress[remoteFirst].draft,'rozepsáno na druhém zařízení','The saved remote draft remains');
const sameDraft=clone(stored.state);sameDraft.days[date].progress[first]={...daily.blankRound(),draft:'můj další tip',hints:['clue'],hintLevel:2};
const sameMerged=daily.mergeForSync(hintMerged.state,sameDraft);
eq(sameMerged.state.days[date].progress[first].hintLevel,3,'Client merge never relocks the third clue');
eq(sameMerged.state.days[date].progress[first].draft,'můj další tip','Matching assignments preserve the local draft');
// Pre-update shared assignments remain archival records, including now-held content.
const oldShared=daily.createState(null);const shared=daily.ensureDay(oldShared,priorDay),sharedFirst=shared.ids[0];
shared.progress[sharedFirst]={...daily.blankRound(),status:'won',attempts:[{id:'old-shared-win',text:byID.get(sharedFirst).answer,time:Date.parse(priorDay+'T10:00:00Z')}],hints:['clue']};
const oldSaved=tools.merge(null,oldShared,{now:new Date(priorDay+'T12:00:00Z')});
const upgraded=tools.merge(oldSaved.state,daily.createState(null),{now,playerId:userA});
eq(upgraded.state.days[priorDay].ids,shared.ids,'Upgrade does not replace an issued shared set');
eq(upgraded.stats.points,250,'Upgrade keeps the old win and purchased hint');
const guestImported=tools.merge(stored.state,guest,{now,playerId:userA,importLegacy:true});
eq(guestImported.state.days[date].ids,guest.days[date].ids,'An explicit guest import can replace an untouched reservation');
eq(guestImported.state.assignmentSeed,daily.accountSeed(userA),'Future selections stay tied to the account, not a client seed');
const hasWork=clone(stored.state);hasWork.days[date].progress[first]={...daily.blankRound(),draft:'rozpracováno'};
assert.throws(()=>tools.merge(hasWork,guest,{now,playerId:userA,importLegacy:true}),/sada se změnila/);checks++;

// HTTP integration: independent accounts and racing devices allocate through CAS.
const dbState=new Map([userA,userB].map(id=>[id,{state:daily.createState(null),revision:0,stats:{points:100,solved:0,spent:0,attempts:0,revealed:0}}]));
let commits=0;
const db={ready(){},async verifiedUser(req){const id=req.headers.get('authorization')?.replace('Bearer ','');assert.ok(dbState.has(id));return{id,email:'synthetic@example.test',email_confirmed_at:now.toISOString()};},async isAdmin(){return false;},
  async read(table,query,{user}={}){
    const id=user?.id || query.match(/user_id=eq\.([^&]+)/)?.[1];
    if(table==='septanda_profiles')return{data:[{display_name:'Tester',email:'synthetic@example.test',email_confirmed_at:now.toISOString()}]};
    if(table==='septanda_marketing_consents')return{data:[{granted:false,text:CONSENT.text,version:CONSENT.version}]};
    if(table==='septanda_progress')return{data:[clone(dbState.get(id))]};
    throw Error('Unexpected table '+table);
  },async rpc(name,body){
    assert.equal(name,'septanda_commit_progress');const prior=dbState.get(body.p_user);
    if(prior.revision!==body.p_expected_revision)return{saved:false,revision:prior.revision};
    const revision=prior.revision+1;dbState.set(body.p_user,{state:clone(body.p_state),revision,stats:body.p_stats});commits++;return{saved:true,revision};
  }};
const api=createCloudAPI({game:{puzzles,engine,daily},db,clock:()=>now});
const get=id=>api(new Request('https://game.test/.netlify/functions/player',{headers:{Authorization:'Bearer '+id}}),'player');
const responses=await Promise.all([get(userA),get(userA),get(userB)]);
for(const response of responses)eq(response.status,200,'Personal account load succeeds');
const [one,two,other]=await Promise.all(responses.map(r=>r.json()));
eq(one.state.days[date].ids,two.state.days[date].ids,'Racing devices receive one frozen server assignment');
ok(one.state.days[date].ids.join()!==other.state.days[date].ids.join(),'HTTP accounts receive different selections');
eq(commits,2,'Reservations are idempotent, one per account');
eq((await(await get(userA)).json()).state.days[date].ids,one.state.days[date].ids,'Reopening the account does not shuffle the set');
eq(commits,2,'Reading an existing set is not a new write');

const context=vm.createContext({SeptandaEngine:engine});
vm.runInContext(await readFile(new URL('../client/guidance.js',import.meta.url),'utf8'),context);
const guide=context.SeptandaGuidance;
const p=byID.get('proverb-archive-115-no-such-id') || puzzles.find(x=>x.answer==='Rané ptáče dál doskáče.');
eq(guide.feedback('RÁNNÍ ptáče už doskákalo',p).matched,['ranni','ptace'],'Feedback reports only actually typed matching key words');
eq(guide.feedback('a kdo je to ve',p).matched,[],'Function words are not misleading positive feedback');
eq(guide.feedback('pohovka a pracovní rozpis',p).matched,[],'No invented semantic understanding');
ok(guide.feedback('ranní ptáče',p).caution.includes('nepotvrzuje správný význam'),'Word matches are not presented as verified meaning');
for(const id of approved){const clues=guide.clues(byID.get(id));ok(clues.length===3 && clues.every(s=>s.length>15),'Three substantive clues: '+id);ok(!clues.some(s=>engine.evaluate(s,byID.get(id)).accepted),'A clue never simply prints the entire accepted answer: '+id);}
const app=await readFile(new URL('../client/app.js',import.meta.url),'utf8');
ok(!/\$\{(?:s|a\.score)\.(?:total|words|meaning)\}.*?%/.test(app),'Percentages no longer render as guidance');
ok(app.includes('data-guide') && app.includes('guidance-words'),'A concrete next step follows an unsuccessful attempt');
console.log(JSON.stringify({personalAndGuidanceChecks:checks,approved:approved.size,held:509-approved.size,uniqueSelectionsIn1000:variety.size,completePersonalSets:fullDays}));
