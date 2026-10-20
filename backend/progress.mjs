import {createHash} from 'node:crypto';
import {fail} from './http.mjs';
export const HINT_COST = Object.freeze({clue:50,small:30,previous:60});
const object = value => value && typeof value==='object' && !Array.isArray(value);
const digest = value => createHash('sha256').update(value).digest('hex');
const hasWork = round => Boolean(round && (round.attempts?.length || round.hints?.length || round.chainLevel || round.status==='revealed'));
const blank = () => ({attempts:[],hints:[],status:'playing',draft:''});

// The game module is injected so the exact same catalog/calendar/scorer is used by tests and production.
export function createProgressTools({puzzles,engine,daily}) {
  const byId = new Map(puzzles.map(puzzle=>[puzzle.id,puzzle]));
  const legacyIds = new Set(daily.legacyIDs || ['caesar-victory','proverb-pit','poem-may','caesar-dice','proverb-work','poem-noon','descartes','proverb-measure','poem-bouquet']);
  function attempts(source,puzzle,now,mode='classic') {
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
      out.push({id,text:item.text,time,score:engine.evaluate(item.text,puzzle,mode)});
    }
    return out;
  }
  function round(source,puzzle,now,{legacy=false,mode='classic'}={}) {
    if (!object(source)) return blank();
    const out = blank();
    out.attempts = attempts(source.attempts,puzzle,now,mode);
    const allowed = legacy ? Object.keys(HINT_COST) : ['clue'];
    if (source.hints!==undefined && !Array.isArray(source.hints)) fail(400,'Neplatné nápovědy.');
    out.hints = [...new Set((source.hints||[]).filter(h=>allowed.includes(h)))];
    if(out.hints.includes('clue'))out.hintLevel=Math.min(3,Math.max(1,Math.floor(Number(source.hintLevel)||1)));
    out.status = source.status==='revealed' ? 'revealed' : out.attempts.some(attempt=>attempt.score.accepted) ? 'won' : 'playing';
    if(out.status==='revealed' && source.paidSkip===true){out.paidSkip=true;out.skipCharge=daily.skipCharge(source);}
    if(mode==='author-v1' && source.chainLevel)fail(400,'V nové hře použij stopy k původu výroku.');
    if(source.chainLevel!==undefined && (!Number.isInteger(source.chainLevel) || source.chainLevel<0 || source.chainLevel>puzzle.chain.length-1))fail(400,'Neplatný krok tiché pošty.');
    if(source.chainLevel)out.chainLevel=source.chainLevel;
    out.draft = typeof source.draft==='string' ? source.draft.slice(0,400) : '';
    return out;
  }
  function mergeRound(previous,incoming,puzzle,now,options={}) {
    // Existing records already passed this validator. Regrade scores without making a revealed result a win.
    const a=round(previous,puzzle,now,{legacy:true,mode:options.mode}),b=round(incoming,puzzle,now,options),result=blank();
    const seen=new Set();
    for (const item of [...a.attempts,...b.attempts]) if (!seen.has(item.id)) { seen.add(item.id); result.attempts.push(item); }
    if (result.attempts.length>500) fail(413,'U jedné hádanky lze uložit nejvýše 500 tipů.');
    result.hints=[...new Set([...a.hints,...b.hints])];
    if(result.hints.includes('clue'))result.hintLevel=Math.max(a.hintLevel||1,b.hintLevel||1);
    result.status = ['won','revealed'].includes(previous?.status) ? previous.status : b.status==='revealed' ? 'revealed' : result.attempts.some(attempt=>attempt.score.accepted) ? 'won' : 'playing';
    const terminal=['won','revealed'].includes(previous?.status);
    const level=terminal ? (a.chainLevel||0) : Math.max(a.chainLevel||0,b.chainLevel||0);
    if(level)result.chainLevel=level;
    if(result.status==='revealed' && (terminal?previous.paidSkip:b.paidSkip || options.requirePaidSkip)){
      result.paidSkip=true;result.skipCharge=terminal?daily.skipCharge(previous):options.legacy?daily.skipCharge(b):daily.skipCost;
    }
    result.draft=object(incoming) ? b.draft : a.draft;
    return result;
  }
  function selection(day,preferred) {
    return daily.canSelect(day,preferred) ? preferred : daily.nextId(day) || daily.playIds(day).find(id=>!day.skipped?.includes(id)) || null;
  }
  function canonicalIDs(key,source,previous,now,state,{personal=false,incoming,importLegacy=false,mode='classic'}={}) {
    if (!daily.validDay(key) || key>daily.dayKey(now)) fail(400,'Nelze ukládat neplatný nebo budoucí den.');
    const published=daily.plan(key);
    const planned=personal && key>=daily.personalStart ? daily.personalPlan(state,key,state.assignmentSeed,3,mode) : published;
    if (!Array.isArray(planned) || ![0,3,5].includes(planned.length) || new Set(planned).size!==planned.length || !planned.every(id=>byId.has(id))) fail(503,'Denní sada není dostupná.');
    // A previously stored day keeps its published IDs even after a catalog update.
    const expected=Array.isArray(previous?.ids) && ([3,5].includes(previous.ids.length) || previous.ids.length===0 && planned.length===0) && previous.ids.every(id=>byId.has(id)) ? previous.ids : planned;
    if (source?.ids && (!Array.isArray(source.ids) || source.ids.length!==expected.length || source.ids.some((id,i)=>id!==expected[i]))) {
      // A legitimate offline device may already have played before an untouched
      // server reservation was made. Keep its five approved, non-repeated IDs;
      // once any exposure/work is stored the assignment is immutable.
      const unused=!previous || !(previous.seen?.length) && !Object.values(previous.progress||{}).some(r=>hasWork(r)||r.draft);
      const earlier=new Set(Object.entries(state.days).filter(([date])=>date<key).flatMap(([,day])=>day.ids));
      if(personal && unused && incoming?.assignmentSeed===state.assignmentSeed && Object.values(source.progress||{}).some(r=>hasWork(r)||r.draft) && Array.isArray(source.ids) && daily.validPersonalSize(key,source.ids.length) && new Set(source.ids).size===source.ids.length && (mode!=='author-v1'||daily.validAuthorIDs(source.ids)) && source.ids.every(id=>daily.approvedIDs.includes(id) && !earlier.has(id)))return source.ids.slice();
      if(personal && importLegacy && daily.validSeed(incoming?.assignmentSeed) && incoming.assignmentSeed.startsWith('guest:') && (!previous || !Object.values(previous.progress||{}).some(r=>hasWork(r)||r.draft))) {
        const imported=daily.personalPlan(incoming,key,incoming.assignmentSeed,source.ids?.length,mode);
        const earlier=new Set(Object.entries(state.days).filter(([date])=>date<key).flatMap(([,day])=>day.ids));
        if(Array.isArray(source.ids) && source.ids.length===imported.length && source.ids.every((id,i)=>id===imported[i] && !earlier.has(id))) {
          state.knownIds=[...new Set([...(state.knownIds||[]),...(previous?.seen||[])])];
          return imported;
        }
      }
      if(personal && key<=daily.personalStart && (!previous || !(previous.seen?.length) && !Object.values(previous.progress||{}).some(r=>hasWork(r)||r.draft)) && Array.isArray(source.ids) && source.ids.length===published.length && source.ids.every((id,i)=>id===published[i]))return published;
      if(personal && !previous && incoming?.assignmentVersion!==1 && key<=daily.personalStart && Array.isArray(source.ids) && source.ids.length===published.length && source.ids.every((id,i)=>id===published[i]))return published;
      const old = typeof daily.legacyPlan==='function' ? daily.legacyPlan(key) : null;
      if (!(!previous && daily.scheduleStart && key<daily.scheduleStart && Array.isArray(source.ids) && source.ids.length===5 && new Set(source.ids).size===5 && old && old.length===5 && source.ids.every((id,i)=>id===old[i]) && old.every(id=>byId.has(id)))) fail(409,'Denní sada se změnila. Obnov stránku před uložením.','schedule_changed');
      return old.slice();
    }
    return expected.slice();
  }
  function mergeBase(previous,incoming,{now=new Date(),importLegacy=false,playerId=null}={}) {
    if (!object(incoming) || incoming.version!==6 || !object(incoming.days)) fail(400,'Neplatný formát herního postupu.');
    if (Object.keys(incoming.days).length>3660) fail(413,'Historie obsahuje příliš mnoho dnů.');
    const prior=previous && previous.version===6 ? previous : {version:6,legacy:{progress:{}},days:{}};
    const imported = prior.legacy?.imported===true || Object.keys(prior.legacy?.progress||{}).length>0;
    const state={version:6,legacy:{progress:{},imported},days:{},...(prior.archivedDays?{archivedDays:JSON.parse(JSON.stringify(prior.archivedDays))}:{})};
    let newPaidActions=0;
    const personal=Boolean(daily.personalStart && ((playerId && daily.dayKey(now)>=daily.personalStart) || incoming.assignmentVersion===1));
    if(personal) {
      state.assignmentVersion=1;
      state.assignmentSeed=playerId ? daily.accountSeed(playerId) : daily.validSeed(prior.assignmentSeed) ? prior.assignmentSeed : incoming.assignmentSeed;
      if(!daily.validSeed(state.assignmentSeed))fail(400,'Chybí identita osobní sady.');
      state.knownIds=[...new Set([...(Array.isArray(prior.knownIds)?prior.knownIds:[]),...(Array.isArray(incoming.knownIds)?incoming.knownIds:[])].filter(id=>byId.has(id)))];
    }
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
      if(!daily.validDay(key) || key>daily.dayKey(now))fail(400,'Nelze ukládat neplatný nebo budoucí den.');
      if(source?.mode!==undefined && source.mode!=='author-v1')fail(400,'Neplatný typ hry.');
      const unused=old && !old.seen?.length && !Object.values(old.progress||{}).some(r=>hasWork(r)||r.draft);
      const offlineClassic=unused && key<=daily.authorStart && source && daily.modeFor(source)==='classic' && Object.values(source.progress||{}).some(r=>hasWork(r)||r.draft) && (incoming.assignmentSeed===state.assignmentSeed || importLegacy && incoming.assignmentSeed?.startsWith('guest:'));
      const mode=offlineClassic?'classic':old?daily.modeFor(old):!personal?'classic':source?.mode==='author-v1'?'author-v1':key<=daily.authorStart?'classic':daily.newMode(key);
      if(mode==='author-v1' && key<daily.authorStart)fail(400,'Tento režim v daný den ještě nebyl vydán.');
      if(source && daily.modeFor(source)!==mode)fail(409,'Hra se aktualizovala. Obnov stránku; uložená historie zůstává zachovaná.','game_updated');
      const ids=canonicalIDs(key,source,old,now,state,{personal,incoming,importLegacy,mode}),day={ids,...(mode==='author-v1'?{mode}:{}),selected:ids[0] || null,progress:{},seen:[],skipped:[]};
      for (const id of ids) {
        const a=old?.progress?.[id],b=source?.progress?.[id];
        if(personal && key>=daily.personalStart && daily.seenBefore(state,key).has(id) && hasWork(b) && !hasWork(a))fail(409,'Tento výrok už máš v dřívější historii. Místní postup zůstává uložený.','known_puzzle');
        if (a || b) day.progress[id]=mergeRound(a,b,byId.get(id),now,{legacy:importLegacy && Boolean(daily.scheduleStart && key<daily.scheduleStart),mode,requirePaidSkip:ids.length===3 || key>=daily.paidSkipStart});
        if(day.progress[id]?.paidSkip && !['won','revealed'].includes(a?.status))newPaidActions++;
        if((day.progress[id]?.chainLevel||0)>(a?.chainLevel||0) || (day.progress[id]?.hints?.length||0)>(a?.hints?.length||0))newPaidActions++;
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
    const stats=totals(state);
    if(newPaidActions && stats.points<0)fail(409,'Na tento krok nemáš dost bodů. Předání stojí 50 bodů, přeskočení 100 bodů.','insufficient_points');
    return {state,stats,scores:dayScores(state)};
  }
  // Archived classic records remain server-validated. Clients cannot mint an
  // archive, replace its IDs, erase its costs or resubmit it for another reward.
  function mergeArchive(old,source,key,now) {
    if(!object(source)||daily.modeFor(source)!=='classic'||!Array.isArray(source.ids)||source.ids.join()!==old.ids.join())fail(409,'Archiv původní hry se neshoduje s uloženým postupem.','archive_changed');
    const day={...old,progress:{},seen:[...(old.seen||[])],skipped:[...(old.skipped||[])]};
    let unlocked=true;
    for(const id of old.ids){
      const a=old.progress?.[id],b=source.progress?.[id];
      if(!unlocked && hasWork(b) && !hasWork(a))fail(400,'Nejprve dokonči předchozí výrok.');
      if(a||b){day.progress[id]=mergeRound(a,b,byId.get(id),now,{mode:'classic',requirePaidSkip:old.ids.length===3||key>=daily.paidSkipStart});day.progress[id].draft=b?.draft||a?.draft||'';}
      if(!day.skipped.includes(id)&&!['won','revealed'].includes(day.progress[id]?.status))unlocked=false;
    }
    day.seen=[...new Set([...day.seen,...(Array.isArray(source.seen)?source.seen:[]).filter(id=>daily.canSelect(day,id))])].filter(id=>day.ids.includes(id));
    day.selected=selection(day,source.selected||old.selected);return day;
  }
  function merge(previous,incoming,options={}) {
    const {now=new Date(),importLegacy=false,upgradeActive=false}=options;
    if(!object(incoming)||incoming.version!==6||!object(incoming.days))return mergeBase(previous,incoming,options);
    const copy=x=>JSON.parse(JSON.stringify(x)),today=daily.dayKey(now);
    let prior=previous?.version===6?copy(previous):daily.createState(null),source=copy(incoming);
    if(source.archivedDays!==undefined && (!object(source.archivedDays)||Object.keys(source.archivedDays).length>3660))fail(400,'Neplatný archiv původní hry.');
    // A new client may have already archived its cached classic day. First
    // validate that old work under its original rules, then validate new play.
    if(upgradeActive && daily.modeFor(prior.days?.[today])==='classic' && prior.days?.[today] && source.days[today]?.mode==='author-v1' && source.archivedDays?.[today]) {
      const classic=copy(source);classic.days[today]=classic.archivedDays[today];delete classic.archivedDays[today];
      const validated=merge(prior,classic,{...options,upgradeActive:false});
      daily.upgradeCurrentDay(validated.state,today);
      return merge(validated.state,source,options);
    }
    const beforeSpent=totals(prior).spent;
    const updates=Object.entries(source.archivedDays||{});
    for(const [key,day] of Object.entries(source.days))if(prior.archivedDays?.[key] && daily.modeFor(day)==='classic'){
      updates.push([key,day]);delete source.days[key];
    }
    for(const [key,record] of updates){
      if(!daily.validDay(key)||key>today)fail(400,'Neplatné datum archivu.');
      let old=prior.archivedDays?.[key],offlineAccount=false;
      if(!old){
        const unused=prior.days[key]?.mode==='author-v1' && !prior.days[key].seen?.length && !Object.values(prior.days[key].progress||{}).some(r=>hasWork(r)||r.draft);
        const guestImport=importLegacy && daily.validSeed(source.assignmentSeed) && source.assignmentSeed.startsWith('guest:');
        offlineAccount=upgradeActive && unused && key<=daily.authorStart && source.assignmentSeed===prior.assignmentSeed && Object.values(record?.progress||{}).some(r=>hasWork(r)||r.draft);
        if((!guestImport&&!offlineAccount) || key!==today || !Array.isArray(record?.ids))fail(409,'Tento archiv není součástí uloženého účtu.','archive_changed');
        const candidate=copy(source);delete candidate.archivedDays[key];candidate.days[key]=record;
        const expected=daily.personalPlan(candidate,key,source.assignmentSeed,record.ids.length,'classic');
        const admissible=offlineAccount ? daily.validPersonalSize(key,record.ids.length) && new Set(record.ids).size===record.ids.length && record.ids.every(id=>daily.approvedIDs.includes(id)) : record.ids.join()===expected.join();
        const known=new Set([...Object.entries(prior.days||{}).filter(([date])=>!unused || date!==key).map(([,d])=>d),...Object.values(prior.archivedDays||{})].flatMap(d=>d.ids));
        if(!admissible || record.ids.some(id=>known.has(id)))fail(409,'Místní archiv se překrývá s již přidělenými výroky. Stáhni si zálohu místního postupu.','known_puzzle');
        old={ids:record.ids.slice(),progress:{},seen:[],skipped:[],selected:record.ids[0]||null};
      }
      prior.archivedDays=prior.archivedDays||{};prior.archivedDays[key]=mergeArchive(old,record,key,now);
      if(offlineAccount){
        delete prior.days[key];daily.ensureDay(prior,key,{mode:'author-v1'});
        if(!Object.values(source.days[key]?.progress||{}).some(r=>hasWork(r)||r.draft))delete source.days[key];
      }
    }
    const result=mergeBase(prior,source,options);
    if(upgradeActive)daily.upgradeCurrentDay(result.state,today);
    result.stats=totals(result.state);result.scores=dayScores(result.state);
    if(totals(prior).spent>beforeSpent && result.stats.points<0)fail(409,'Na tento krok nemáš dost bodů.','insufficient_points');
    return result;
  }
  function totals(state) {
    const value={solved:0,spent:0,attempts:0,revealed:0,points:100};
    for (const progress of [state.legacy?.progress||{},...Object.values(state.days||{}).map(day=>day.progress||{}),...Object.values(state.archivedDays||{}).map(day=>day.progress||{})]) {
      for (const record of Object.values(progress)) {
        value.solved+=Number(record.status==='won');value.revealed+=Number(record.status==='revealed');
        value.spent+=(record.hints||[]).reduce((sum,h)=>sum+(HINT_COST[h]||0),0);value.attempts+=(record.attempts||[]).length;
        value.spent+=(record.chainLevel||0)*daily.chainCost;
        if(record.status==='revealed' && record.paidSkip===true)value.spent+=daily.skipCharge(record);
      }
    }
    value.points=100+200*value.solved-value.spent;
    return value;
  }
  function dayScores(state) {
    const scores=new Map();
    for(const [date,day] of [...Object.entries(state.days||{}),...Object.entries(state.archivedDays||{})]) {
      const row=scores.get(date)||{date,points:0,solved:0,completed:0,attempts:0,spent:0};
      for(const id of day.ids){const r=day.progress[id]||blank();row.solved+=Number(r.status==='won');row.completed+=Number(r.status!=='playing');row.attempts+=r.attempts.length;row.spent+=r.hints.reduce((sum,h)=>sum+HINT_COST[h],0);row.spent+=(r.chainLevel||0)*daily.chainCost;if(r.status==='revealed'&&r.paidSkip===true)row.spent+=daily.skipCharge(r);}
      row.points=row.solved*200-row.spent;scores.set(date,row);
    }
    return [...scores.values()].filter(r=>r.attempts||r.completed||r.spent);
  }
  return {merge,totals,dayScores};
}
