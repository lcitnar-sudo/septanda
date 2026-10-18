import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {puzzles,engine,daily} from '../game.mjs';

let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const ids=new Set(puzzles.map(p=>p.id));
const calendar=JSON.parse(await readFile(new URL('../content/schedule.json',import.meta.url),'utf8'));
check(puzzles.length>=509 && ids.size===puzzles.length,'Unique puzzle catalog including9 original archive records');
const byId=new Map(puzzles.map(p=>[p.id,p]));
for(const p of puzzles){
  check(engine.evaluate(p.answer,p).accepted,'Original accepted: '+p.id);
  check(p.variants.every(v=>engine.evaluate(v,p).accepted),'Variants accepted: '+p.id);
  check(p.chain.length===5 && p.chain.every(s=>typeof s==='string' && s.length>5),'Five real transmissions: '+p.id);
  check(!engine.evaluate(p.chain[4],p).accepted,'Final distortion does not solve itself: '+p.id);
  check(p.sources.length>0 && p.sources.every(s=>/^https:\/\//.test(s.url)),'Primary source links: '+p.id);
  check(p.concepts.length>0 && p.concepts.every(g=>g.length>0),'Semantic cues: '+p.id);
}
const allDays=[];
const startTime=Date.parse(daily.scheduleStart+'T12:00:00Z');
check(Number.isFinite(startTime),'The curated calendar has a valid launch date');
for(let i=0;i<calendar.days.length;i++){
  const date=new Date(startTime+i*86400000).toISOString().slice(0,10), day=daily.plan(date);
  check(day.length===5 && new Set(day).size===5 && day.every(id=>byId.has(id)),'Five valid puzzles: '+date);
  const categories=day.map(id=>byId.get(id).category);
  check(categories.filter(c=>c==='Lidové přísloví').length===2,'Daily two proverbs: '+date);
  allDays.push(...day);
}
check(new Set(allDays).size===allDays.length,'No repeated puzzle in the curated calendar');
const cycleDate=new Date(startTime+calendar.days.length*86400000).toISOString().slice(0,10);
check(daily.plan(cycleDate).length===0,'After100days no old puzzles are recycled');
check(daily.plan(new Date(Date.parse(cycleDate+'T12:00:00Z')+366*86400000).toISOString().slice(0,10)).length===0,'Later years do not restart the catalog');
const legacy=daily.legacyPlan('2026-10-16');
assert.deepEqual(legacy,['poem-may','proverb-pit','poem-bouquet','caesar-dice','proverb-measure']);checks++;
assert.deepEqual(daily.plan('2026-10-15'),['poem-bouquet','poem-noon','descartes','proverb-work','poem-may']);checks++;
check(daily.plan('2026-10-16').join()===legacy.join(),'Published prelaunch day preserved');
assert.deepEqual(daily.plan('2026-10-17'),['caesar-victory','descartes','poem-noon','poem-may','proverb-work']);checks++;
assert.deepEqual(daily.plan('2026-10-18'),['proverb-pit','poem-may','caesar-dice','proverb-work','proverb-measure']);checks++;
const state=daily.createState(null), day=daily.ensureDay(state,'2026-10-16');
day.progress[day.ids[0]]={attempts:[{id:'qa-stable-id',text:byId.get(day.ids[0]).answer,time:123}],hints:['clue'],status:'won',draft:''};
const cleaned=daily.sanitizeState(state);
check(cleaned.days['2026-10-16'].progress[day.ids[0]].attempts[0].id==='qa-stable-id','Stable attempt ID survives local reload');
check(daily.totals(cleaned).points===250,'Walletawardandhintcost unchanged');
check(cleaned.days['2026-10-16'].ids.join()===legacy.join(),'Archived daily IDs survive reload');
const history=daily.createState(null),today='2026-10-18';
history.legacy.progress['proverb-pit']={...daily.blankRound(),status:'revealed'};
const guarded=daily.ensureDay(history,today);
check(guarded.skipped.includes('proverb-pit'),'Previously revealed original is not offered again');
check(guarded.selected!=='proverb-pit','The next new puzzle is selected automatically');
check(!daily.canSelect(guarded,'proverb-pit'),'A skipped puzzle cannot be selected as a new round');
check(daily.totals(history).points===100,'Skipping known puzzles does not award points');
check(daily.markSeen(guarded,guarded.selected),'Presenting a new puzzle records its identity');
const tomorrow=daily.ensureDay(history,'2026-10-19');
check(tomorrow.skipped.length===0,'The500new puzzles are separate from the old archive');
const preserved=daily.ensureDay(history,today);preserved.progress['proverb-pit']={...daily.blankRound(),draft:'rozehraný tip'};
daily.reconcileDay(history,today);
check(!preserved.skipped.includes('proverb-pit'),'Existing unfinished work is preserved');
for(const id of tomorrow.ids)history.legacy.progress[id]={...daily.blankRound(),status:'revealed'};
daily.reconcileDay(history,'2026-10-19');
check(tomorrow.selected===null && daily.nextId(tomorrow)===null,'All known day has no question to replay');
const restored=daily.sanitizeState(history);
check(restored.days[today].seen.includes(guarded.seen[0]),'Exposure history survives local reload');
check(restored.days['2026-10-19'].skipped.length===5,'Skipped IDs are rebuilt from the player history');
const empty=daily.ensureDay(history,cycleDate);
check(empty.ids.length===0 && empty.selected===null,'Exhausted catalog has a valid empty day');
const extension=vm.createContext({SEPTANDA_PUZZLES:puzzles,SeptandaEngine:engine,SEPTANDA_SCHEDULE:{start:'2026-01-01',days:[]}});
vm.runInContext(await readFile(new URL('../client/daily.js',import.meta.url),'utf8'),extension);
const pending=extension.SeptandaDaily.createState(null);
check(extension.SeptandaDaily.ensureDay(pending,'2026-01-01').ids.length===0,'No content is an empty assignment');
extension.SEPTANDA_SCHEDULE.days.push({ids:puzzles.slice(0,5).map(p=>p.id)});
check(extension.SeptandaDaily.ensureDay(pending,'2026-01-01').ids.length===5,'Newly added content fills an earlier empty assignment');

const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8'),headers=await readFile(new URL('../public/_headers',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script id="([^"]+)">([\s\S]*?)<\/script>/g)];
check(scripts.length>=8,'All functional modules in standalone HTML');
for(const [,name,code] of scripts){
  new vm.Script(code,{filename:name});checks++;
  check(headers.includes("'sha256-"+createHash('sha256').update(code).digest('base64')+"'"),'Matching CSP: '+name);
}
check(!/<script[^>]+src=/.test(html),'No missing external JS on Netlify Drop');
check(!/<link[^>]+rel="stylesheet"/.test(html),'Styles/fonts bundled into HTML');
check(!/sb_secret_[A-Za-z0-9_-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*[:=]/.test(html),'No server key in public HTML');
check(headers.includes("form-action 'self'") && headers.includes('https://*.supabase.co'),'Auth andcontact permitted by CSP');
check(/name="septanda-contact"/.test(html) && /data-netlify="true"/.test(html),'Contact detectable by Netlify');
check(!/<input[^>]+id="marketing-opt-in"[^>]+checked/.test(html),'Marketing never prechecked');
check(!/\p{Extended_Pictographic}/u.test(html.replace(/data:[^"']+/g,'')),'No emoji in game UI');
console.log(JSON.stringify({checks,puzzles:puzzles.length,days:calendar.days.length,uniqueNewTargets:new Set(allDays).size,scripts:scripts.length}));
