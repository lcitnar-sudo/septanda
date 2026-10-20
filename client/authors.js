/* Explicit reviewed answers; quotation identities and the original text scorer stay immutable. */
(function(root){
 'use strict';
 const data=root.SEPTANDA_AUTHORS;if(!data)throw Error('Chybí schválené autorství.');
 const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
 const entries=data.entries,profiles=data.profiles;
 const get=p=>entries[typeof p==='string'?p:p.id];
 const profile=p=>profiles[get(p)?.profile];
 function distance(a,b){let prev=null,row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++){next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+Number(a[i-1]!==b[j-1]));if(prev&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])next[j]=Math.min(next[j],prev[j-2]+1);}prev=row;row=next;}return row[b.length];}
 function identify(text){
  const n=norm(text);if(!n||n.length>120)return null;
  const exact=Object.entries(profiles).filter(([,v])=>v.aliases.some(a=>norm(a)===n)).map(([id])=>id);
  if(exact.length)return exact.length===1?{id:exact[0],reason:'exact'}:null;
  if(/\b(?:ne|neni|nebyl|nevim|nezn[a-z]*|nebo|nepatri)\b/.test(n))return null;
  const candidates=Object.entries(profiles).filter(([id,v])=>id!=='folk'&&v.aliases.some(a=>{const r=norm(a);return Math.min(r.length,n.length)>=5&&r.split(' ').length===n.split(' ').length&&distance(n,r)===1;})).map(([id])=>id);
  return candidates.length===1?{id:candidates[0],reason:'typo'}:null;
 }
 function relatedUse(text,puzzle){
  const n=norm(text);return get(puzzle)?.relatedUses?.find(use=>use.aliases.some(a=>norm(a)===n))||null;
 }
 function evaluate(text,puzzle){
  const entry=get(puzzle),p=profile(puzzle),n=norm(text);let accepted=false,reason='unknown';
  if(entry&&p&&n&&n.length<=120){
   const use=relatedUse(text,puzzle),person=identify(text);
   if(use){accepted=true;reason='related-use';}
   else if(person){accepted=person.id===entry.profile;reason=accepted?person.reason:'other-person';}
  }
  return {accepted,total:accepted?100:0,words:0,meaning:0,conflict:false,reason};
 }
 function proximity(text,puzzle){
  const who=identify(text),target=profile(puzzle)?.guidance,guess=profiles[who?.id]?.guidance,vocab=data.guidance;
  if(!target||!guess||!vocab)return null;
  const common=(a,b)=>a.filter(key=>b.includes(key));
  const domain=common(guess.domains,target.domains),focus=common(guess.focus,target.focus);
  const periods=common(guess.periods,target.periods),environment=guess.environment===target.environment;
  const eraOrder=list=>list.map(key=>vocab.periods[key].order);
  const go=eraOrder(guess.periods),to=eraOrder(target.periods);
  const direction=Math.max(...go)<Math.min(...to)?'Hledej později.':Math.min(...go)>Math.max(...to)?'Hledej dříve.':'Období se částečně překrývají.';
  const traits=[
   {key:'domain',label:'Obor',match:!!domain.length,text:domain.length?domain.map(k=>vocab.domains[k]).join(', ')+' — sedí':'Zkus jiný obor.'},
   {key:'focus',label:'Zaměření',match:!!focus.length,text:focus.length?focus.map(k=>vocab.focus[k]).join(', ')+' — sedí':'Zkus jiné zaměření tvorby či činnosti.'},
   {key:'environment',label:'Prostředí',match:environment,text:environment?vocab.environments[target.environment]+' — sedí':'Hledej v jiném kulturním prostředí.'},
   {key:'period',label:'Období',match:!!periods.length,text:periods.length?periods.map(k=>vocab.periods[k].label).join(', ')+' — sedí':direction}
  ];
  return {person:profiles[who.id].name,id:who.id,traits,matches:traits.filter(t=>t.match).length};
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
 function feedback(text,puzzle,accepted,previousText){
  const result=evaluate(text,puzzle),use=relatedUse(text,puzzle),near=!accepted?proximity(text,puzzle):null,previous=near&&previousText?proximity(previousText,puzzle):null;
  let comparison='';
  if(near&&previous&&near.id!==previous.id){
   const change=near.matches-previous.matches;
   comparison=change>0?`Oproti tipu „${previous.person}“ sedí více vodítek. Jdeš blíž.`:change<0?`Oproti tipu „${previous.person}“ sedí méně vodítek. Předchozí směr byl bližší.`:`S tipem „${previous.person}“ máš shodný počet vodítek. Podle nich jsou oba tipy stejně blízko.`;
  }
  return{accepted,relatedUse:accepted&&!!use,matched:[],traits:near?.traits||[],comparison,
   title:accepted?(use?'Souvislost odhalena.':'Původ odhalen.'):near?(near.matches>=3?'Jsi blízko. Zkus jiné jméno.':near.matches?'Něco už sedí. Zkus jiné jméno.':'Zkus jiné jméno a jiný směr.'):'Zkus jiné jméno nebo stopu.',
   detail:accepted?(use?use.explanation:'Teď se podívej na příběh těchto slov.'):near?`Tip „${near.person}“: shoda v ${near.matches} ze 4 vodítek. Autor je ale jiný.`:identify(text)?.id==='folk'?'Tentokrát hledáme konkrétní osobnost. Zkus její jméno.':result.reason==='other-person'?'Této osobnosti uvedená slova nepatří. U této otázky srovnání osobností nenabízíme.':'Tento tip neumíme porovnat s osobností. Zkus celé jméno či známé příjmení, nebo si vezmi stopu.',
   caution:near?'Shodné obory, zaměření, prostředí a období ještě nepotvrzují autora. Období označuje tvorbu či tradici, ne přesný rok narození.':'U literárních textů hledáme autora díla, pokud otázka výslovně nežádá mluvčího. Pokud autor není známý, napiš „autor neznámý“, „lidové rčení“ nebo „pořekadlo“.'};
 }
 root.SeptandaAuthors=Object.freeze({mode:data.mode,start:data.start,ids:Object.freeze(Object.keys(entries)),get,profile,evaluate,options,feedback,proximity,identify,relatedUse,normalize:norm});
})(globalThis);
