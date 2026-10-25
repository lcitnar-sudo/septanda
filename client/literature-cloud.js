(function(root){
  'use strict';
  const $=id=>document.getElementById(id),Game=root.SeptandaLiteraryGame;
  let sdk,config,session=null,account=null,ready=false,epoch=0,authMode='login',signing=false,commands=Promise.resolve();
  function translate(error){
    const text=error?.message||'';
    if(/invalid login credentials/i.test(text))return 'E-mail nebo heslo nesouhlasí.';
    if(/email not confirmed/i.test(text))return 'Nejdřív potvrď e-mail odkazem ve zprávě.';
    if(/rate limit|too many/i.test(text))return 'Příliš mnoho pokusů. Zkus to za chvíli.';
    if(/failed to fetch|network|abort/i.test(text))return 'Spojení je teď nedostupné. Rozepsaná odpověď zůstává v tomto prohlížeči.';
    if(/password.*(weak|least)/i.test(text))return 'Zvol silnější heslo, alespoň 10 znaků.';
    return text||'Požadavek se nepodařilo dokončit.';
  }
  function status(text,error=false){$('lit-sync-status').textContent=text;$('lit-account-status').textContent=text;$('reading-loading-status').textContent=text;$('lit-reconnect').hidden=!error||!session;$('reading-reconnect').hidden=!error||!session;$('reading-account').hidden=!session;}
  function closeLogin(){const opened=$('lit-auth').open;$('lit-password').value='';if(opened)$('lit-auth').close();return opened;}
  function show(id){document.querySelector('dialog[open]')?.close();$(id).showModal();}
  function renderAccount(){
    const signed=!!session;
    $('lit-login').hidden=signed;$('lit-register').hidden=signed;$('lit-profile').hidden=!signed;
    $('lit-profile').textContent=account?.name||'Můj účet';$('lit-profile').setAttribute('aria-label','Můj účet'+(account?.name?': '+account.name:''));
    $('lit-account-name').textContent=account?.name||'Tvůj účet v Šeptandě';$('lit-account-email').textContent=account?.email||'';
    const guest=Game.guestState();$('lit-import-section').hidden=!guest||!Object.values(guest.rounds).some(r=>r.attempts.length||r.hints||r.draft||r.status!=='playing');
  }
  function mode(next){
    authMode=next;const register=next==='register',reset=next==='reset';
    $('lit-auth-title').textContent=register?'Ulož si své čtení.':reset?'Obnov přístup.':'Přihlas se a čti dál.';
    $('lit-auth-intro').textContent=register?'Účet uchová tvoje čtení i na jiném zařízení. Hrát můžeš i bez registrace.':reset?'Pošleme ti odkaz pro nastavení nového hesla.':'Přihlas se e-mailem a heslem. Tvé čtení a knihovnička zůstanou uložené.';
    $('lit-auth-tabs').hidden=false;$('lit-auth-form').hidden=false;$('lit-confirmation').hidden=true;
    for(const b of $('lit-auth-tabs').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.auth===next));
    $('lit-name-field').hidden=!register;$('lit-consent-field').hidden=!register;$('lit-consent').checked=false;
    $('lit-password-field').hidden=reset;$('lit-password').disabled=reset;$('lit-password').required=!reset;
    $('lit-password').minLength=register?10:1;$('lit-password').autocomplete=register?'new-password':'current-password';
    $('lit-auth-submit').textContent=register?'Vytvořit účet':reset?'Poslat odkaz na e-mail':'Přihlásit se';
    $('lit-forgot').hidden=register||reset;$('lit-auth-message').hidden=true;
  }
  async function request(action,fields={}){
    const token=session?.access_token,id=session?.user.id,requestEpoch=epoch;
    if(!token)throw Error('Nejdřív se přihlas.');
    const response=await fetch('/.netlify/functions/literature-player',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,...fields}),signal:AbortSignal.timeout(15000)});
    let reply;try{reply=await response.json();}catch{throw Error('Ukládání do účtu je teď nedostupné.');}
    if(epoch!==requestEpoch || session?.user.id!==id)throw Error('Účet se mezitím změnil.');
    if(!response.ok)throw Error(reply.error||'Ukládání do účtu je teď nedostupné.');
    return reply;
  }
  async function command(action,fields={}){
    const id=session?.user.id,requestEpoch=epoch;
    const run=async()=>{
      if(!ready||!id||id!==session?.user.id||epoch!==requestEpoch)throw Error('Nejdřív počkej na načtení uloženého čtení.');
      status('Ukládám čtení do účtu…');
      try{const reply=await request(action,fields);status('Čtení je uložené v účtu.');return reply;}
      catch(error){if(epoch===requestEpoch)status(translate(error),true);throw error;}
    };
    commands=commands.then(run,run);return commands;
  }
  async function load(next){
    const loadEpoch=++epoch;ready=false;session=next;account=null;Game.pause(true);renderAccount();
    if(!next){closeLogin();$('lit-account').close();await Game.setIdentity(null);if(epoch!==loadEpoch)return;Game.pause(false);status('Uloženo v tomto prohlížeči. Přihlášením si čtení uchováš.');return;}
    const focus=closeLogin();Game.pause(true);status('Načítám uložené čtení…');
    try{
      const reply=await request('daily');if(epoch!==loadEpoch)return;
      account=reply.account;ready=true;await Game.setIdentity(next.user.id,reply.state);
      if(epoch!==loadEpoch)return;renderAccount();Game.pause(false);status('Čtení je uložené v účtu.');if(focus)Game.focus();
      Game.flushDrafts().catch(error=>{if(epoch===loadEpoch)status(translate(error),true);});
    }catch(error){if(epoch===loadEpoch){Game.pause(true);renderAccount();status('Jsi přihlášený. '+translate(error)+' Zkus znovu připojit uložené čtení.',true);}}
  }
  async function refresh(){
    if(!session)return;
    if(!ready)return load(session);
    try{await Game.flushDrafts();const reply=await command('daily');await Game.apply(reply.state);}
    catch(error){status(translate(error),true);}
  }
  root.SeptandaLiteratureCloud={signedIn:()=>!!session,command};
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-auth]');if(!button)return;const action=button.dataset.auth;
    try{
      if(['login','register','reset'].includes(action)){mode(action);show('lit-auth');return;}
      if(action==='profile'){renderAccount();show('lit-account');return;}
      if(action==='reconnect'){await refresh();return;}
      if(action==='import'){
        button.disabled=true;try{const guest=Game.guestState();if(guest){await Game.flushDrafts();const reply=await command('import',{state:guest});await Game.apply(reply.state);status('Místní čtení je přidané. Dříve uložené výsledky zůstaly zachované.');}}finally{button.disabled=false;}
      }
      if(action==='logout'){
        try{await Game.flushDrafts();}catch{}await commands.catch(()=>{});
        const {error}=await sdk.auth.signOut({scope:'local'});if(error)throw error;await load(null);
      }
    }catch(error){if($('lit-auth').open){$('lit-auth-message').hidden=false;$('lit-auth-message').textContent=translate(error);}else status(translate(error),true);}
  });
  $('lit-auth-form').addEventListener('submit',async event=>{
    event.preventDefault();if(signing)return;
    if(!sdk){$('lit-auth-message').hidden=false;$('lit-auth-message').textContent='Přihlášení se zatím nepodařilo připojit. Obnov stránku a zkus to znovu.';return;}
    signing=true;$('lit-auth-submit').disabled=true;$('lit-auth-message').hidden=true;
    try{
      const email=$('lit-email').value.trim(),password=$('lit-password').value;
      if(authMode==='reset'){
        const url=new URL('/',location.origin);url.searchParams.set('account','recovery');
        const {error}=await sdk.auth.resetPasswordForEmail(email,{redirectTo:url.href});if(error)throw error;
        $('lit-auth-message').hidden=false;$('lit-auth-message').textContent='Pokud k e-mailu existuje účet, přijde odkaz pro obnovení přístupu. Zkontroluj i spam.';
      }else{
        const result=authMode==='register'?await sdk.auth.signUp({email,password,options:{emailRedirectTo:new URL('/',location.origin).href,data:{display_name:$('lit-name').value.trim()||'Hráč '+crypto.randomUUID().slice(0,4),marketing_opt_in:$('lit-consent').checked,marketing_consent_version:config.consent.version}}}):await sdk.auth.signInWithPassword({email,password});
        if(result.error)throw result.error;$('lit-password').value='';
        if(result.data.session)await load(result.data.session);
        else{$('lit-auth-title').textContent='Teď potvrď svůj e-mail.';$('lit-auth-form').hidden=true;$('lit-auth-tabs').hidden=true;$('lit-confirmation').hidden=false;$('lit-confirmation').focus();}
      }
    }catch(error){$('lit-auth-message').hidden=false;$('lit-auth-message').textContent=translate(error);}
    finally{signing=false;$('lit-auth-submit').disabled=false;}
  });
  $('lit-auth').addEventListener('close',()=>{$('lit-password').value='';});
  $('lit-recovery').addEventListener('close',()=>{$('lit-new-password').value='';$('lit-new-password-again').value='';});
  $('lit-recovery-form').addEventListener('submit',async event=>{
    event.preventDefault();const message=$('lit-recovery-message');message.hidden=false;
    const password=$('lit-new-password').value;
    if(password!==$('lit-new-password-again').value){message.textContent='Hesla se neshodují.';return;}
    if(password.length<10){message.textContent='Zvol alespoň 10 znaků.';return;}
    if(!sdk||!session){message.textContent='Odkaz pro obnovu už není platný. Požádej o nový přes Zapomenuté heslo.';return;}
    $('lit-recovery-submit').disabled=true;
    try{const {error}=await sdk.auth.updateUser({password});if(error)throw error;
      $('lit-new-password').value='';$('lit-new-password-again').value='';$('lit-recovery').close();
      history.replaceState(null,'',location.pathname||'/');status('Nové heslo je uložené. Můžeš pokračovat ve čtení.');
    }catch(error){message.textContent=translate(error);}finally{$('lit-recovery-submit').disabled=false;}
  });
  async function start(){
    Game.pause(true);status('Ověřuji přihlášení…');
    try{
      const response=await fetch('/.netlify/functions/runtime-config',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Přihlášení je teď nedostupné.');config=await response.json();
      if(!config.configured||!config.supabase)throw Error('Přihlášení je teď nedostupné.');
      $('lit-consent-text').textContent=config.consent.text;
      sdk=root.SeptandaSupabase.createClient(config.supabase.url,config.supabase.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      sdk.auth.onAuthStateChange((event,next)=>{
        if(event==='PASSWORD_RECOVERY')setTimeout(()=>show('lit-recovery'),0);
        if(signing)return;
        if(next?.user.id===session?.user.id && ready){session=next;if(event==='SIGNED_IN' && closeLogin())Game.focus();return;}
        if(event==='INITIAL_SESSION')return;
        setTimeout(()=>load(next),0);
      });
      const {data,error}=await sdk.auth.getSession();if(error)throw error;await load(data.session);
      if(new URL(location.href||'/',location.origin).searchParams.get('account')==='recovery'){if(data.session)show('lit-recovery');else{mode('reset');show('lit-auth');$('lit-auth-message').hidden=false;$('lit-auth-message').textContent='Odkaz pro obnovu už není platný. Požádej o nový odkaz.';}}
    }catch(error){await Game.setIdentity(null);Game.pause(false);status('Hraješ bez účtu. '+translate(error));}
  }
  addEventListener('online',refresh);
  addEventListener('focus',()=>{if(ready)refresh();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)Game.flushDrafts().catch(()=>{});});
  start();
})(globalThis);
