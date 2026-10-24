(function () {
  'use strict';
  const E=globalThis.SeptandaLiterature, D=globalThis.SEPTANDA_LITERATURE;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sample=id=>D.samples.find(s=>s.id===id);
  const seed=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('-');
  let state=E.fresh(seed),memory=false,queue=Promise.resolve(),current=null,mode='daily',assignedDay=E.day(),feedback=null,opener=null,busy=false;
  function warning(text) {$('storage-note').hidden=false;$('storage-note').textContent=text;}
  function read() {
    if(memory) return state;
    try {const raw=localStorage.getItem(E.KEY);return raw?E.parse(raw):state;}
    catch(error) {memory=true;warning('Deník teď nelze bezpečně načíst. Původní data jsme nepřepsali. Můžeš hrát, ale nové výsledky zůstanou jen do zavření této stránky.');return state;}
  }
  function change(fn) {
    const perform=async()=>{
      state=read();const result=fn(state);
      if(!memory)try{localStorage.setItem(E.KEY,JSON.stringify(state));}catch{memory=true;warning('Prohlížeč nepovolil uložení. Můžeš hrát, ale tento deník zůstane jen do zavření stránky.');}
      return result;
    };
    const task=()=>navigator.locks?.request?navigator.locks.request(E.KEY,perform):perform();
    queue=queue.then(task,task);return queue;
  }
  function feedbackHTML(result) {
    if(result.kind==='empty') return '<p>Napiš příjmení nebo celé jméno autora.</p>';
    if(result.kind==='ambiguous') return '<p><strong>Kterou osobnost máš na mysli?</strong></p><p>Toto příjmení má více autorů. Upřesnění tě nestojí žádné body.</p>'+result.matches.map(a=>'<button type="button" class="choice" data-person="'+esc(a.id)+'">'+esc(a.name)+'</button>').join('');
    if(result.kind==='unknown') return '<p><strong>Toto jméno zatím neumíme porovnat.</strong></p><p>Zkontroluj zápis nebo si vezmi stopu. Neznámý tip nehodnotíme jako vzdálený a body za něj neztrácíš.</p>';
    if(result.kind==='known') {
      const target=D.authors.find(a=>a.id===sample(current).author),similar=E.compare(result.person,target);
      const yes=[],no=[];
      (similar.environment?yes:no).push('literární prostředí');(similar.period?yes:no).push('období');(similar.prose?yes:no).push('próza');
      return '<p><strong>'+esc(result.person.name)+': zkus hledat dál.</strong></p>'+(yes.length?'<p>Shoduje se: '+yes.join(', ')+'.</p>':'')+(no.length?'<p>Liší se: '+no.join(', ')+'.</p>':'<p>Tato obecná vodítka další rozdíl neukazují. Konkrétnější stopa ti pomůže víc.</p>')+'<p class="muted">Srovnáváme prostředí, široké období a tvorbu v próze. Není to procentuální hodnocení tvého tipu.</p>';
    }
    return '';
  }
  function renderStory(s,r) {
    const saved=state.saved.includes(s.id);
    $('story').innerHTML='<p class="eyebrow">'+(r.status==='solved'?'AUTOR ODHALEN · +'+E.award(r)+' CVIČNÝCH BODŮ':'PŘÍBĚH OTEVŘEN · BEZ BODŮ')+'</p><h2>'+esc(s.work)+'</h2><p class="author-name">'+esc(s.name)+'</p><p class="book-date">První knižní vydání: '+esc(s.year)+'</p><h3>Co prozrazuje úryvek</h3><p>'+esc(s.story)+'</p><h3>Kniha a její doba</h3><p>'+esc(s.context)+'</p><p class="notice">'+esc(s.notice)+'</p><button type="button" class="save-book" data-save aria-pressed="'+saved+'">'+(saved?'Uloženo: chci si přečíst ✓':'Chci si knihu přečíst +')+'</button><div class="sources">Znění ukázky: '+esc(s.edition)+'. Původní pravopis je zachovaný.'+s.sources.map(source=>'<a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.label)+' ↗</a>').join('')+'</div>';
  }
  function render() {
    const s=sample(current),r=state.rounds[current],finished=r && r.status!=='playing';
    $('day-label').textContent=mode==='daily'?'Dnešní čtení · '+new Intl.DateTimeFormat('cs-CZ',{dateStyle:'long',timeZone:'Europe/Prague'}).format(new Date(assignedDay+'T12:00:00Z')):'Testovací ukázka '+String(D.samples.findIndex(x=>x.id===current)+1).padStart(2,'0')+' / 10';
    $('daily-return').hidden=mode==='daily';$('empty').hidden=!!s;$('round').hidden=!s;$('hints-panel').hidden=!s || finished;
    if(!s) {$('mascot-line').textContent='Všech deset knih už znáš z ukázky. Své objevy najdeš v knihovničce.';return;}
    $('excerpt').textContent=s.text;$('reading-time').textContent='≈ '+Math.max(1,Math.ceil(s.text.split(/\s+/).length/180))+' min čtení';
    $('author-form').hidden=finished;$('story').hidden=!finished;$('reveal-action').hidden=finished;
    if(document.activeElement!==$('author')) $('author').value=r.draft;
    $('award-note').textContent='Za uhodnutí teď '+(200-50*r.hints)+' cvičných bodů';
    $('hint-button').textContent=r.hints===0?'První stopa · −50 z odměny':r.hints===1?'Druhá stopa · −50 z odměny':r.hints===2?'Čtyři autoři · −50 z odměny':'Všechny stopy jsou otevřené';
    $('hint-button').disabled=finished || r.hints===3;
    $('hint-help').textContent=finished?'Příběh i prameny najdeš pod úryvkem.':'Body nepotřebuješ předem. Stopa sníží jen odměnu za toto čtení.';
    $('hints').innerHTML=s.hints.slice(0,Math.min(2,r.hints)).map((h,i)=>'<li><strong>STOPA '+(i+1)+'</strong>'+esc(h)+'</li>').join('')+(r.hints===3?'<li><strong>STOPA 3 · ČTYŘI AUTOŘI</strong>'+E.choices(s,state.seed,D.authors).map(a=>finished?'<p>'+esc(a.name)+'</p>':'<button type="button" class="choice" data-person="'+esc(a.id)+'">'+esc(a.name)+'</button>').join('')+'</li>':'');
    $('feedback').hidden=finished || !feedback;$('feedback').innerHTML=finished?'':feedbackHTML(feedback||{});
    $('septik').src='/assets/septik/'+(finished?(r.status==='solved'?'success':'discovery'):r.hints?'thinking':'idle')+'.webp';
    $('mascot-line').textContent=finished?'Za každým úryvkem je kniha. Tady začíná její příběh.':r.hints?'Od doby a prostředí se dostáváme ke konkrétní knize.':'Někdy napoví jméno, jindy rytmus věty. Zkus svůj první dojem.';
    if(finished) renderStory(s,r);
  }
  async function daily() {
    assignedDay=E.day();const id=await change(s=>E.assign(s,assignedDay,D.samples));
    mode='daily';current=id;feedback=null;$('new-day').hidden=true;render();
  }
  async function select(id) {if(!sample(id))return;await change(s=>E.open(s,id,E.day()));current=id;mode='preview';feedback=null;render();$('reading').focus();}
  async function submit(text) {
    if(busy||!current)return;busy=true;const id=current;
    try {
      const result=await change(s=>E.submit(s,sample(id),text,D.authors,E.day()));
      if(current!==id)return;
      feedback=result;render();
      if(result.kind==='correct'){$('story').tabIndex=-1;$('story').focus();}
    }finally{busy=false;}
  }
  function listSamples() {
    $('sample-list').innerHTML=D.samples.map((s,i)=>{const r=state.rounds[s.id];return '<button type="button" class="sample-button" data-sample="'+s.id+'"><strong>Ukázka '+String(i+1).padStart(2,'0')+'</strong><small>'+(r?.status==='solved'?'Uhodnuto · '+E.award(r)+' b.':r?.status==='revealed'?'Autor odhalen':r?'Rozečteno':'Ještě neotevřeno')+'</small></button>';}).join('');
  }
  function notebook() {
    const done=D.samples.filter(s=>state.rounds[s.id] && state.rounds[s.id].status!=='playing');
    $('notebook-score').textContent=done.length+' / 10 objevených knih · '+Object.values(state.rounds).reduce((n,r)=>n+E.award(r),0)+' cvičných bodů';
    $('book-list').innerHTML=done.length?done.map(s=>'<div class="book-entry"><h3>'+esc(s.work)+'</h3><p>'+esc(s.name)+' · '+esc(s.year)+'</p>'+(state.saved.includes(s.id)?'<p class="saved">Chci si přečíst ✓</p>':'')+'<button type="button" data-sample="'+s.id+'">Vrátit se k příběhu →</button></div>').join(''):'<p>Po uhodnutí nebo odhalení autora sem uložíme knihu i její příběh.</p>';
  }
  function closeDialog() {document.querySelector('dialog[open]')?.close();opener?.focus();}
  document.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-dialog')){opener=b;if(b.dataset.dialog==='samples')listSamples();if(b.dataset.dialog==='notebook')notebook();$(b.dataset.dialog).showModal();}
    if(b.hasAttribute('data-close'))closeDialog();
    if(b.hasAttribute('data-sample')){closeDialog();await select(b.dataset.sample);}
    if(b.hasAttribute('data-daily')){await daily();$('reading').focus();}
    if(b.hasAttribute('data-person')){const a=D.authors.find(a=>a.id===b.dataset.person);if(a)await submit(a.name);}
    if(b.hasAttribute('data-hint') && current){const id=current;await change(s=>E.hint(s,id,E.day()));render();}
    if(b.hasAttribute('data-reveal') && current){const id=current;await change(s=>E.reveal(s,id,E.day()));feedback=null;render();$('story').tabIndex=-1;$('story').focus();}
    if(b.hasAttribute('data-save') && current){const id=current;await change(s=>{s.saved=s.saved.includes(id)?s.saved.filter(x=>x!==id):[...s.saved,id];});render();$('story').querySelector('[data-save]').focus();}
  });
  $('author-form').addEventListener('submit',event=>{event.preventDefault();submit($('author').value);});
  $('author').addEventListener('input',()=>{const id=current,value=$('author').value;if(id)change(s=>{const r=E.open(s,id,E.day());if(r.status==='playing')r.draft=value;});});
  addEventListener('storage',event=>{if(event.key===E.KEY && !memory){state=read();render();if($('notebook').open)notebook();if($('samples').open)listSamples();}});
  setInterval(()=>{$('new-day').hidden=E.day()===assignedDay;},30000);
  daily();
})();
