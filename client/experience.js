/* Personal learning tools. Only explicit feedback/favourites alter the saved state. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id),Game=root.SeptandaGame,Daily=root.SeptandaDaily,Authors=root.SeptandaAuthors,all=root.SEPTANDA_PUZZLES,byId=new Map(all.map(p=>[p.id,p]));
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const labels={independent:'Samostatně',hint:'Se stopou',options:'Z možností',revealed:'Odhaleno bez odměny',playing:'Zatím otevřeno'};
 let favouriteOnly=false;
 const terminal=r=>['won','revealed'].includes(r?.status);
 function records(state){
  const map=new Map(),add=(id,r,date,mode)=>{if(terminal(r)&&byId.has(id)&&!map.has(id))map.set(id,{id,round:r,date,mode});};
  for(const[date,day]of [...Object.entries(state.days),...Object.entries(state.archivedDays||{})].sort(([a],[b])=>b.localeCompare(a)))for(const id of day.ids)add(id,day.progress[id],date,Daily.modeFor(day));
  for(const[id,r]of Object.entries(state.legacy.progress))add(id,r,null,'classic');
  return [...map.values()];
 }
 function story(p){const entry=Authors.get(p),parts=entry?.story?.paragraphs||[p.education?.summary||p.meaning||p.hint,p.education?.context].filter(Boolean);return parts.map(x=>`<p>${esc(x)}</p>`).join('');}
 function sources(p){return (p.sources||[]).filter(s=>/^https:\/\//.test(s.url)).map(s=>`<a class="underlined" target="_blank" rel="noopener noreferrer" href="${esc(s.url)}">${esc(s.label)} →</a>`).join(' · ');}
 function challenge(id,practice=false){return new URL((practice?'procvicit':'vyzva')+'?id='+encodeURIComponent(id),location.origin+'/').href;}
 function renderNotebook(){
  const state=Game.inspect(),items=records(state).filter(item=>!favouriteOnly||state.notebook?.[item.id]?.saved);
  $('notebook-filter').textContent=favouriteOnly?'Zobrazit všechny':'Jen oblíbené';$('notebook-filter').setAttribute('aria-pressed',String(favouriteOnly));
  $('notebook-content').innerHTML=items.length?items.map(({id,round,date,mode})=>{const p=byId.get(id),saved=!!state.notebook?.[id]?.saved;return `<article class="notebook-entry"><p class="eyebrow">${date?esc(Daily.displayDate(date)):'Dřívější objev'} · ${labels[Daily.isAuthorMode(mode)?Daily.roundMethod(round):round.status==='revealed'?'revealed':round.hints.length||round.chainLevel?'hint':'independent']}</p><blockquote>${esc(p.answer)}</blockquote><h3>${esc(Authors.profile(p)?.name||p.education?.person||p.author)}</h3>${story(p)}<p class="source-links">${sources(p)}</p><div class="entry-actions"><button type="button" class="secondary-button" data-favourite="${esc(id)}" aria-pressed="${saved}">${saved?'Uloženo mezi oblíbené':'Uložit oblíbený'}</button>${Authors.get(id)?`<a class="underlined" href="${challenge(id,true)}">Procvičit bez bodů →</a><button class="text-button underlined" data-challenge="${esc(id)}">Vyzvat kamaráda</button>`:''}</div></article>`;}).join(''):'<p>Sem se ukládají dokončené a odhalené výroky. Rozehrané otázky tu řešení neprozrazují.</p>';
 }
 function nextMidnight(now=new Date()){
  const key=Daily.calendarDayKey(now);let lo=now.getTime(),hi=lo+27*3600000;
  while(hi-lo>1000){const mid=Math.floor((lo+hi)/2);if(Daily.calendarDayKey(new Date(mid))===key)lo=mid;else hi=mid;}
  return new Date(hi);
 }
 function weekCount(state){const today=Daily.dayKey(),dt=new Date(today+'T12:00:00Z'),dow=(dt.getUTCDay()+6)%7;dt.setUTCDate(dt.getUTCDate()-dow);const start=dt.toISOString().slice(0,10);return Object.entries(state.days).filter(([d,day])=>d>=start&&d<=today&&Daily.playIds(day).some(id=>terminal(day.progress[id]))).length;}
 function renderFeedback(p,r){
  let host=$('quote-feedback');if(!host){host=document.createElement('section');host.id='quote-feedback';host.className='quote-feedback';$('reveal-panel').append(host);}
  const current=r.feedback;host.innerHTML=`<p>Jaká byla otázka? <small>Dobrovolně, bez vlivu na body.</small></p><div class="entry-actions">${[['easy','Moc snadná'],['fair','Akorát'],['hard','Moc těžká'],['unclear','Nejasné zadání']].map(([key,label])=>`<button type="button" class="text-button rating" data-rate="${key}" data-rate-id="${esc(p.id)}" aria-pressed="${current?.difficulty===key}">${label}</button>`).join('')}</div>${r.hints.length?`<p>Pomohly ti stopy? <button type="button" class="text-button rating" data-helpful="yes" data-rate-id="${esc(p.id)}" aria-pressed="${current?.helpful===true}">Ano</button> <button type="button" class="text-button rating" data-helpful="no" data-rate-id="${esc(p.id)}" aria-pressed="${current?.helpful===false}">Ne</button></p>`:''}<div class="entry-actions"><button type="button" class="text-button underlined" data-favourite="${esc(p.id)}" aria-pressed="${!!Game.inspect().notebook?.[p.id]?.saved}">${Game.inspect().notebook?.[p.id]?.saved?'Uloženo v oblíbených':'Uložit do oblíbených'}</button><button type="button" class="text-button underlined" data-challenge="${esc(p.id)}">Vyzvat kamaráda na tento výrok</button></div><p class="field-note">${Game.hasAccount()?'Hodnocení vidí jen správce. V účtu se uloží společně s postupem.':'Hodnocení zůstává v tomto prohlížeči. Do účtu ho přidáš až po přihlášení a potvrzení místního postupu.'}</p>`;
 }
 function render(){
  const state=Game.inspect(),day=state.days[Daily.dayKey()];if(!day)return;const ids=Daily.playIds(day),done=ids.filter(id=>terminal(day.progress[id])),independent=done.filter(id=>Daily.roundMethod(day.progress[id])==='independent').length;
  const dailyPoints=ids.reduce((sum,id)=>{const r=day.progress[id];return sum+(r?.status==='won'?200:0)-(r?.hints||[]).reduce((n,h)=>n+({clue:50,small:30,previous:60}[h]||0),0)-(r?.chainLevel||0)*50-(r?.paidSkip?Daily.skipCharge(r):0);},0);$('today-performance').innerHTML=`<div><span>Dnes hotovo</span><strong>${done.length}<small> / ${ids.length}</small></strong></div><div><span>Samostatně</span><strong>${independent}</strong></div><div><span>Dnešní body</span><strong>${dailyPoints>0?'+':''}${dailyPoints}<small> b.</small></strong></div>`;$('weekly-goal').innerHTML=`<span>Týdenní cíl</span><strong>${Math.min(3,weekCount(state))}<small> / 3 dny</small></strong>`;
  const complete=ids.length>0&&done.length===ids.length;$('daily-recap').hidden=!complete||!!root.SEPTANDA_PRACTICE;
  if(complete){const fact=byId.get(done[0])?.education?.summary||byId.get(done[0])?.meaning||'';$('daily-recap').innerHTML=`<p class="eyebrow">DNEŠNÍ PÁTRÁNÍ JE HOTOVÉ</p><h2>Tři případy, další objevy.</h2><ol>${ids.map((id,i)=>`<li>Případ ${i+1}: <strong>${labels[Daily.roundMethod(day.progress[id])]}</strong></li>`).join('')}</ol><p>Samostatně ${independent} ze ${ids.length}. ${esc(fact)}</p><p>Další sada přijde o půlnoci v Praze. <span id="next-daily-time"></span></p><div class="entry-actions"><button class="primary-button" type="button" id="download-card">Stáhnout kartičku se Šeptíkem</button><button class="text-button underlined" type="button" data-open="notebook-dialog">Otevřít Deník objevů →</button></div><p id="card-status" role="status"></p>`;updateCountdown();}
  const p=byId.get(day.selected),r=day.progress[day.selected];if(p&&terminal(r)&&!root.SEPTANDA_PRACTICE&&!root.SEPTANDA_DEMO)renderFeedback(p,r);
  if(p&&r?.attempts.length&&r.status==='playing'&&!root.SEPTANDA_PRACTICE&&!root.SEPTANDA_DEMO){const panel=$('result-panel');if(!panel.querySelector('[data-report-answer]')){const button=document.createElement('button');button.type='button';button.className='text-button underlined';button.dataset.reportAnswer='';button.textContent='Moje odpověď by měla platit';panel.append(button);}}
  if($('notebook-dialog').open)renderNotebook();
 }
 function updateCountdown(){const box=$('next-daily-time');if(!box)return;const mins=Math.max(1,Math.ceil((nextMidnight()-new Date())/60000));box.textContent=`Za ${Math.floor(mins/60)} h ${mins%60} min.`;}
 async function card(){
  const day=Game.inspect().days[Daily.dayKey()],ids=Daily.playIds(day);if(ids.some(id=>!terminal(day.progress[id])))return;
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1080;const c=canvas.getContext('2d');if(!c)return;
  c.fillStyle='#e8e6dc';c.fillRect(0,0,1080,1080);c.strokeStyle='#dcdacf';c.lineWidth=1;for(let i=0;i<1080;i+=36){c.beginPath();c.moveTo(i,0);c.lineTo(i,1080);c.moveTo(0,i);c.lineTo(1080,i);c.stroke();}
  c.fillStyle='#252b26';c.font='bold 82px sans-serif';c.fillText('šeptanda.',72,135);c.font='26px monospace';c.fillText(Daily.displayDate(Daily.dayKey()),75,200);c.font='bold 58px sans-serif';c.fillText('Dnešní pátrání',72,330);
  ids.forEach((id,i)=>{const method=Daily.roundMethod(day.progress[id]);c.fillStyle=method==='independent'?'#48634d':'#a54532';c.fillRect(76,412+i*118,12,72);c.fillStyle='#252b26';c.font='bold 34px sans-serif';c.fillText(`${i+1}. ${labels[method]}`,112,461+i*118);});
  const src=root.SEPTANDA_MASCOT_ASSETS?.success||root.SEPTANDA_MASCOT_ASSETS?.idle;if(src){const image=new Image();await new Promise(resolve=>{image.onload=resolve;image.onerror=resolve;image.src=typeof src==='string'?src:src.src;});if(image.complete&&image.naturalWidth)c.drawImage(image,750,360,260,300);}
  c.fillStyle='#252b26';c.font='30px sans-serif';c.fillText('Každý den tři příběhy za známými slovy.',72,895);c.font='bold 36px monospace';c.fillText('septanda.com',72,975);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob){$('card-status').textContent='Kartičku se nepodařilo vytvořit. Zkus to znovu.';return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='septanda-'+Daily.dayKey()+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);$('card-status').textContent='Kartička je připravená ke stažení. Odpovědi na ní nejsou.';
 }
 async function copyChallenge(id){const text=challenge(id);try{await navigator.clipboard.writeText(text);$('announcement').textContent='Odkaz na nesoutěžní výzvu je zkopírovaný.';}catch(_){const box=document.createElement('input');box.value=text;box.readOnly=true;box.setAttribute('aria-label','Odkaz na výzvu');$('notebook-content').prepend(box);$('notebook-dialog').showModal();box.select();}}
 document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;const state=Game.inspect(),day=state.days[Daily.dayKey()],p=byId.get(day?.selected),r=day?.progress[day.selected];
  if(b.dataset.open==='notebook-dialog')renderNotebook();
  if(b.id==='notebook-filter'){favouriteOnly=!favouriteOnly;renderNotebook();}
  if(b.dataset.favourite){const id=b.dataset.favourite;Game.notebook(id,!state.notebook?.[id]?.saved);render();}
  if(b.dataset.rate)Game.rate(b.dataset.rateId,b.dataset.rate,r?.feedback?.helpful);
  if(b.dataset.helpful)Game.rate(b.dataset.rateId,r?.feedback?.difficulty||null,b.dataset.helpful==='yes');
  if(b.dataset.challenge)copyChallenge(b.dataset.challenge);
  if(b.id==='download-card')card().catch(()=>{$('card-status').textContent='Kartičku se nepodařilo připravit. Zkus to znovu.';});
  if(b.hasAttribute('data-report-answer')&&p){const form=$('contact-form');form.elements.namedItem('category').value='bug';const message=form.elements.namedItem('message');message.value=`Prosím o kontrolu uznání odpovědi.\nVýrok: ${p.answer}\nMůj tip: ${r.attempts.at(-1)?.text||''}\nID: ${p.id}\n\nProč si myslím, že odpověď platí:\n`;if(!$('contact-dialog').open)$('contact-dialog').showModal();message.focus();}
  if(b.id==='toggle-intro'){document.documentElement.classList.toggle('compact-intro');b.textContent=document.documentElement.classList.contains('compact-intro')?'Zobrazit úvod':'Zkrátit úvod';}
 });
 document.addEventListener('septanda:progress',render);setInterval(updateCountdown,60000);
 if(!root.SEPTANDA_PRACTICE&&!root.SEPTANDA_DEMO&&document.documentElement){try{if(localStorage.getItem('septanda.intro-seen'))document.documentElement.classList.add('compact-intro');localStorage.setItem('septanda.intro-seen','1');}catch(_){}$('toggle-intro').textContent=document.documentElement.classList.contains('compact-intro')?'Zobrazit úvod':'Zkrátit úvod';}
 root.SeptandaExperience=Object.freeze({records,nextMidnight,weekCount,challenge});render();
})(globalThis);
