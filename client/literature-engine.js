/* Standalone literary trial. No production account or score dependencies. */
(function (root) {
  'use strict';
  const KEY = 'septanda.literature.trial.v1';
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ').trim();
  function distance(a, b) {
    const rows = Array.from({length:a.length + 1}, () => Array(b.length + 1).fill(0));
    for (let i=0;i<=a.length;i++) rows[i][0]=i;
    for (let j=0;j<=b.length;j++) rows[0][j]=j;
    for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++) {
      rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
      if(i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1]) rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
    }
    return rows[a.length][b.length];
  }
  function identify(value, authors) {
    const text=norm(value);
    if(!text || text.length>100 || /[^a-z\s'-]/.test(text)) return [];
    const exact=authors.filter(a=>a.aliases.some(alias=>norm(alias)===text));
    if(exact.length) return exact;
    return authors.filter(a=>a.aliases.some(alias=>{const n=norm(alias);return n.length>=5 && Math.abs(n.length-text.length)<=1 && distance(text,n)<=1;}));
  }
  function hash(text) {let n=2166136261;for(const c of text){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
  function day(now=new Date()) {
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function fresh(seed) {return {version:1,seed,days:{},rounds:{},saved:[]};}
  function parse(raw) {
    const s=JSON.parse(raw);
    if(s?.version!==1 || typeof s.seed!=='string' || !s.seed || !s.days || typeof s.days!=='object' || Array.isArray(s.days) || !s.rounds || typeof s.rounds!=='object' || Array.isArray(s.rounds) || !Array.isArray(s.saved)) throw Error('Neplatný deník');
    for(const [key,id] of Object.entries(s.days)) if(!/^\d{4}-\d{2}-\d{2}$/.test(key) || typeof id!=='string' || !/^L\d+$/.test(id)) throw Error('Neplatný den');
    for(const [id,r] of Object.entries(s.rounds)) {
      if(!/^L\d+$/.test(id) || !['playing','solved','revealed'].includes(r.status) || !Number.isInteger(r.hints) || r.hints<0 || r.hints>3 || typeof r.draft!=='string' || !Array.isArray(r.attempts) || r.attempts.some(a=>typeof a.text!=='string')) throw Error('Neplatný úryvek');
    }
    if(s.saved.some(id=>typeof id!=='string')) throw Error('Neplatné záložky');
    return s;
  }
  function open(state,id,date) {
    if(!/^L\d+$/.test(id)) throw Error('Neplatné ID');
    if(!Object.hasOwn(state.rounds,id)) state.rounds[id]={status:'playing',hints:0,draft:'',attempts:[],date};
    return state.rounds[id];
  }
  function assign(state,date,samples) {
    if(Object.hasOwn(state.days,date)) return samples.some(s=>s.id===state.days[date])?state.days[date]:null;
    const candidates=samples.filter(s=>!Object.hasOwn(state.rounds,s.id)).sort((a,b)=>hash(state.seed+'|'+date+'|'+a.id)-hash(state.seed+'|'+date+'|'+b.id)||a.id.localeCompare(b.id));
    if(!candidates.length) return null;
    const id=candidates[0].id;state.days[date]=id;open(state,id,date);return id;
  }
  function award(round) {return round?.status==='solved'?200-50*round.hints:0;}
  function hint(state,id,date) {const r=open(state,id,date);if(r.status==='playing') r.hints=Math.min(3,r.hints+1);return r;}
  function submit(state,sample,text,authors,date) {
    const r=open(state,sample.id,date);
    if(r.status!=='playing') return {kind:'finished'};
    const clean=String(text).trim().slice(0,100);
    if(!clean) return {kind:'empty'};
    const matches=identify(clean,authors);
    if(matches.length>1) return {kind:'ambiguous',matches};
    const person=matches[0];
    const result={text:clean,author:person?.id||null};
    r.attempts.push(result);r.draft=clean;
    if(person?.id===sample.author){r.status='solved';return {kind:'correct',award:award(r)};}
    return {kind:person?'known':'unknown',person};
  }
  function reveal(state,id,date) {const r=open(state,id,date);if(r.status==='playing')r.status='revealed';return r;}
  function compare(person,target) {
    const a=person.guidance||person, b=target.guidance||target;
    const periods=p=>p.periods||[p.period];
    return {environment:a.environment===b.environment,period:periods(a).some(p=>periods(b).includes(p)),prose:(a.focus||[]).includes('prose')&&(b.focus||[]).includes('prose')};
  }
  function choices(sample,seed,authors) {return sample.options.map(id=>authors.find(a=>a.id===id)).filter(Boolean).sort((a,b)=>hash(seed+'|'+sample.id+'|'+a.id)-hash(seed+'|'+sample.id+'|'+b.id));}
  root.SeptandaLiterature={KEY,norm,identify,hash,day,fresh,parse,open,assign,award,hint,submit,reveal,compare,choices};
})(globalThis);
