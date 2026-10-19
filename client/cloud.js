(function (root) {
  'use strict';
  const $ = id => document.getElementById(id), Game = root.SeptandaGame, Daily = root.SeptandaDaily;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hasProgress = state => !!state && (Object.values(state.days || {}).some(day => day.seen?.length) || [state.legacy?.progress || {}, ...Object.values(state.days || {}).map(day => day.progress || {})].some(progress => Object.values(progress).some(round => round.attempts?.length || round.hints?.length || round.draft || round.status !== 'playing')));
  let sdk, config, session = null, profile = null, mode = 'login', signing = false, ready = false, syncing = false, pending = false, applying = false, timer, lastSynced = '', loadEpoch = 0, adminOffset = 0, authAction = false;
  const endpoint = name => '/.netlify/functions/' + name;
  const date = value => value ? new Intl.DateTimeFormat('cs-CZ', {dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '—';
  function open(id) { if (!$(id).open) $(id).showModal(); }
  function stateSignature(state = Game.exportState()) { return JSON.stringify(state); }
  function notice(message) { $('cloud-status').textContent = message; }
  function translate(error) {
    const message = error?.message || String(error || '');
    if (/invalid login credentials/i.test(message)) return 'E-mail nebo heslo nesouhlasí.';
    if (/email not confirmed/i.test(message)) return 'Nejdřív potvrď e-mail odkazem ve zprávě.';
    if (/rate limit|too many requests/i.test(message)) return 'Příliš mnoho pokusů. Zkus to prosím za chvíli.';
    if (/failed to fetch|network|abort/i.test(message)) return 'Spojení se nepodařilo. Rozehraná hra zůstává v tomto prohlížeči.';
    if (/password.*(weak|least)|weak.*password/i.test(message)) return 'Zvol silnější heslo, alespoň 10 znaků.';
    return message || 'Požadavek se nepodařilo dokončit.';
  }
  async function api(name, body, options = {}) {
    const token = session?.access_token, requestUser = session?.user.id;
    if (options.required !== false && !token) throw new Error('Pro tuto akci se přihlas.');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint(name), {method:body ? 'POST' : 'GET', cache:'no-store', credentials:'same-origin', headers:{...(token ? {Authorization:'Bearer ' + token} : {}), ...(body ? {'Content-Type':'application/json'} : {})}, ...(body ? {body:JSON.stringify(body)} : {}), signal:controller.signal});
      let result; try { result = await response.json(); } catch (_) { throw new Error('Ukládání je teď nedostupné. Zkus to později.'); }
      if (!response.ok) throw Object.assign(new Error(result.error || 'Požadavek se nepodařil.'), {status:response.status});
      if (options.required !== false && session?.user.id !== requestUser) throw new Error('Účet se mezitím změnil. Otevři přehled znovu.');
      return result;
    } finally { clearTimeout(timeout); }
  }
  function setMode(next) {
    mode = next;
    $('signup-confirmation').hidden = true; $('signup-email').textContent = '';
    $('account-mode-tabs').hidden = false; $('player-form').hidden = false;
    const registration = mode === 'register', reset = mode === 'reset';
    $('player-title').textContent = registration ? 'Ulož si svou cestu.' : reset ? 'Obnov přístup.' : 'Přihlas se do hry.';
    $('mode-login').setAttribute('aria-pressed', String(mode === 'login'));
    $('mode-register').setAttribute('aria-pressed', String(registration));
    $('player-name-field').hidden = !registration; $('player-name').disabled = !registration; $('player-name').required = false;
    $('player-name-field').querySelector('label').textContent = 'Přezdívka v žebříčku (nepovinná)';
    $('registration-email').hidden = false; $('player-email').disabled = false; $('player-email').required = true;
    $('player-password-field').hidden = reset; $('player-password').disabled = reset; $('player-password').required = !reset;
    $('player-password').autocomplete = registration ? 'new-password' : 'current-password';
    $('registration-consent').hidden = !registration; $('marketing-opt-in').disabled = !registration;
    $('marketing-opt-in').checked = false;
    $('player-forgot').hidden = registration || reset;
    $('player-help').textContent = registration ? 'Hrát můžeš bez účtu. Účet ti umožní uložit postup a pokračovat na dalším zařízení. Přidání místní hry potvrdíš po přihlášení.' : reset ? 'Pošleme ti odkaz pro nastavení nového hesla.' : 'Přihlas se e-mailem a heslem. Soukromé tipy a rozepsaná hra zůstanou u tvého účtu.';
    $('player-submit').textContent = registration ? 'Vytvořit účet' : reset ? 'Poslat odkaz na e-mail' : 'Přihlásit se';
    $('player-message').textContent = '';
  }
  function openPlayer(next = 'login') { setMode(next); open('player-dialog'); }
  function showConfirmation(email) {
    $('player-title').textContent = 'Teď potvrď svůj e-mail.';
    $('signup-email').textContent = email;
    $('account-mode-tabs').hidden = true; $('player-form').hidden = true;
    $('signup-confirmation').hidden = false;
    $('player-dialog').scrollTop = 0;
    $('signup-confirmation').focus?.();
  }
  function renderAccount() {
    const account = profile?.account;
    $('header-login').hidden = !!account; $('header-register').hidden = !!account; $('header-profile').hidden = !account;
    $('header-player-name').textContent = account?.name || ''; $('header-account-label').textContent = 'Můj účet';
    $('leaderboard-join').textContent = account ? 'Můj účet' : 'Uložit postup';
    $('header-profile').setAttribute('aria-label', account ? 'Můj účet: ' + account.name : 'Můj účet');
    $('profile-admin').hidden = !profile?.admin;
    $('profile-pending-export').hidden = !Game.pendingBackup?.();
    if (!account) return;
    $('profile-title').textContent = 'Můj účet.'; $('profile-name').textContent = account.name;
    $('profile-display-name').value = account.name; $('profile-email').value = account.email || '';
    $('profile-email-help').textContent = account.emailConfirmed ? 'E-mail je potvrzený a neveřejný. Slouží k přihlášení a obnovení přístupu.' : 'E-mail ještě čeká na potvrzení odkazem ve zprávě.';
    $('profile-marketing-opt-in').checked = !!profile.consent?.granted;
    $('profile-consent-text').textContent = config.consent.text;
    const consent = profile.consent;
    $('profile-consent-status').textContent = consent?.granted ? (consent.active ? 'Souhlas je aktivní.' : 'Souhlas čeká na potvrzení e-mailu.') + ' Uděleno: ' + date(consent.grantedAt) : consent?.withdrawnAt ? 'Souhlas odvolán: ' + date(consent.withdrawnAt) : 'Novinky nejsou přihlášené.';
    $('cloud-import').hidden = !hasProgress(Game.guestState());
  }
  function apply(result, replace) {
    profile = result;
    if (replace && result.state) {
      applying = true; Game.replaceState(result.state); applying = false;
      lastSynced = stateSignature();
    }
    renderAccount();
  }
  function scheduleSync() {
    if (applying || !ready || !session || !profile) return;
    clearTimeout(timer); timer = setTimeout(() => sync(), 700);
  }
  function resume() {
    // A failed initial profile request must be retried after reconnecting as well.
    if (session && (!ready || !profile)) return loadAccount(session);
    if (session) sync(true);
    refreshBoard();
  }
  async function sync(force = false, importState = null) {
    if (!ready || !session || !profile) return;
    if (syncing) { pending = true; return; }
    const snapshot = importState || Game.exportState(), signature = JSON.stringify(snapshot);
    if (!force && signature === lastSynced) return;
    const userId = session.user.id, epoch = loadEpoch;
    syncing = true; notice('Ukládání postupu…');
    try {
      const result = await api('player', {action:'sync',state:snapshot,...(importState ? {importLegacy:true} : {})});
      if (epoch !== loadEpoch || session?.user.id !== userId) return;
      const unchanged = stateSignature() === (importState ? stateSignatureAtImport : signature);
      apply(result, unchanged);
      if (unchanged) { lastSynced = stateSignature(); notice('Postup je uložený v účtu.'); }
      else { pending = true; notice('Dokončuji ukládání dalších tipů…'); }
      refreshBoard();
      return true;
    } catch (error) {
      notice('Postup je zatím uložený v tomto prohlížeči. ' + translate(error));
      if (error.status === 401) { ready = false; notice('Přihlášení vypršelo. Pro obnovení synchronizace se znovu přihlas.'); }
      if (importState) throw error;
      return false;
    } finally {
      syncing = false;
      if (pending) { pending = false; scheduleSync(); }
    }
  }
  let stateSignatureAtImport = '';
  async function loadAccount(nextSession) {
    const epoch = ++loadEpoch;
    const previousId = session?.user.id;
    session = nextSession; ready = false; clearTimeout(timer); lastSynced = '';
    if (previousId && previousId !== nextSession?.user.id) {
      profile = null; applying = true; Game.setAccount(null, {importGuest:false}); applying = false;
      $('profile-dialog').close(); $('admin-dialog').close(); $('admin-users').replaceChildren(); $('admin-audit-list').replaceChildren(); renderAccount();
    }
    if (!session) {
      applying = true; Game.setAccount(null, {importGuest:false}); applying = false; profile = null;
      $('profile-dialog').close(); $('admin-dialog').close(); $('admin-users').replaceChildren(); $('admin-audit-list').replaceChildren(); renderAccount(); refreshBoard(); return;
    }
    try {
      const result = await api('player');
      if (epoch !== loadEpoch || session?.user.id !== nextSession.user.id) return;
      applying = true; Game.setAccount(result.account.id, {importGuest:false}); applying = false;
      const cached = Game.exportState();
      let pendingBackup=false;
      if(Daily.mergeForSync && result.state) {
        const merged=Daily.mergeForSync(result.state,cached);
        pendingBackup=merged.backupRequired;
        if(pendingBackup)Game.backupPending?.(cached);
        apply({...result,state:merged.state},true);
      } else apply(result, !hasProgress(cached));
      ready = true;
      $('player-dialog').close();
      notice(result.state ? 'Postup je propojený s účtem.' : 'Účet je připravený. Nové hry se budou ukládat.');
      if (hasProgress(cached)) await sync(true);
      if(pendingBackup)notice('Na jiném zařízení je už uložená odlišná sada. Místní tipy máš zachované v záloze ke stažení v Můj účet.');
      // Prázdný nový účet se neodesílá: hráč může nejprve výslovně přidat starý postup.
      refreshBoard();
    } catch (error) {
      notice(translate(error)); $('leaderboard-status').textContent = translate(error);
      $('player-message').textContent = 'Přihlášení proběhlo, ale účet se nepodařilo načíst. Zkus obnovit stránku. ' + translate(error);
    }
  }
  async function refreshBoard() {
    $('leaderboard-refresh').disabled = true;
    try {
      const result = await api('cloud-leaderboard', null, {required:false});
      $('leaderboard-date').textContent = new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'numeric'}).format(new Date(result.date+'T12:00:00Z'));
      const rows = entries => '<ol class="leaderboard-list">' + entries.map(item => '<li class="leaderboard-row ' + (item.id === profile?.account.id ? 'is-you' : '') + '"><span class="place">' + esc(item.rank) + '.</span><span class="player">' + esc(item.name) + (item.id === profile?.account.id ? '<span class="you">ty</span>' : '') + '</span><strong class="points">' + esc(item.points) + ' <span class="small">b.</span></strong></li>').join('') + '</ol>';
      let preview = result.entries.slice(0,5), full = result.entries.slice();
      if (result.me && !preview.some(item => item.id === result.me.id)) preview = [...preview.slice(0,4), result.me];
      if (result.me && !full.some(item => item.id === result.me.id)) full.push(result.me);
      const empty = '<p class="leaderboard-empty">Dnes tu ještě nikdo nehraje.</p>';
      $('leaderboard-preview').innerHTML = preview.length ? rows(preview) : empty;
      $('leaderboard-table').innerHTML = full.length ? rows(full) : empty;
      $('leaderboard-status').textContent = '';
    } catch (error) { $('leaderboard-status').textContent = translate(error); $('leaderboard-preview').innerHTML = '<p class="leaderboard-empty">Pořadí teď není dostupné.</p>'; }
    finally { $('leaderboard-refresh').disabled = false; }
  }
  async function loadAdmin() {
    if (!profile?.admin) return;
    $('admin-status').textContent = 'Načítání hráčů…';
    $('admin-audit').hidden = true; $('admin-audit-list').replaceChildren();
    try {
      const result = await api('admin-users?filter=' + encodeURIComponent($('admin-filter').value) + '&limit=50&offset=' + adminOffset);
      if (!profile?.admin || !$('admin-dialog').open) return;
      $('admin-status').textContent = result.total ? (adminOffset + 1) + '–' + Math.min(adminOffset + result.users.length,result.total) + ' z ' + result.total + ' hráčů' : 'Žádné odpovídající účty.';
      $('admin-users').innerHTML = result.users.map(user => '<article class="admin-user"><div><strong>' + esc(user.name) + '</strong><span>' + esc(user.email) + '</span><small>' + (user.emailConfirmed ? 'E-mail potvrzen' : 'E-mail nepotvrzen') + ' · Registrace ' + esc(date(user.createdAt)) + '</small></div><div><span>' + esc(user.stats?.solved || 0) + ' rozluštěno</span><span>' + (user.consent?.active ? 'Novinky: ano' : 'Novinky: ne') + '</span><button class="text-button underlined" data-consent-user="' + esc(user.id) + '">Historie souhlasu</button></div></article>').join('');
      $('admin-previous').disabled = adminOffset === 0; $('admin-next').disabled = adminOffset + 50 >= result.total;
    } catch (error) { $('admin-users').replaceChildren(); $('admin-status').textContent = translate(error); }
  }
  function redirectUrl(recovery = false) { const url = new URL(location.pathname, location.origin); if (recovery) url.searchParams.set('account','recovery'); return url.href; }
  async function start(runtimeConfig) {
    config = runtimeConfig;
    if (!root.SeptandaSupabase?.createClient) throw new Error('Knihovna přihlášení se nenačetla. Obnov stránku.');
    $('marketing-consent-text').textContent = config.consent.text;
    $('profile-marketing').hidden = false; $('profile-name-edit').hidden = false; $('profile-display-name').required = true;
    $('profile-email').readOnly = true; $('profile-password-field').hidden = true; $('profile-password').required = false; $('profile-password').disabled = true;
    $('profile-submit').textContent = 'Uložit přezdívku'; $('profile-sync').hidden = false; $('profile-file-import').hidden = false;
    sdk = root.SeptandaSupabase.createClient(config.supabase.url, config.supabase.publishableKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    $('mode-login').addEventListener('click', () => setMode('login')); $('mode-register').addEventListener('click', () => setMode('register'));
    $('signup-login').addEventListener('click', () => setMode('login'));
    $('header-login').addEventListener('click', () => openPlayer()); $('header-register').addEventListener('click', () => openPlayer('register'));
    const showProfile = () => { renderAccount(); open('profile-dialog'); };
    $('header-profile').addEventListener('click', showProfile); $('leaderboard-join').addEventListener('click', () => profile ? showProfile() : openPlayer('register'));
    $('leaderboard-refresh').addEventListener('click', refreshBoard); $('player-forgot').addEventListener('click', () => setMode('reset'));
    $('player-form').addEventListener('submit', async event => {
      event.preventDefault(); if (signing) return;
      signing = true; authAction = true; $('player-submit').disabled = true; $('player-message').textContent = '';
      try {
        const email = $('player-email').value.trim(), password = $('player-password').value;
        if (mode === 'reset') {
          const {error} = await sdk.auth.resetPasswordForEmail(email, {redirectTo:redirectUrl(true)}); if (error) throw error;
          $('player-message').textContent = 'Pokud je k e-mailu účet přiřazený, přijde odkaz pro obnovení přístupu. Zkontroluj i nevyžádanou poštu.';
        } else {
          const result = mode === 'register' ? await sdk.auth.signUp({email,password,options:{emailRedirectTo:redirectUrl(),data:{display_name:$('player-name').value.trim() || 'Hráč ' + Math.random().toString(36).slice(2,6),marketing_opt_in:$('marketing-opt-in').checked,marketing_consent_version:config.consent.version}}}) : await sdk.auth.signInWithPassword({email,password});
          if (result.error) throw result.error;
          $('player-password').value = '';
          if (result.data.session) await loadAccount(result.data.session);
          else showConfirmation(email);
        }
      } catch (error) { $('player-message').textContent = translate(error); }
      finally { signing = false; authAction = false; $('player-submit').disabled = false; }
    });
    $('profile-form').addEventListener('submit', async event => {
      event.preventDefault(); $('profile-submit').disabled = true; $('profile-message').textContent = '';
      try { apply(await api('player', {action:'profile',name:$('profile-display-name').value}), false); $('profile-message').textContent = 'Přezdívka je uložená.'; refreshBoard(); }
      catch (error) { $('profile-message').textContent = translate(error); }
      finally { $('profile-submit').disabled = false; }
    });
    $('profile-consent-save').addEventListener('click', async () => {
      $('profile-consent-save').disabled = true; $('consent-message').textContent = '';
      try { apply(await api('player', {action:'consent',granted:$('profile-marketing-opt-in').checked}), false); $('consent-message').textContent = profile.consent.granted ? 'Volba je uložená.' : 'Souhlas je odvolaný. Novinky nebudeme posílat.'; }
      catch (error) { $('consent-message').textContent = translate(error); }
      finally { $('profile-consent-save').disabled = false; }
    });
    $('profile-sync').addEventListener('click', () => sync(true));
    $('profile-pending-export').addEventListener('click',()=>{
      const state=Game.pendingBackup?.();if(!state)return;
      const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='septanda-zaloha-mistnich-tipu.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    $('cloud-import-button').addEventListener('click', async () => {
      const guest = Game.guestState(); if (!hasProgress(guest)) return;
      $('cloud-import-button').disabled = true; $('import-message').textContent = '';
      try { await importLocalState(guest); $('import-message').textContent = 'Místní postup je přidaný do účtu. Původní hra v prohlížeči zůstala zachovaná.'; }
      catch (error) { $('import-message').textContent = translate(error); }
      finally { $('cloud-import-button').disabled = false; }
    });
    $('profile-logout').addEventListener('click', async () => {
      if (syncing) { notice('Nejdřív se dokončí ukládání. Zkus odhlášení za chvíli.'); return; }
      $('profile-logout').disabled = true;
      try {
        const signature = stateSignature();
        if (signature !== lastSynced) await sync(true); // Případný neodeslaný postup zůstává v soukromé místní složce účtu.
        const {error} = await sdk.auth.signOut({scope:'local'}); if (error) throw error; await loadAccount(null);
      } catch (error) { notice(translate(error)); }
      finally { $('profile-logout').disabled = false; }
    });
    $('profile-admin').addEventListener('click', () => { if (!profile?.admin) return; adminOffset = 0; open('admin-dialog'); loadAdmin(); });
    $('admin-filter').addEventListener('change', () => { adminOffset = 0; loadAdmin(); }); $('admin-refresh').addEventListener('click', loadAdmin);
    $('admin-previous').addEventListener('click', () => { adminOffset = Math.max(0,adminOffset - 50); loadAdmin(); }); $('admin-next').addEventListener('click', () => { adminOffset += 50; loadAdmin(); });
    $('admin-users').addEventListener('click', async event => {
      const id = event.target.closest('[data-consent-user]')?.dataset.consentUser; if (!id || !profile?.admin) return;
      try { const result = await api('admin-users?user=' + encodeURIComponent(id)); if (!profile?.admin || !$('admin-dialog').open) return; $('admin-audit-list').innerHTML = '<p>' + esc(result.user.email) + '</p>' + (result.consentEvents.length ? result.consentEvents.map(item => '<article class="consent-audit"><strong>' + (item.granted ? 'Udělen' : 'Odvolán') + ' · ' + esc(date(item.recordedAt)) + '</strong><small>Verze ' + esc(item.version) + ' · ' + esc(item.source) + '</small><p>' + esc(item.text) + '</p></article>').join('') : '<p>Žádný souhlas nebyl zaznamenán.</p>'); $('admin-audit').hidden = false; }
      catch (error) { $('admin-status').textContent = translate(error); }
    });
    $('admin-dialog').addEventListener('close', () => { $('admin-users').replaceChildren(); $('admin-audit-list').replaceChildren(); });
    $('recovery-form').addEventListener('submit', async event => {
      event.preventDefault(); $('recovery-message').textContent = '';
      if ($('recovery-password').value !== $('recovery-password-again').value) { $('recovery-message').textContent = 'Hesla se neshodují.'; return; }
      $('recovery-submit').disabled = true;
      try { const {error} = await sdk.auth.updateUser({password:$('recovery-password').value}); if (error) throw error; $('recovery-password').value = ''; $('recovery-password-again').value = ''; $('recovery-dialog').close(); history.replaceState(null,'',location.pathname); notice('Nové heslo je uložené.'); }
      catch (error) { $('recovery-message').textContent = translate(error); }
      finally { $('recovery-submit').disabled = false; }
    });
    $('player-dialog').addEventListener('close', () => { $('player-password').value = ''; });
    $('recovery-dialog').addEventListener('close', () => { $('recovery-password').value = ''; $('recovery-password-again').value = ''; });
    document.addEventListener('septanda:progress', scheduleSync);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
    setInterval(() => { if (!document.hidden) resume(); },60000);
    sdk.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setTimeout(() => open('recovery-dialog'),0);
      if (authAction) return;
      if (event === 'TOKEN_REFRESHED' && nextSession?.user.id === session?.user.id) { session = nextSession; if (!ready) setTimeout(resume,0); return; }
      if (event === 'SIGNED_IN' && nextSession?.user.id === session?.user.id && ready) { session = nextSession; return; }
      setTimeout(() => loadAccount(nextSession),0);
    });
    const {data,error} = await sdk.auth.getSession();
    if (error) throw error;
    // INITIAL_SESSION already runs the same transition; this explicit call covers SDKs that emit it before registration.
    if (data.session && !session) await loadAccount(data.session);
    else if (!data.session) renderAccount();
    if (new URL(location.href).searchParams.get('account') === 'recovery' && data.session) open('recovery-dialog');
    setMode('login'); refreshBoard();
  }
  async function importLocalState(incoming) {
    if (!ready || !profile || !session) throw new Error('Nejdřív se přihlas k účtu, do kterého chceš postup přidat.');
    if (syncing) throw new Error('Nejdřív se dokončí synchronizace. Zkus to za chvíli.');
    const clean = Daily.sanitizeState(incoming);
    if (!clean || !hasProgress(clean)) throw new Error('Soubor neobsahuje herní postup k přidání.');
    const userId = session.user.id;
    // Nejprve uložíme vlastní případné nové tipy; prázdná kostra účtu se neodesílá.
    if (hasProgress(Game.exportState())) {
      let flushed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!(await sync(true))) throw new Error('Nejdřív se musí podařit uložit současný postup účtu. Místní hra zůstala zachovaná.');
        if (stateSignature() === lastSynced) { flushed = true; break; }
      }
      if (!flushed) throw new Error('Postup se právě mění. Počkej na dokončení ukládání a zkus import znovu.');
    }
    if (session?.user.id !== userId) throw new Error('Účet se mezitím změnil. Vyber soubor znovu.');
    stateSignatureAtImport = stateSignature();
    if (!(await sync(true, clean))) throw new Error('Přenos se nedokončil. Zkus ho prosím znovu.');
    return true;
  }
  root.SeptandaCloud = Object.freeze({start,importLocalState});
})(globalThis);
