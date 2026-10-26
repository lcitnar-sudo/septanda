(function(root){
  'use strict';
  const KEY='septanda.emoji.v1', validID=id=>/^E\d{2,5}$/.test(id), validDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(d);
  const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  function distance(a,b){
    const d=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
    for(let i=0;i<=a.length;i++)d[i][0]=i;for(let j=0;j<=b.length;j++)d[0][j]=j;
    for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
      d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);
    }return d[a.length][b.length];
  }
  function hash(text){let n=2166136261;for(const c of text){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
  function day(now=new Date()){
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
    return p.year+'-'+p.month+'-'+p.day;
  }
  const fresh=seed=>({version:1,seed,days:{},rounds:{}});
  function parse(raw){
    const s=JSON.parse(raw);
    if(s?.version!==1||typeof s.seed!=='string'||!s.seed||!s.days||Array.isArray(s.days)||typeof s.days!=='object'||!s.rounds||Array.isArray(s.rounds)||typeof s.rounds!=='object')throw Error('Neplatný bonusový deník.');
    for(const [d,id] of Object.entries(s.days))if(!validDay(d)||!validID(id))throw Error('Neplatný den bonusu.');
    for(const [id,r] of Object.entries(s.rounds))if(!validID(id)||!['playing','solved','revealed'].includes(r.status)||!Number.isInteger(r.hints)||r.hints<0||r.hints>2||!validDay(r.date)||typeof r.draft!=='string'||r.draft.length>150||!Array.isArray(r.attempts)||r.attempts.length>500||r.attempts.some(a=>typeof a.text!=='string'||a.text.length>150))throw Error('Neplatný výsledek bonusu.');
    return s;
  }
  function open(s,id,date){if(!validID(id)||!validDay(date))throw Error('Neplatná hádanka.');if(!Object.hasOwn(s.rounds,id))s.rounds[id]={status:'playing',hints:0,draft:'',attempts:[],date};return s.rounds[id];}
  function assign(s,date,items){
    if(Object.hasOwn(s.days,date))return items.some(p=>p.id===s.days[date])?s.days[date]:null;
    const unused=items.filter(p=>!Object.hasOwn(s.rounds,p.id)).sort((a,b)=>hash(s.seed+'|'+date+'|'+a.id)-hash(s.seed+'|'+date+'|'+b.id)||a.id.localeCompare(b.id));
    if(!unused.length)return null;const id=unused[0].id;s.days[date]=id;open(s,id,date);return id;
  }
  function identify(text,items){
    const n=norm(text);if(!n||String(text).length>150)return [];
    const exact=items.filter(p=>[p.title,...p.aliases].some(a=>norm(a)===n));if(exact.length)return exact;
    return items.filter(p=>[p.title,...p.aliases].some(a=>{const v=norm(a);return v.length>=6&&n.length>=6&&Math.abs(v.length-n.length)<=1&&distance(n,v)<=1;}));
  }
  function answer(s,item,text,items,date){
    const r=open(s,item.id,date);if(r.status!=='playing')return {kind:'finished'};
    const clean=String(text).trim().slice(0,150);if(!norm(clean))return {kind:'empty'};
    if(r.attempts.length>=500)throw Error('U této hádanky už je mnoho tipů. Vezmi si stopu nebo odhal knihu.');
    const matches=identify(clean,items),correct=matches.length===1&&matches[0].id===item.id;
    r.attempts.push({text:clean,correct});r.draft=clean;if(correct)r.status='solved';return {kind:correct?'correct':'try-again'};
  }
  function hint(s,id,date){const r=open(s,id,date);if(r.status==='playing')r.hints=Math.min(2,r.hints+1);return r;}
  function reveal(s,id,date){const r=open(s,id,date);if(r.status==='playing')r.status='revealed';return r;}
  root.SeptandaEmojiEngine={KEY,norm,day,fresh,parse,open,assign,identify,answer,hint,reveal};
})(globalThis);
