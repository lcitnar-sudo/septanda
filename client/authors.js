/* Explicit reviewed answers; quotation identities and the original text scorer stay immutable. */
(function(root){
 'use strict';
 const data=root.SEPTANDA_AUTHORS;if(!data)throw Error('Chybí schválené autorství.');
 const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
 const entries=data.entries,profiles=data.profiles;
 const get=p=>entries[typeof p==='string'?p:p.id];
 const profile=p=>profiles[get(p)?.profile];
 function distance(a,b){let prev=null,row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++){next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+Number(a[i-1]!==b[j-1]));if(prev&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])next[j]=Math.min(next[j],prev[j-2]+1);}prev=row;row=next;}return row[b.length];}
 function evaluate(text,puzzle){
  const entry=get(puzzle),p=profile(puzzle),n=norm(text);let accepted=false,reason='unknown';
  if(entry&&p&&n&&n.length<=120){
   const exact=Object.entries(profiles).filter(([,v])=>v.aliases.some(a=>norm(a)===n)).map(([id])=>id);
   if(exact.length){accepted=exact.length===1&&exact[0]===entry.profile;reason=accepted?'exact':'other-person';}
   else if(entry.profile!=='folk'&&!/\b(?:ne|neni|nebyl|nevim|nezn[a-z]*|nebo|nepatri)\b/.test(n)){
    // A single edit is allowed only in a complete reviewed alias, never a fragment or a list of guesses.
    const candidates=Object.entries(profiles).filter(([id,v])=>id!=='folk'&&v.aliases.some(a=>{const r=norm(a);return Math.min(r.length,n.length)>=5&&r.split(' ').length===n.split(' ').length&&distance(n,r)===1;})).map(([id])=>id);
    accepted=candidates.length===1&&candidates[0]===entry.profile;reason=accepted?'typo':'unknown';
   }
  }
  return {accepted,total:accepted?100:0,words:0,meaning:0,conflict:false,reason};
 }
 function options(puzzle){
  const entry=get(puzzle),correct=entry.profile,group=profiles[correct].group;
  let seed=2166136261;for(const ch of puzzle.id){seed^=ch.charCodeAt(0);seed=Math.imul(seed,16777619);}
  const random=()=>{seed=(seed+0x6d2b79f5)|0;let x=Math.imul(seed^seed>>>15,1|seed);x^=x+Math.imul(x^x>>>7,61|x);return((x^x>>>14)>>>0)/4294967296;};
  const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const others=shuffle(Object.keys(profiles).filter(k=>k!=='folk'&&k!==correct));
  others.sort((a,b)=>Number(profiles[b].group===group)-Number(profiles[a].group===group));
  const selected=correct==='folk'?['folk',...others.slice(0,3)]:[correct,'folk',...others.slice(0,2)];
  return shuffle(selected).map(id=>({id,label:profiles[id].name}));
 }
 function feedback(text,puzzle,accepted){
  const result=evaluate(text,puzzle);return{accepted,matched:[],title:accepted?'Původ odhalen.':'Zkus jiné jméno nebo stopu.',detail:accepted?'Teď se podívej na příběh těchto slov.':result.reason==='other-person'?'Této osobnosti uvedená slova nepatří.':'Hledáme konkrétní jméno, nebo lidový původ. Křestní jméno samotné obvykle nestačí.',caution:'U literárních textů hledáme autora díla, pokud otázka výslovně nežádá mluvčího. Můžeš napsat také „lidové rčení“.'};
 }
 root.SeptandaAuthors=Object.freeze({mode:data.mode,start:data.start,ids:Object.freeze(Object.keys(entries)),get,profile,evaluate,options,feedback,normalize:norm});
})(globalThis);
