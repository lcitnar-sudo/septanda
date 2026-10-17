(function () {
  function startLegacy() {
  'use strict';
  const $=id=>document.getElementById(id), Daily=globalThis.SeptandaDaily, Engine=globalThis.SeptandaEngine;
  const endpoint='./.netlify/functions/leaderboard';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data=null,account=null,lastSent='',mode='login',busy=false,queued=false,timer;
  function snapshot() {
    let state;try{state=Daily.sanitizeState(JSON.parse(localStorage.getItem(globalThis.SeptandaGame.storageKey())));}catch{}
    const date=Daily.dayKey(), day=state?.days[date],ids=day?.ids || Daily.plan(date);
    return {action:'sync',date,rounds:ids.map(id=>{
      const r=day?.progress[id] || Daily.blankRound(),p=globalThis.SEPTANDA_PUZZLES.find(p=>p.id===id);
      const winning=r.status==='won'?r.attempts.find(a=>Engine.evaluate(a.text,p).accepted)?.text:undefined;
      return {id,status:r.status,hint:r.hints.length>0,...(winning?{answer:winning}:{})};
    })};
  }
  function rows(entries) {
    return `<ol class="leaderboard-list">${entries.map(e=>`<li class="leaderboard-row ${e.id===account?.id?'is-you':''}"><span class="place">${e.rank}.</span><span class="player">${escape(e.name)}${e.id===account?.id?'<span class="you">ty</span>':''}</span><strong class="points">${e.points} <span class="small">b.</span></strong></li>`).join('')}</ol>`;
  }
  function render() {
    $('leaderboard-date').textContent=data?.date?new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'numeric'}).format(new Date(data.date+'T12:00:00Z')):'';
    $('leaderboard-join').textContent=account?'Odhlásit se':'Přihlásit se';
    $('header-register').hidden=Boolean(account);
    $('header-login').hidden=Boolean(account);
    $('header-profile').hidden=!account;
    $('header-player-name').textContent=account?.name || '';
    $('header-account-label').textContent=account?.email?'Můj účet':'Doplň e-mail';
    $('header-profile').setAttribute('aria-label',account?'Můj účet: '+account.name:'Můj účet');
    if(!data) return;
    let preview=data.entries.slice(0,5);
    if(data.me && !preview.some(e=>e.id===data.me.id))preview=[...preview.slice(0,4),data.me];
    const empty='<p class="leaderboard-empty">Dnes tu ještě nikdo nehraje.</p>';
    $('leaderboard-preview').innerHTML=preview.length?rows(preview):empty;
    const full=data.entries.slice();if(data.me && !full.some(e=>e.id===data.me.id))full.push(data.me);
    $('leaderboard-table').innerHTML=full.length?rows(full)+(data.total>100?'<p class="dialog-note">Prvních 100 hráčů a tvoje umístění.</p>':''):empty;
  }
  async function request(body) {
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),7000);
    try {
      const response=await fetch(endpoint,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
      if(response.status===404)throw new Error('Žebříček zatím není připojený.');
      let result;try{result=await response.json();}catch{throw new Error('Žebříček zatím není připojený.');}
      if(!response.ok)throw Object.assign(new Error(result.error || 'Pořadí se nepodařilo načíst.'),{status:response.status});
      return result;
    } catch(e) {if(e.name==='AbortError' || e instanceof TypeError)throw new Error('Žebříček je teď nedostupný. Hra může pokračovat.');throw e;}
    finally{clearTimeout(timeout);}
  }
  function accept(result) {
    const changed=(account?.id || null)!==(result.account?.id || null);
    data=result;account=result.account;
    if(changed){lastSent='';globalThis.SeptandaGame.setAccount(account?.id || null);}
    render();
  }
  async function refresh() {
    if(busy){queued=true;return;}
    busy=true;$('leaderboard-refresh').disabled=true;
    try {
      if(!data)accept(await request());
      const body=snapshot(),signature=JSON.stringify(body);
      if(account && signature!==lastSent){accept(await request(body));lastSent=signature;}
      else accept(await request());
      $('leaderboard-status').textContent=data.local?'Lokální pořadí pro zkoušení.':'';
    } catch(e) {
      $('leaderboard-status').textContent=e.message;
      if(!data){$('leaderboard-preview').innerHTML='<p class="leaderboard-empty">Pořadí zatím není dostupné.</p>';$('leaderboard-table').innerHTML='<p class="leaderboard-empty">'+escape(e.message)+'</p>';}
      if(e.status===401){accept({...data,account:null});lastSent='';}
    } finally {
      busy=false;$('leaderboard-refresh').disabled=false;
      if(queued){queued=false;clearTimeout(timer);timer=setTimeout(refresh,400);}
    }
  }
  function setMode(next) {
    mode=next;$('player-title').textContent=mode==='register'?'Vytvoř si hráčský účet.':'Přihlas se do hry.';
    $('mode-login').setAttribute('aria-pressed',String(mode==='login'));$('mode-register').setAttribute('aria-pressed',String(mode==='register'));
    $('player-password').autocomplete=mode==='register'?'new-password':'current-password';
    $('registration-email').hidden=mode!=='register';
    $('player-email').disabled=mode!=='register';
    $('player-email').required=mode==='register';
    $('player-help').textContent=mode==='register'?'Přezdívka bude veřejná, e-mail zůstane u účtu. Přihlašovat se budeš přezdívkou a heslem.':'Přihlas se přezdívkou a heslem. Tvoje dnešní body se zapíší do společného pořadí.';
    $('player-submit').innerHTML=mode==='register'?'Vytvořit účet a zapojit se <span aria-hidden="true">→</span>':'Přihlásit se <span aria-hidden="true">→</span>';
    $('player-message').textContent='';
  }
  $('mode-login').addEventListener('click',()=>setMode('login'));
  $('mode-register').addEventListener('click',()=>setMode('register'));
  function openPlayer(next) {setMode(next);if(!$('player-dialog').open)$('player-dialog').showModal();}
  $('header-login').addEventListener('click',()=>openPlayer('login'));
  $('header-register').addEventListener('click',()=>openPlayer('register'));
  $('header-profile').addEventListener('click',()=>{
    if(!account)return;
    $('profile-title').textContent=account.email?'Můj účet.':'Doplň svůj e-mail.';
    $('profile-name').textContent=account.name;
    $('profile-email').value=account.email || '';
    $('profile-password').value='';
    $('profile-message').textContent='';$('profile-message').classList.remove('is-success');
    if(!$('profile-dialog').open)$('profile-dialog').showModal();
  });
  $('leaderboard-refresh').addEventListener('click',refresh);
  async function logout() {
    if(busy){$('leaderboard-status').textContent='Počkej prosím, než se dokončí načítání.';return;}
    busy=true;
    try{accept(await request({action:'logout'}));lastSent='';$('profile-dialog').close();$('leaderboard-status').textContent='Jsi odhlášený.';}
    catch(e){$('leaderboard-status').textContent=e.message;$('profile-message').textContent=e.message;}
    finally{busy=false;if(queued){queued=false;refresh();}}
  }
  $('leaderboard-join').addEventListener('click',()=>account?logout():openPlayer('login'));
  $('profile-logout').addEventListener('click',logout);
  $('player-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy){$('player-message').textContent='Počkej prosím na dokončení načítání a zkus to znovu.';return;}
    busy=true;$('player-submit').disabled=true;$('player-message').textContent='';
    try {
      const result=await request({action:mode,name:$('player-name').value,password:$('player-password').value,...(mode==='register'?{email:$('player-email').value}:{})});
      $('player-password').value='';accept(result);lastSent='';$('player-dialog').close();
    } catch(e){$('player-message').textContent=e.message;}
    finally{busy=false;$('player-submit').disabled=false;}
    if(account)refresh();
  });
  $('profile-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy){$('profile-message').textContent='Počkej prosím na dokončení načítání a zkus to znovu.';return;}
    busy=true;$('profile-submit').disabled=true;$('profile-message').textContent='';$('profile-message').classList.remove('is-success');
    try {
      accept(await request({action:'update-email',email:$('profile-email').value,password:$('profile-password').value}));
      $('profile-email').value=account.email;$('profile-password').value='';$('profile-title').textContent='Můj účet.';
      $('profile-message').textContent='E-mail je uložený.';$('profile-message').classList.add('is-success');
    } catch(e){$('profile-message').textContent=e.message;}
    finally{busy=false;$('profile-submit').disabled=false;if(queued){queued=false;refresh();}}
  });
  $('player-dialog').addEventListener('close',()=>{$('player-password').value='';});
  $('profile-dialog').addEventListener('close',()=>{$('profile-password').value='';$('profile-email').value='';});
  document.addEventListener('septanda:progress',()=>{if(!account)return;clearTimeout(timer);timer=setTimeout(refresh,400);});
  window.addEventListener('focus',()=>{if(data)refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && data)refresh();});
  setInterval(()=>{if(!document.hidden && data)refresh();},60000);
  refresh();
  }
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 8000);
  fetch('/.netlify/functions/runtime-config', {cache:'no-store',credentials:'same-origin',signal:timeout.signal})
    .then(async response => {
      if (response.status === 404) return {provider:'legacy'};
      if (!response.ok) throw new Error('Připojení účtu je teď nedostupné. Hra může pokračovat bez účtu.');
      return response.json();
    })
    .then(async config => {
      globalThis.SeptandaRuntime = config;
      if (config.provider === 'supabase') {
        if (!config.configured || !config.supabase) throw new Error('Účty ještě nejsou připojené. Hra může pokračovat bez účtu.');
        await globalThis.SeptandaCloud.start(config);
      } else if (config.provider === 'legacy') startLegacy();
      else throw new Error('Účty ještě nejsou připojené. Hra může pokračovat bez účtu.');
    })
    .catch(error => {
      const message = error.name === 'AbortError' ? 'Připojení účtu je teď nedostupné. Hra může pokračovat bez účtu.' : error.message;
      document.getElementById('leaderboard-status').textContent = message;
      document.getElementById('leaderboard-preview').innerHTML = '<p class="leaderboard-empty">Pořadí zatím není dostupné.</p>';
      const showError = () => { const dialog = document.getElementById('player-dialog'); document.getElementById('player-message').textContent = message; if (!dialog.open) dialog.showModal(); document.getElementById('player-submit').disabled = true; };
      document.getElementById('header-login').addEventListener('click',showError);
      document.getElementById('header-register').addEventListener('click',showError);
      document.getElementById('leaderboard-join').addEventListener('click',showError);
    })
    .finally(() => clearTimeout(timer));
})();
