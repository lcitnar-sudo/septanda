/* The public three-question sample never reads or writes a player's account. */
(function (root) {
  'use strict';
  const Daily=root.SeptandaDaily, key='septanda.demo.authors.v1', date='2026-10-20';
  const ids=['descartes','poem-may','proverb-work'];
  // An evergreen sample, not another daily assignment or a second scoring wallet.
  root.SeptandaDaily=Object.freeze({...Daily,dayKey:()=>date});
  try {
    const stored=localStorage.getItem(key);
    const previous=stored && Daily.sanitizeState(JSON.parse(stored));
    if(previous?.days[date]?.ids.join(',')===ids.join(','))return;
    const state=Daily.createState(null);
    const day=Daily.ensureDay(state,date,{personal:true,mode:'author-v1'});
    day.ids=ids;day.selected=ids[0];day.mode='author-v1';day.progress={};day.seen=[];day.skipped=[];
    localStorage.setItem(key,JSON.stringify(state));
  } catch (_) { /* The game itself reports unavailable local storage. */ }
})(globalThis);
