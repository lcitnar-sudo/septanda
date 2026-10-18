/* Pět výroků za pražský kalendářní den; stav hráče patří tomuto prohlížeči. */
(function (root) {
  'use strict';
  const pool = root.SEPTANDA_PUZZLES, engine = root.SeptandaEngine;
  const byId = new Map(pool.map(p => [p.id, p]));
  const HINT_COST = {clue: 50, small: 30, previous: 60};
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
  const blankRound = () => ({attempts: [], hints: [], status: 'playing', draft: ''});
  const hasWork = r => !!r && !!(r.attempts?.length || r.hints?.length || r.draft || r.status === 'won' || r.status === 'revealed');
  function seenBefore(state, key) {
    const seen = new Set(Object.entries(state.legacy?.progress || {}).filter(([,r]) => hasWork(r)).map(([id]) => id));
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
    if (source.status === 'revealed') round.status = 'revealed';
    if (Array.isArray(source.hints)) round.hints = [...new Set(source.hints.filter(h => Object.hasOwn(HINT_COST, h)))];
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
    state.legacy.progress = cleanProgress(raw.legacy?.progress, pool.map(p => p.id));
    if (raw.legacy?.imported === true) state.legacy.imported = true;
    if (raw.days && typeof raw.days === 'object') {
      for (const [key, source] of Object.entries(raw.days)) {
        if (!validDay(key) || !source || typeof source !== 'object') continue;
        const ids = Array.isArray(source.ids) && (source.ids.length === 5 || source.ids.length === 0) && new Set(source.ids).size === source.ids.length && source.ids.every(id => byId.has(id)) ? source.ids.slice() : plan(key);
        const day = {ids, selected: source.selected, progress: cleanProgress(source.progress, ids), seen: Array.isArray(source.seen) ? source.seen : [], skipped: []};
        state.days[key] = day;
      }
      for (const key of Object.keys(state.days).sort()) reconcileDay(state, key);
    }
    return state;
  }
  function ensureDay(state, key) {
    const planned = plan(key);
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
    }
    t.points = 100 + t.solved * 200 - t.spent;
    return t;
  }
  root.SeptandaDaily = Object.freeze({scheduleStart: root.SEPTANDA_SCHEDULE?.start || null, legacyIDs: Object.freeze(root.SEPTANDA_SCHEDULE?.legacyIds?.slice() || pool.slice(0,9).map(p=>p.id)), dayKey, validDay, displayDate, plan, legacyPlan, blankRound, createState, sanitizeState, ensureDay, seenBefore, reconcileDay, markSeen, roundFor, nextId, canSelect, dayTotals, totals});
})(globalThis);
