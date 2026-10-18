import {createHash} from 'node:crypto';
import {fail} from './http.mjs';
export const HINT_COST = Object.freeze({clue:50,small:30,previous:60});
const object = value => value && typeof value==='object' && !Array.isArray(value);
const digest = value => createHash('sha256').update(value).digest('hex');
const hasWork = round => Boolean(round && (round.attempts?.length || round.hints?.length || round.status==='revealed'));
const blank = () => ({attempts:[],hints:[],status:'playing',draft:''});

// The game module is injected so the exact same catalog/calendar/scorer is used by tests and production.
export function createProgressTools({puzzles,engine,daily}) {
  const byId = new Map(puzzles.map(puzzle=>[puzzle.id,puzzle]));
  const legacyIds = new Set(daily.legacyIDs || ['caesar-victory','proverb-pit','poem-may','caesar-dice','proverb-work','poem-noon','descartes','proverb-measure','poem-bouquet']);
  function attempts(source,puzzle,now) {
    if (source===undefined) return [];
    if (!Array.isArray(source) || source.length>500) fail(413,'U jedné hádanky lze uložit nejvýše 500 tipů.');
    const out=[],seen=new Map();
    for (const item of source) {
      if (!object(item) || typeof item.text!=='string' || item.text.length>400 || !engine.normalize(item.text)) fail(400,'Historie obsahuje neplatný tip.');
      const rawTime = Number.isFinite(item.time) ? Math.max(0,Math.min(Math.floor(item.time),Number.MAX_SAFE_INTEGER)) : 0;
      const time = Math.min(rawTime,now.getTime());
      const id = typeof item.id==='string' && /^[a-zA-Z0-9_-]{8,96}$/.test(item.id) ? item.id : digest(item.text+'\0'+rawTime).slice(0,32);
      if (seen.has(id)) { if (seen.get(id)!==item.text) fail(400,'Dva rozdílné tipy mají stejné označení.'); continue; }
      seen.set(id,item.text);
      out.push({id,text:item.text,time,score:engine.evaluate(item.text,puzzle)});
    }
    return out;
  }
  function round(source,puzzle,now,{legacy=false}={}) {
    if (!object(source)) return blank();
    const out = blank();
    out.attempts = attempts(source.attempts,puzzle,now);
    const allowed = legacy ? Object.keys(HINT_COST) : ['clue'];
    if (source.hints!==undefined && !Array.isArray(source.hints)) fail(400,'Neplatné nápovědy.');
    out.hints = [...new Set((source.hints||[]).filter(h=>allowed.includes(h)))];
    out.status = source.status==='revealed' ? 'revealed' : out.attempts.some(attempt=>attempt.score.accepted) ? 'won' : 'playing';
    out.draft = typeof source.draft==='string' ? source.draft.slice(0,400) : '';
    return out;
  }
  function mergeRound(previous,incoming,puzzle,now,options={}) {
    // Existing records already passed this validator. Regrade scores without making a revealed result a win.
    const a=round(previous,puzzle,now,{legacy:true}),b=round(incoming,puzzle,now,options),result=blank();
    const seen=new Set();
    for (const item of [...a.attempts,...b.attempts]) if (!seen.has(item.id)) { seen.add(item.id); result.attempts.push(item); }
    if (result.attempts.length>500) fail(413,'U jedné hádanky lze uložit nejvýše 500 tipů.');
    result.hints=[...new Set([...a.hints,...b.hints])];
    result.status = ['won','revealed'].includes(previous?.status) ? previous.status : b.status==='revealed' ? 'revealed' : result.attempts.some(attempt=>attempt.score.accepted) ? 'won' : 'playing';
    result.draft=object(incoming) ? b.draft : a.draft;
    return result;
  }
  function selection(day,preferred) {
    return daily.canSelect(day,preferred) ? preferred : daily.nextId(day) || day.ids.find(id=>!day.skipped?.includes(id)) || null;
  }
  function canonicalIDs(key,source,previous,now) {
    if (!daily.validDay(key) || key>daily.dayKey(now)) fail(400,'Nelze ukládat neplatný nebo budoucí den.');
    const planned=daily.plan(key);
    if (!Array.isArray(planned) || ![0,5].includes(planned.length) || new Set(planned).size!==planned.length || !planned.every(id=>byId.has(id))) fail(503,'Denní sada není dostupná.');
    // A previously stored day keeps its published IDs even after a catalog update.
    const expected=Array.isArray(previous?.ids) && (previous.ids.length===5 || previous.ids.length===0 && planned.length===0) && previous.ids.every(id=>byId.has(id)) ? previous.ids : planned;
    if (source?.ids && (!Array.isArray(source.ids) || source.ids.length!==expected.length || source.ids.some((id,i)=>id!==expected[i]))) {
      const old = typeof daily.legacyPlan==='function' ? daily.legacyPlan(key) : null;
      if (!(!previous && daily.scheduleStart && key<daily.scheduleStart && Array.isArray(source.ids) && source.ids.length===5 && new Set(source.ids).size===5 && old && old.length===5 && source.ids.every((id,i)=>id===old[i]) && old.every(id=>byId.has(id)))) fail(409,'Denní sada se změnila. Obnov stránku před uložením.','schedule_changed');
      return old.slice();
    }
    return expected.slice();
  }
  function merge(previous,incoming,{now=new Date(),importLegacy=false}={}) {
    if (!object(incoming) || incoming.version!==6 || !object(incoming.days)) fail(400,'Neplatný formát herního postupu.');
    if (Object.keys(incoming.days).length>3660) fail(413,'Historie obsahuje příliš mnoho dnů.');
    const prior=previous && previous.version===6 ? previous : {version:6,legacy:{progress:{}},days:{}};
    const imported = prior.legacy?.imported===true || Object.keys(prior.legacy?.progress||{}).length>0;
    const state={version:6,legacy:{progress:{},imported},days:{}};
    // Server-owned marker survives an earlier blank sync; a client cannot set or clear it.
    const legacySource = !imported && importLegacy && object(incoming.legacy?.progress) ? Object.fromEntries(Object.entries(incoming.legacy.progress).filter(([id,record])=>legacyIds.has(id) && (hasWork(record) || typeof record?.draft==='string' && record.draft.length>0))) : {};
    if (Object.keys(legacySource).length) state.legacy.imported=true;
    for (const id of new Set([...Object.keys(prior.legacy?.progress||{}),...Object.keys(legacySource)])) {
      if (!byId.has(id)) continue;
      state.legacy.progress[id]=mergeRound(prior.legacy?.progress?.[id],legacySource[id],byId.get(id),now,{legacy:true});
    }
    for (const key of [...new Set([...Object.keys(prior.days||{}),...Object.keys(incoming.days)])].sort()) {
      const old=prior.days?.[key],source=incoming.days[key];
      if (source!==undefined && !object(source)) fail(400,'Neplatný den v historii.');
      const ids=canonicalIDs(key,source,old,now),day={ids,selected:ids[0] || null,progress:{},seen:[],skipped:[]};
      for (const id of ids) {
        const a=old?.progress?.[id],b=source?.progress?.[id];
        if (a || b) day.progress[id]=mergeRound(a,b,byId.get(id),now,{legacy:importLegacy && Boolean(daily.scheduleStart && key<daily.scheduleStart)});
      }
      state.days[key]=day;
      daily.reconcileDay(state,key);
      let unlocked=true;
      for (const id of ids) {
        if(day.skipped.includes(id))continue;
        const a=old?.progress?.[id],b=source?.progress?.[id];
        if (!unlocked && hasWork(b) && !hasWork(a)) fail(400,'Nejprve dokonči předchozí výrok.');
        if (!['won','revealed'].includes(day.progress[id]?.status)) unlocked=false;
      }
      const oldSeen=Array.isArray(old?.seen)?old.seen:[], incomingSeen=Array.isArray(source?.seen)?source.seen:[];
      day.seen=[...new Set([...oldSeen,...incomingSeen.filter(id=>daily.canSelect(day,id)),...Object.keys(day.progress).filter(id=>hasWork(day.progress[id]))])].filter(id=>ids.includes(id));
      day.selected=selection(day,source?.selected || old?.selected);
    }
    return {state,stats:totals(state),scores:dayScores(state)};
  }
  function totals(state) {
    const value={solved:0,spent:0,attempts:0,revealed:0,points:100};
    for (const progress of [state.legacy?.progress||{},...Object.values(state.days||{}).map(day=>day.progress||{})]) {
      for (const record of Object.values(progress)) {
        value.solved+=Number(record.status==='won');value.revealed+=Number(record.status==='revealed');
        value.spent+=(record.hints||[]).reduce((sum,h)=>sum+(HINT_COST[h]||0),0);value.attempts+=(record.attempts||[]).length;
      }
    }
    value.points=100+200*value.solved-value.spent;
    return value;
  }
  function dayScores(state) {
    return Object.entries(state.days).flatMap(([date,day])=>{
      let solved=0,completed=0,attemptCount=0,spent=0;
      for (const id of day.ids) {const r=day.progress[id]||blank();solved+=Number(r.status==='won');completed+=Number(r.status!=='playing');attemptCount+=r.attempts.length;spent+=r.hints.reduce((sum,h)=>sum+HINT_COST[h],0);}
      return attemptCount || completed || spent ? [{date,points:solved*200-spent,solved,completed,attempts:attemptCount,spent}] : [];
    });
  }
  return {merge,totals,dayScores};
}
