(function(root){
  'use strict';
  const E=root.SeptandaEmojiEngine,D=root.SEPTANDA_EMOJI,$=id=>document.getElementById(id);
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const seed=crypto.randomUUID(),item=id=>D.items.find(p=>p.id===id);
  let state=E.fresh(seed),key=E.KEY,identity=null,generation=0,queue=Promise.resolve(),date=E.day(),revision=0,paused=true,busy=false,memory=false,feedback='',draftTimer,pending=new Map();
  function note(text){$('emoji-sync').textContent=text;}
  function read(){try{const raw=localStorage.getItem(key);return raw?E.parse(raw):state;}catch{memory=true;note('Bonusový deník teď nelze načíst. Původní data nepřepisujeme; nové výsledky zůstanou jen na této stránce.');return state;}}
  function save(){if(memory)return;try{if(identity)state.pendingDrafts=Object.fromEntries(pending);localStorage.setItem(key,JSON.stringify(state));}catch{memory=true;note('Prohlížeč nepovolil uložení bonusu. Výsledek zůstane jen na této stránce.');}}
  function render(){
    $('emoji-loading').hidden=!paused;$('emoji-content').hidden=paused;$('emoji-summary').hidden=paused;
    if(paused){$('emoji-import-section').hidden=true;$('emoji-answer').value='';$('emoji-story').innerHTML='';$('emoji-history').innerHTML='';return;}
    const p=item(state.days[date]),r=p&&state.rounds[p.id],finished=r&&r.status!=='playing';
    $('emoji-date').textContent='Dnešní bonus · '+new Intl.DateTimeFormat('cs-CZ',{dateStyle:'long',timeZone:'Europe/Prague'}).format(new Date(date+'T12:00:00Z'));
    $('emoji-empty').hidden=!!p;$('emoji-round').hidden=!p;
    const rounds=Object.values(state.rounds);$('emoji-completed').textContent=rounds.filter(r=>r.status!=='playing').length+' / '+D.items.length;
    $('emoji-today').textContent=!r?'Všechny připravené bonusy už máš otevřené.':finished?'Dnešní bonus je hotový.':'Dnešní bonus čeká na rozluštění.';
    const history=D.items.filter(p=>state.rounds[p.id]?.status!=='playing'&&state.rounds[p.id]);
    $('emoji-history').innerHTML=history.length?'<summary>Moje odhalené knihy ('+history.length+')</summary>'+history.map(p=>'<p><strong>'+esc(p.title)+'</strong><br>'+esc(p.author)+'</p>').join(''):'';
    $('emoji-history').hidden=!history.length;
    const guest=guestState();$('emoji-import-section').hidden=!identity||!guest||!Object.values(guest.rounds).some(r=>r.attempts.length||r.hints||r.draft||r.status!=='playing');
    if(!p)return;
    $('emoji-symbols').innerHTML=p.emoji.map((v,i)=>'<span role="img" aria-label="'+esc(p.labels[i])+'">'+esc(v)+'</span>').join('');
    $('emoji-form').hidden=finished;$('emoji-tools').hidden=finished;$('emoji-story').hidden=!finished;
    if(document.activeElement!==$('emoji-answer'))$('emoji-answer').value=r.draft;
    $('emoji-feedback').hidden=!feedback||finished;$('emoji-feedback').textContent=feedback;
    $('emoji-hint').textContent=r.hints===0?'První stopa':r.hints===1?'Prozradit autora':'Obě stopy jsou otevřené';
    $('emoji-hint').disabled=busy||r.hints>=2||finished;
    $('emoji-hints').innerHTML=p.hints.slice(0,r.hints).map((text,i)=>'<li><strong>STOPA '+(i+1)+'</strong>'+esc(text)+'</li>').reverse().join('');
    $('emoji-hints').hidden=!r.hints||finished;
    $('emoji-story').innerHTML=finished?'<p class="eyebrow">'+(r.status==='solved'?'KNIHA ROZLUŠTĚNA':'KNIHA ODHALENA')+'</p><h3>'+esc(p.title)+'</h3><p class="emoji-author">'+esc(p.author)+'</p><p>'+esc(p.about)+'</p><details><summary>Jak číst tyto tři znaky</summary><p>'+esc(p.explanation)+'</p></details><a class="emoji-source" href="'+esc(p.source)+'" target="_blank" rel="noopener noreferrer">'+esc(p.sourceLabel)+' ↗</a><p class="muted">'+(Object.keys(state.rounds).length>=D.items.length?'Všech deset bonusů už máš otevřených. Další připravujeme.':'Další nová hádanka přijde zítra.')+' Úryvek máš dnes k dispozici zvlášť.</p>':'';
    $('emoji-answer').disabled=busy;$('emoji-submit').disabled=busy;$('emoji-reveal').disabled=busy;
  }
  function accept(reply){
    if(Number.isInteger(reply.revision)&&reply.revision<revision)return;
    const clean=E.parse(JSON.stringify(reply.state));
    for(const [id,text] of pending){if(clean.rounds[id]?.status==='playing')clean.rounds[id].draft=text;else pending.delete(id);}
    state=clean;if(reply.date)date=reply.date;revision=reply.revision||0;save();
  }
  function mutate(action,fields={},local){
    const g=generation,storageKey=key;
    const perform=async()=>{
      if(g!==generation||storageKey!==key)throw Error('Účet se mezitím změnil.');
      if(identity){const reply=await root.SeptandaLiteratureCloud.emojiCommand(action,fields);if(g!==generation)throw Error('Účet se mezitím změnil.');accept(reply);note('Bonus je uložený v účtu.');return reply.result;}
      state=read();const result=local(state);save();return result;
    };
    const run=()=>!identity&&navigator.locks?.request?navigator.locks.request(storageKey,perform):perform();
    queue=queue.then(run,run);return queue;
  }
  function guestState(){try{const raw=localStorage.getItem(E.KEY);return raw?E.parse(raw):null;}catch{return null;}}
  async function refresh(){
    if(paused)return;
    try{await flushDrafts();await mutate('daily',{},s=>E.assign(s,date=E.day(),D.items));render();}catch(error){note(error.message);}
  }
  async function setIdentity(id){
    const g=++generation;paused=true;clearTimeout(draftTimer);render();await queue.catch(()=>{});if(g!==generation)return;
    identity=id;key=id?E.KEY+'.account.'+id:E.KEY;memory=false;revision=0;pending=new Map();state=E.fresh(id||seed);feedback='';date=E.day();state=read();
    if(id)for(const [id,text] of Object.entries(state.pendingDrafts||{}))if(typeof text==='string'&&text.length<=150&&state.rounds[id]?.status==='playing')pending.set(id,text);
    try{
      if(id){const reply=await root.SeptandaLiteratureCloud.emojiCommand('daily');if(g!==generation)return;accept(reply);note('Bonus je uložený v účtu.');}
      else{await mutate('daily',{},s=>E.assign(s,date,D.items));if(g!==generation)return;if(!memory)note('Bonus je uložený v tomto prohlížeči.');}
      if(g!==generation)return;paused=false;render();if(id)flushDrafts().catch(error=>note(error.message));
    }catch(error){if(g===generation){$('emoji-loading-text').textContent='Bonus se nepodařilo načíst. '+error.message;$('emoji-retry').hidden=false;}}
  }
  async function flushDrafts(){
    clearTimeout(draftTimer);if(!identity||paused)return;const g=generation;
    for(const [id,text] of pending){await mutate('draft',{id,text},()=>{});if(g!==generation)return;if(pending.get(id)===text)pending.delete(id);save();}
  }
  async function action(name){
    if(paused||busy)return;const id=state.days[date],p=item(id),g=generation;if(!p)return;
    busy=true;render();
    try{
      if(name==='answer'){
        const text=$('emoji-answer').value;clearTimeout(draftTimer);
        const result=await mutate('answer',{id,text},s=>E.answer(s,p,text,D.items,date));if(g!==generation)return;
        if(pending.get(id)===text){pending.delete(id);save();}
        feedback=result?.kind==='empty'?'Napiš název knihy.':result?.kind==='try-again'?'Tuhle knihu zatím nehledáme. Zkus jiný název nebo si vezmi stopu.':'';
      }
      if(name==='hint')await mutate('hint',{id,level:state.rounds[id].hints+1},s=>E.hint(s,id,date));
      if(name==='reveal'){await mutate('reveal',{id},s=>E.reveal(s,id,date));pending.delete(id);save();}
    }catch(error){if(g===generation)feedback=error.message;}
    finally{if(g===generation){busy=false;render();if(state.rounds[id]?.status!=='playing'){$('emoji-story').tabIndex=-1;$('emoji-story').focus({preventScroll:true});}}}
  }
  function switchMode(emoji,updateURL=true){
    $('literary-view').hidden=emoji;$('emoji').hidden=!emoji;
    for(const mode of ['reading','emoji']){const on=(mode==='emoji')===emoji;$('mode-'+mode).setAttribute('aria-selected',String(on));$('mode-'+mode).tabIndex=on?0:-1;}
    if(updateURL){const url=new URL(location.href);url.hash=emoji?'emoji':'';history.replaceState(null,'',url.pathname+url.search+url.hash);}
  }
  $('emoji-form').addEventListener('submit',event=>{event.preventDefault();action('answer');});
  $('emoji-answer').addEventListener('input',()=>{
    if(paused||busy)return;const id=state.days[date],r=state.rounds[id];if(!r||r.status!=='playing')return;
    r.draft=$('emoji-answer').value.slice(0,150);if(identity)pending.set(id,r.draft);save();clearTimeout(draftTimer);draftTimer=setTimeout(()=>flushDrafts().catch(error=>note(error.message)),700);
  });
  $('emoji-hint').addEventListener('click',()=>action('hint'));
  $('emoji-reveal').addEventListener('click',()=>action('reveal'));
  $('emoji-retry').addEventListener('click',()=>{if(identity)setIdentity(identity);else refresh();});
  $('emoji-report').addEventListener('click',()=>{
    const p=item(state.days[date]);if(p&&!$('contact-message').value)$('contact-message').value='Bonus ze dne '+date+' · '+p.emoji.join(' ')+'\nMůj tip: '+$('emoji-answer').value+'\nProč mi také sedí: ';
    $('contact-category').value='bug';$('contact').showModal();
  });
  $('emoji-import').addEventListener('click',async()=>{
    if(!identity)return;const guest=guestState();if(!guest)return;$('emoji-import').disabled=true;
    try{await mutate('import',{state:guest},()=>{});render();note('Místní bonusy jsou přidané. Už uložené výsledky zůstaly zachované.');}catch(error){note(error.message);}finally{$('emoji-import').disabled=false;}
  });
  $('emoji-share').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText('Zkus poznat knihu ze tří emoji v Šeptandě: https://septanda.com/#emoji');$('emoji-share-status').textContent='Odkaz je zkopírovaný.';}catch{$('emoji-share-status').textContent='Pošli odkaz https://septanda.com/#emoji';}
  });
  $('mode-reading').addEventListener('click',()=>switchMode(false));$('mode-emoji').addEventListener('click',()=>switchMode(true));
  $('play-modes').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const emoji=event.key==='End'||(event.key!=='Home'&&$('mode-emoji').getAttribute('aria-selected')!=='true');switchMode(emoji);$('mode-'+(emoji?'emoji':'reading')).focus();}});
  document.querySelector('.skip').addEventListener('click',()=>switchMode(false));
  addEventListener('hashchange',()=>switchMode(location.hash==='#emoji',false));
  addEventListener('storage',event=>{if(event.key===key&&!paused&&!identity){state=read();render();}});
  addEventListener('focus',refresh);addEventListener('online',refresh);
  setInterval(()=>{if(!identity&&!paused&&date!==E.day())refresh();},30000);
  root.SeptandaEmoji={setIdentity,refresh,flushDrafts,pause(){generation++;paused=true;busy=false;clearTimeout(draftTimer);$('emoji-loading-text').textContent='Načítám tvůj denní bonus…';$('emoji-retry').hidden=true;render();},exportState:()=>E.parse(JSON.stringify(state))};
  switchMode(location.hash==='#emoji',false);render();
})(globalThis);
