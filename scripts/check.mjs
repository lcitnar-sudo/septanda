import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {puzzles,engine,daily} from '../game.mjs';

let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const ids=new Set(puzzles.map(p=>p.id));
check(puzzles.length===509 && ids.size===509,'509 unique puzzles including9 original archive records');
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
for(let i=0;i<100;i++){
  const date=new Date(startTime+i*86400000).toISOString().slice(0,10), day=daily.plan(date);
  check(day.length===5 && new Set(day).size===5 && day.every(id=>byId.has(id)),'Five valid puzzles: '+date);
  const categories=day.map(id=>byId.get(id).category);
  check(categories.filter(c=>c==='Lidové přísloví').length===2,'Daily two proverbs: '+date);
  allDays.push(...day);
}
check(new Set(allDays).size===500,'No repeat during100 days');
const cycleDate=new Date(startTime+100*86400000).toISOString().slice(0,10);
check(daily.plan(cycleDate).join()===daily.plan(daily.scheduleStart).join(),'After100days the curated cycle repeats');
const legacy=daily.legacyPlan('2026-10-16');
assert.deepEqual(legacy,['poem-may','proverb-pit','poem-bouquet','caesar-dice','proverb-measure']);checks++;
assert.deepEqual(daily.plan('2026-10-15'),['poem-bouquet','poem-noon','descartes','proverb-work','poem-may']);checks++;
check(daily.plan('2026-10-16').join()===legacy.join(),'Published prelaunch day preserved');
assert.deepEqual(daily.plan('2026-10-17'),['caesar-victory','descartes','poem-noon','poem-may','proverb-work']);checks++;
const state=daily.createState(null), day=daily.ensureDay(state,'2026-10-16');
day.progress[day.ids[0]]={attempts:[{id:'qa-stable-id',text:byId.get(day.ids[0]).answer,time:123}],hints:['clue'],status:'won',draft:''};
const cleaned=daily.sanitizeState(state);
check(cleaned.days['2026-10-16'].progress[day.ids[0]].attempts[0].id==='qa-stable-id','Stable attempt ID survives local reload');
check(daily.totals(cleaned).points===250,'Walletawardandhintcost unchanged');
check(cleaned.days['2026-10-16'].ids.join()===legacy.join(),'Archived daily IDs survive reload');

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
console.log(JSON.stringify({checks,puzzles:puzzles.length,days:100,uniqueNewTargets:new Set(allDays).size,scripts:scripts.length}));
