/* Osobní trojice za pražský kalendářní den; vydané sady zůstávají uložené. */
(function (root) {
  'use strict';
  const pool = root.SEPTANDA_PUZZLES, engine = root.SeptandaEngine;
  const byId = new Map(pool.map(p => [p.id, p]));
  const HINT_COST = {clue: 50, small: 30, previous: 60};
  const PERSONAL_SIZE=3, SKIP_COST=200, SIZE_CHANGED_ON='2026-10-19', PAID_SKIP_START='2026-10-20';
  const validPersonalSize=(key,size)=>size===PERSONAL_SIZE || size===5 && key<=SIZE_CHANGED_ON;
  if (pool.length < 5) throw new Error('Denní sada potřebuje alespoň pět výroků.');
  function dayKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  function validDay(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    const date = new Date(key + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key;
  }
  function displayDate(key) {
    return new Intl.DateTimeFormat('cs-CZ', {timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'}).format(new Date(key + 'T12:00:00Z'));
  }
  function legacyPlan(key) {
    if (!validDay(key)) throw new Error('Neplatný den.');
    let seed = 2166136261;
    for (const char of 'septanda-daily-1:' + key) { seed ^= char.charCodeAt(0); seed = Math.imul(seed, 16777619); }
    const random = () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
      n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
    const legacyIds = root.SEPTANDA_SCHEDULE?.legacyIds;
    const ids = Array.isArray(legacyIds) ? legacyIds.slice() : pool.map(p => p.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    return ids.slice(0, 5);
  }
  function plan(key) {
    if (!validDay(key)) throw new Error('Neplatný den.');
    const schedule = root.SEPTANDA_SCHEDULE;
    if (!schedule || key < schedule.start) return legacyPlan(key);
    const difference = Math.floor((Date.parse(key + 'T12:00:00Z') - Date.parse(schedule.start + 'T12:00:00Z')) / 86400000);
    if (difference >= schedule.days.length) return [];
    const entry = schedule.days[difference];
    const ids = Array.isArray(entry) ? entry : entry.ids;
    if (!Array.isArray(ids) || ids.length !== 5 || ids.some(id => !byId.has(id))) throw new Error('Neúplná denní sada.');
    return ids.slice();
  }
  const personalStart = root.SEPTANDA_SCHEDULE?.personal?.start || null;
  const approvedIDs = Object.freeze(root.SEPTANDA_SCHEDULE?.personal?.approvedIds?.slice() || []);
  const accountSeed = id => 'account:' + String(id).toLowerCase().replace(/-/g,'');
  const validSeed = seed => typeof seed==='string' && /^(?:account:[a-f0-9]{32}|guest:[a-zA-Z0-9_-]{12,96})$/.test(seed);
  function bindPlayer(state,id=null) {
    state.assignmentVersion=1;
    if(id)state.assignmentSeed=accountSeed(id);
    else if(!validSeed(state.assignmentSeed) || !state.assignmentSeed.startsWith('guest:'))
      state.assignmentSeed='guest:'+(root.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2));
    return state;
  }
  function personalPlan(state,key,seed=state.assignmentSeed,size=PERSONAL_SIZE) {
    if(!validDay(key))throw new Error('Neplatný den.');
    if(!personalStart || key<personalStart || !validSeed(seed))return plan(key);
    const excluded=seenBefore(state,key);
    for(const [date,day] of Object.entries(state.days||{}))if(date<key)for(const id of day.ids||[])excluded.add(id);
    for(const id of state.knownIds||[])excluded.add(id);
    const candidates=approvedIDs.filter(id=>byId.has(id) && !excluded.has(id));
    if(!validPersonalSize(key,size) || candidates.length<size)return [];
    let randomState=2166136261;
    for(const char of 'septanda-personal-1:'+seed+':'+key){randomState^=char.charCodeAt(0);randomState=Math.imul(randomState,16777619);}
    const random=()=>{randomState=(randomState+0x6D2B79F5)|0;let n=Math.imul(randomState^randomState>>>15,1|randomState);n^=n+Math.imul(n^n>>>7,61|n);return((n^n>>>14)>>>0)/4294967296;};
    for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
    const chosen=[],usedWorks=new Set();
    const take=category=>{
      const id=candidates.find(id=>!chosen.includes(id) && (!category || byId.get(id).category===category) && (!['Veřejně volné verše','Úryvek z knihy'].includes(byId.get(id).category) || !usedWorks.has(byId.get(id).origin)));
      if(id){chosen.push(id);usedWorks.add(byId.get(id).origin);}
    };
    const categories=size===5?['Lidové přísloví','Historický výrok','Veřejně volné verše','Úryvek z knihy','Lidové přísloví']:['Lidové přísloví','Historický výrok',...(random()<0.5?['Veřejně volné verše','Úryvek z knihy']:['Úryvek z knihy','Veřejně volné verše'])];
    for(const category of categories)if(chosen.length<size)take(category);
    for(const id of candidates)if(chosen.length<size && !chosen.includes(id))chosen.push(id);
    for(let i=chosen.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[chosen[i],chosen[j]]=[chosen[j],chosen[i]];}
    return chosen;
  }
  const blankRound = () => ({attempts: [], hints: [], status: 'playing', draft: ''});
  const hasWork = r => !!r && !!(r.attempts?.length || r.hints?.length || r.draft || r.status === 'won' || r.status === 'revealed');
  function seenBefore(state, key) {
    const seen = new Set(Object.entries(state.legacy?.progress || {}).filter(([,r]) => hasWork(r)).map(([id]) => id));
    for(const id of state.knownIds||[])if(byId.has(id))seen.add(id);
    for (const [date, day] of Object.entries(state.days || {})) if (date < key) {
      for (const id of day.seen || []) seen.add(id);
      for (const [id, r] of Object.entries(day.progress || {})) if (hasWork(r)) seen.add(id);
    }
    return seen;
  }
  function reconcileDay(state, key) {
    const day = state.days[key], seen = seenBefore(state, key);
    // Rozpracované a dokončené záznamy zůstávají beze změny. Staré otázky se znovu neotvírají jako nové.
    day.skipped = day.ids.filter(id => seen.has(id) && !hasWork(day.progress[id]));
    day.seen = [...new Set((day.seen || []).filter(id => day.ids.includes(id)))];
    if (!canSelect(day, day.selected)) day.selected = nextId(day) || day.ids.find(id => !day.skipped.includes(id)) || null;
    return day;
  }
  function markSeen(day, id) {
    if (!id || !canSelect(day, id) || day.seen.includes(id)) return false;
    day.seen.push(id); return true;
  }
  function cleanRound(source, puzzle) {
    const round = blankRound();
    if (!source || typeof source !== 'object') return round;
    if (Array.isArray(source.attempts)) {
      for (const a of source.attempts) {
        if (!a || typeof a.text !== 'string' || a.text.length > 400 || !engine.normalize(a.text)) continue;
        const score = engine.evaluate(a.text, puzzle);
        round.attempts.push({...(typeof a.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(a.id) ? {id:a.id} : {}), text: a.text, time: typeof a.time === 'number' ? a.time : 0, score});
        if (score.accepted) round.status = 'won';
      }
    }
    // Already completed history survives later scoring corrections. The server still validates new wins.
    if (source.status === 'won' || source.status === 'revealed') round.status = source.status;
    if(round.status==='revealed' && source.paidSkip===true)round.paidSkip=true;
    if (Array.isArray(source.hints)) round.hints = [...new Set(source.hints.filter(h => Object.hasOwn(HINT_COST, h)))];
    if(round.hints.includes('clue'))round.hintLevel=Math.min(3,Math.max(1,Math.floor(Number(source.hintLevel)||1)));
    round.draft = typeof source.draft === 'string' ? source.draft.slice(0, 400) : '';
    return round;
  }
  function cleanProgress(source, ids) {
    const out = {};
    if (!source || typeof source !== 'object') return out;
    for (const id of ids) if (Object.hasOwn(source, id)) out[id] = cleanRound(source[id], byId.get(id));
    return out;
  }
  function createState(legacy) {
    return {version: 6, legacy: {progress: legacy?.version === 5 ? cleanProgress(legacy.progress, pool.map(p => p.id)) : {}}, days: {}};
  }
  function sanitizeState(raw) {
    const state = createState(null);
    if (!raw || raw.version !== 6) return null;
    if(raw.assignmentVersion===1 && validSeed(raw.assignmentSeed)){state.assignmentVersion=1;state.assignmentSeed=raw.assignmentSeed;}
    if(Array.isArray(raw.knownIds))state.knownIds=[...new Set(raw.knownIds.filter(id=>byId.has(id)))];
    state.legacy.progress = cleanProgress(raw.legacy?.progress, pool.map(p => p.id));
    if (raw.legacy?.imported === true) state.legacy.imported = true;
    if (raw.days && typeof raw.days === 'object') {
      for (const [key, source] of Object.entries(raw.days)) {
        if (!validDay(key) || !source || typeof source !== 'object') continue;
        const ids = Array.isArray(source.ids) && [0,3,5].includes(source.ids.length) && new Set(source.ids).size === source.ids.length && source.ids.every(id => byId.has(id)) ? source.ids.slice() : plan(key);
        const day = {ids, selected: source.selected, progress: cleanProgress(source.progress, ids), seen: Array.isArray(source.seen) ? source.seen : [], skipped: []};
        state.days[key] = day;
      }
      for (const key of Object.keys(state.days).sort()) reconcileDay(state, key);
    }
    return state;
  }
  function ensureDay(state, key, options={}) {
    if(options.personal)bindPlayer(state,options.playerId||null);
    const planned = state.assignmentVersion===1 ? personalPlan(state,key) : plan(key);
    if (!Object.hasOwn(state.days, key) || (!state.days[key].ids.length && planned.length)) {
      const ids = planned;
      state.days[key] = {ids, selected: ids[0] || null, progress: {}, seen: [], skipped: []};
    }
    return reconcileDay(state, key);
  }
  function roundFor(day, id = day.selected) {
    if (!day.ids.includes(id)) return null;
    return day.progress[id] || (day.progress[id] = blankRound());
  }
  function mergeForSync(remote,cached) {
    const result=sanitizeState(remote) || createState(null),local=sanitizeState(cached);
    if(!local)return {state:result,backupRequired:false};
    let backupRequired=false;
    const work=day=>Object.values(day?.progress||{}).some(hasWork);
    const mergeRound=(a,b)=>{
      if(!a)return b;if(!b)return a;
      const attempts=[],seen=new Set();
      for(const item of [...a.attempts,...b.attempts]){const id=item.id||item.text+'\0'+item.time;if(!seen.has(id)){seen.add(id);attempts.push(item);}}
      const r={...a,attempts,hints:[...new Set([...a.hints,...b.hints])],draft:b.draft||a.draft,
        status:['won','revealed'].includes(a.status)?a.status:b.status};
      if(r.hints.includes('clue'))r.hintLevel=Math.max(a.hintLevel||1,b.hintLevel||1);
      if(r.status==='revealed' && (['won','revealed'].includes(a.status)?a.paidSkip:b.paidSkip))r.paidSkip=true;
      return r;
    };
    result.knownIds=[...new Set([...(result.knownIds||[]),...(local.knownIds||[])])];
    for(const [id,r] of Object.entries(local.legacy.progress))result.legacy.progress[id]=mergeRound(result.legacy.progress[id],r);
    for(const [key,source] of Object.entries(local.days).sort()) {
      const target=result.days[key];
      if(!target){result.days[key]=source;continue;}
      if(target.ids.join()!==source.ids.join()) {
        const earlier=new Set(Object.entries(result.days).filter(([date])=>date<key).flatMap(([,day])=>day.ids));
        const mayKeep=work(source) && !work(target) && !target.seen.length && validPersonalSize(key,source.ids.length) && source.ids.every(id=>!earlier.has(id) && (approvedIDs.includes(id) || key<=personalStart));
        if(mayKeep){result.days[key]=source;continue;}
        if(work(source))backupRequired=true;
        result.knownIds=[...new Set([...result.knownIds,...source.seen.filter(id=>!target.ids.includes(id))])];
        continue;
      }
      target.seen=[...new Set([...target.seen,...source.seen])];
      for(const [id,r] of Object.entries(source.progress))target.progress[id]=mergeRound(target.progress[id],r);
      target.selected=source.selected||target.selected;
    }
    for(const key of Object.keys(result.days).sort())reconcileDay(result,key);
    return {state:result,backupRequired};
  }
  function nextId(day) { return day.ids.find(id => !day.skipped?.includes(id) && (!day.progress[id] || day.progress[id].status === 'playing')) || null; }
  function canSelect(day, id) {
    const index = day.ids.indexOf(id), next = nextId(day);
    return index >= 0 && !day.skipped?.includes(id) && (next === null || index <= day.ids.indexOf(next));
  }
  function dayTotals(day) {
    return day.ids.reduce((t, id) => {
      if (day.skipped?.includes(id)) { t.skipped++; t.completed++; return t; }
      const r = day.progress[id] || blankRound();
      t.solved += Number(r.status === 'won'); t.completed += Number(r.status !== 'playing');
      t.revealed += Number(r.status === 'revealed'); t.attempts += r.attempts.length;
      return t;
    }, {solved: 0, completed: 0, revealed: 0, attempts: 0, skipped: 0});
  }
  function totals(state) {
    const t = {solved: 0, spent: 0, attempts: 0, revealed: 0, points: 100};
    const rounds = [state.legacy.progress, ...Object.values(state.days).map(day => day.progress)];
    for (const progress of rounds) for (const r of Object.values(progress)) {
      t.solved += Number(r.status === 'won'); t.revealed += Number(r.status === 'revealed');
      t.spent += r.hints.reduce((sum, h) => sum + HINT_COST[h], 0); t.attempts += r.attempts.length;
      if(r.status==='revealed' && r.paidSkip===true)t.spent+=SKIP_COST;
    }
    t.points = 100 + t.solved * 200 - t.spent;
    return t;
  }
  root.SeptandaDaily = Object.freeze({personalSize:PERSONAL_SIZE,skipCost:SKIP_COST,sizeChangedOn:SIZE_CHANGED_ON,paidSkipStart:PAID_SKIP_START,validPersonalSize,personalStart,approvedIDs,accountSeed,validSeed,bindPlayer,personalPlan,mergeForSync,scheduleStart: root.SEPTANDA_SCHEDULE?.start || null, legacyIDs: Object.freeze(root.SEPTANDA_SCHEDULE?.legacyIds?.slice() || pool.slice(0,9).map(p=>p.id)), dayKey, validDay, displayDate, plan, legacyPlan, blankRound, createState, sanitizeState, ensureDay, seenBefore, reconcileDay, markSeen, roundFor, nextId, canSelect, dayTotals, totals});
})(globalThis);
