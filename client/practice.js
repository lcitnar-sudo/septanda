/* Isolated voluntary replay: its key never overlaps daily or account storage. */
(function(root){
 'use strict';
 const base=root.SeptandaDaily,Authors=root.SeptandaAuthors,requested=new URLSearchParams(location.search).get('id'),id=Authors.get(requested)?requested:Authors.ids[0],date='2026-10-21';
 if(requested&&!Authors.get(requested)){document.documentElement.classList.add('practice-unavailable');const banner=document.querySelector('.practice-banner');if(banner){banner.querySelector('h2').textContent='Tento výrok zatím není k procvičení dostupný.';banner.querySelector('p:not(.eyebrow)').textContent='Odkaz může patřit ke staršímu archivu. Vrať se do hry nebo vyber jiný dokončený výrok v Deníku objevů.';}}
 const key='septanda.practice.v1.'+id;
 root.SEPTANDA_PRACTICE=Object.freeze({key,id});document.documentElement.classList.add('practice-page');
 const ids=[id,...Authors.ids.filter(other=>other!==id&&Authors.get(other).profile!==Authors.get(id).profile).slice(0,2)];
 function ensure(state){base.bindPlayer(state);if(!state.days[date]||state.days[date].ids[0]!==id)state.days[date]={ids,mode:'author-v2',selected:id,progress:{},seen:[],skipped:[]};const day=state.days[date];day.selected=id;day.skipped=[];return day;}
 root.SeptandaDaily=Object.freeze({...base,dayKey:()=>date,ensureDay:ensure,playIds:()=>[id],canSelect:(day,other)=>other===id,nextId:day=>['won','revealed'].includes(day.progress[id]?.status)?null:id,dayTotals:day=>{const r=day.progress[id];return{...base.dayTotals({...day,ids:[id]}),completed:Number(['won','revealed'].includes(r?.status)),skipped:0};}});
 document.addEventListener('click',e=>{if(e.target.closest('#practice-reset')){try{localStorage.removeItem(key);}catch(_){}location.reload();}});
})(globalThis);
