(function () {
  'use strict';
  const allPuzzles = globalThis.SEPTANDA_PUZZLES, engine = globalThis.SeptandaEngine, Daily = globalThis.SeptandaDaily, Guidance=globalThis.SeptandaGuidance;
  const GUEST_KEY = 'septanda.v6.daily';
  let KEY = GUEST_KEY;
  const LEGACY_KEY = 'septanda.v5.progress', INITIAL = 100, COST = {clue: 50};
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0');
  const plural = (n, one, few, many) => n === 1 ? one : n >= 2 && n <= 4 ? few : many;
  const blankRound = Daily.blankRound;
  let memoryOnly = false, state = Daily.createState(null), confirmTask = null;
  let day, activeDate, puzzles = [];
  function activateDay() {
    activeDate = Daily.dayKey();
    day = Daily.ensureDay(state, activeDate,{personal:true,playerId:KEY===GUEST_KEY?null:KEY.split('.account.')[1]});
    puzzles = day.ids.map(id => allPuzzles.find(p => p.id === id));
  }
  function read() {
    if (!memoryOnly) {
      try {
        const stored = localStorage.getItem(KEY);
        if (stored) state = Daily.sanitizeState(JSON.parse(stored)) || state;
        else {
          const legacy = KEY === GUEST_KEY ? localStorage.getItem(LEGACY_KEY) : null;
          state = Daily.createState(legacy ? JSON.parse(legacy) : null);
        }
      } catch (_) { memoryOnly = true; $('storage-warning').hidden = false; }
    }
    activateDay();
  }
  function save() {
    if (memoryOnly) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_) { memoryOnly = true; $('storage-warning').hidden = false; }
  }
  function setAccount(id, options = {}) {
    if (typeof id === 'string') id = id.toLowerCase().replace(/-/g, '');
    if (id !== null && !/^[a-f0-9]{32}$/.test(id)) return false;
    const nextKey = id ? GUEST_KEY + '.account.' + id : GUEST_KEY;
    if (nextKey === KEY) return;
    storeDraft();
    try {
      if (id && options.importGuest !== false && !localStorage.getItem('septanda.account-imported')) {
        const guest = localStorage.getItem(GUEST_KEY);
        if (guest && !localStorage.getItem(nextKey)) localStorage.setItem(nextKey, guest);
        localStorage.setItem('septanda.account-imported', id);
      }
    } catch (_) { memoryOnly = true; $('storage-warning').hidden = false; }
    KEY = nextKey; state = Daily.createState(null); read(); save();
    $('form-message').textContent = ''; render();
  }
  function roundFor(id = day.selected) { return Daily.roundFor(day, id); }
  function currentPuzzle() { return puzzles.find(p => p.id === day.selected); }
  function totals() { return Daily.totals(state); }
  function hasAccount() { return KEY !== GUEST_KEY; }
  function announce(text) { $('announcement').textContent = text; }
  function openDialog(id) { if (id === 'stats-dialog' && !hasAccount()) return; const dialog = $(id); if (dialog && !dialog.open) dialog.showModal(); }
  function ask(title, copy, actionText, callback) {
    $('confirm-title').textContent = title; $('confirm-copy').textContent = copy;
    $('confirm-action').textContent = actionText; confirmTask = callback; openDialog('confirm-dialog');
  }
  function renderCollection() {
    $('collection-date').textContent = Daily.displayDate(activeDate);
    $('collection-list').innerHTML = puzzles.map((p, i) => {
      const r = day.progress[p.id] || blankRound(), unlocked = Daily.canSelect(day, p.id);
      const status = day.skipped.includes(p.id) ? 'Už znáš z dřívějška' : !unlocked ? 'Zatím zamčeno' : r.status === 'won' ? 'Rozluštěno' : r.status === 'revealed' ? 'Odhaleno' : r.attempts.length ? `${r.attempts.length} ${plural(r.attempts.length, 'pokus', 'pokusy', 'pokusů')}` : 'Připraveno';
      return `<button class="collection-item" data-select="${p.id}" aria-current="${p.id === day.selected}" ${unlocked ? '' : 'disabled'}><span class="number">${pad(i + 1)}</span><span><strong>${escape(p.category)}</strong><small>${escape(p.era)}</small></span><span class="status">${status}</span></button>`;
    }).join('') || '<p class="muted">Další nové zprávy připravujeme. Staré hádanky znovu nenasazujeme.</p>';
  }
  function archiveGroup(title, ids, progress) {
    const records = ids.filter(id => { const r = progress[id]; return r && (r.attempts.length || r.hints.length || r.draft || r.status !== 'playing'); });
    if (!records.length) return '';
    return `<section class="archive-group"><h3>${escape(title)}</h3>${records.map(id => {
      const p = allPuzzles.find(p => p.id === id), r = progress[id];
      return `<details class="archive-round"><summary>${escape(r.status === 'playing' ? p.category : p.answer)} · ${r.attempts.length} ${plural(r.attempts.length, 'tip', 'tipy', 'tipů')}</summary><ol>${r.attempts.map(a => `<li>${escape(a.text)} <strong>${a.score.accepted?'Rozpoznané znění':'Předchozí tip'}</strong></li>`).join('')}</ol>${r.draft ? `<p>Rozepsáno: ${escape(r.draft)}</p>` : ''}</details>`;
    }).join('')}</section>`;
  }
  function renderStats(t) {
    if (!hasAccount()) { $('stats-content').replaceChildren(); if ($('stats-dialog').open) $('stats-dialog').close(); return; }
    const today = Daily.dayTotals(day);
    const history = Object.keys(state.days).filter(key => key !== activeDate).sort().reverse().map(key => archiveGroup(Daily.displayDate(key), state.days[key].ids, state.days[key].progress)).join('') + archiveGroup('Předchozí verze hry', allPuzzles.map(p => p.id), state.legacy.progress);
    $('stats-content').innerHTML = `<div class="stats-grid"><div class="stat"><strong>${t.points}</strong><span>bodů k dispozici</span></div><div class="stat"><strong>${day.ids.length ? today.completed + " / " + day.ids.length : "—"}</strong><span>dnes dokončeno</span></div><div class="stat"><strong>${today.attempts}</strong><span>dnešních tipů</span></div></div><div class="ledger"><span>Body na začátek</span><span>+${INITIAL}</span><span>Odměny celkem</span><span>+${t.solved * 200}</span><span>Nápovědy celkem</span><span>−${t.spent}</span><span>Dnes rozluštěno</span><span>${today.solved} / 5</span></div>${history ? `<details class="past-games"><summary>Starší hry a tipy</summary>${history}</details>` : ''}`;
  }
  function renderResult(r) {
    const last = r.status === 'won' ? r.attempts.findLast(a => a.score.accepted) : r.attempts.at(-1), panel = $('result-panel');
    panel.hidden = !last;
    if (!last) { panel.innerHTML = ''; return; }
    const f=Guidance.feedback(last.text,currentPuzzle(),last.score.accepted);
    panel.innerHTML=`<p class="eyebrow">${f.accepted?'UZNANÝ TIP':'STOPA Z TVÉHO TIPU'}</p><h2 id="result-title">${escape(f.title)}</h2><p>${escape(f.detail)}</p>${f.matched.length?`<div class="guidance-words" aria-label="Shodná podstatná slova">${f.matched.map(word=>`<span>${escape(word)}</span>`).join('')}</div>`:''}${!f.accepted?`<p class="guidance-caution">${escape(f.caution)}</p><button class="text-button underlined" data-guide>Chci konkrétnější stopu</button>`:''}`;
  }
  function renderHistory(r) {
    $('attempt-count').textContent = `${r.attempts.length} ${plural(r.attempts.length, 'pokus', 'pokusy', 'pokusů')}`;
    if (!r.attempts.length) {
      $('history-section').hidden = true; $('history').replaceChildren(); return;
    }
    $('history-section').hidden = false;
    // Všechny pokusy zůstávají v pořadí od nejnovějšího, včetně nulových.
    const fragment = document.createDocumentFragment();
    r.attempts.slice().reverse().forEach((a, i) => {
      const row = document.createElement('article'); row.className = 'attempt';
      const f=Guidance.feedback(a.text,currentPuzzle(),a.score.accepted);
      row.innerHTML = `<span class="attempt-index">${pad(r.attempts.length - i)}</span><div><p class="attempt-text">${escape(a.text)}</p><p class="attempt-detail">${f.accepted?'Rozpoznané původní znění':f.matched.length?'Shodná slova: '+escape(f.matched.join(', ')):'Zatím bez shodného podstatného slova.'}</p></div><div class="attempt-score"><small>${f.accepted?'Rozluštěno':'Pokus'}</small></div>`;
      fragment.append(row);
    });
    $('history').replaceChildren(fragment);
  }
  function renderReveal(p, r) {
    const panel = $('reveal-panel'); panel.hidden = r.status === 'playing';
    if (panel.hidden) { panel.innerHTML = ''; return; }
    const won = r.status === 'won';
    const allDone = Daily.dayTotals(day).completed === day.ids.length;
    const education = p.education || {label: 'Původ úryvku', person: p.author, work: p.origin, summary: p.context};
    const media = education.image ? globalThis.SEPTANDA_IMAGES?.[education.image] : null;
    const original = p.sources[0];
    const picture = media ? `<figure class="education-media ${media.kind === 'work' ? 'work-image' : ''}"><img src="${escape(media.data)}" alt="${escape(media.alt)}" width="330" height="410" decoding="async"><figcaption>${escape(media.caption || '')}</figcaption></figure>` : '';
    const imageCredit = media ? `<p class="image-credit">${escape(media.credit)} <a href="${escape(media.source)}" target="_blank" rel="noopener noreferrer">Zdroj obrázku</a> · <a href="${escape(media.licenseUrl)}" target="_blank" rel="noopener noreferrer">Licence</a></p>` : '';
    panel.innerHTML = `<div class="reveal-top"><p class="eyebrow">${won ? 'SLOVA JSOU ZPÁTKY DOMA' : 'PŮVODNÍ ZPRÁVA'}</p><span class="award">${won ? '+200 bodů připsáno' : 'Odhaleno · bez odměny'}</span></div><h2 id="reveal-title" tabindex="-1">„${escape(p.answer)}“</h2><article class="education-card ${media ? 'has-media' : ''}">${picture}<div class="education-copy"><p class="eyebrow">${escape(education.label)}</p><h3>${escape(education.person)}</h3><p class="education-work">${escape(education.work)}</p><p class="education-summary">${escape(education.summary)}</p><a class="education-original" href="${escape(original.url)}" target="_blank" rel="noopener noreferrer">Původní zdroj <span aria-hidden="true">→</span></a></div></article><details class="source-details"><summary>Podrobnosti a atribuce</summary><p class="attribution">${escape(p.attribution)}</p><div class="source-links">${p.sources.map(s => `<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)}</a>`).join('')}</div>${imageCredit}</details><details class="chain-details"><summary>Celá cesta tiché pošty · originál a 5 předání</summary><ol class="chain-list"><li><span>0</span>${escape(p.answer)}</li>${p.chain.map((text, i) => `<li><span>${i + 1}</span>${escape(text)}</li>`).join('')}</ol></details>${allDone ? '<p class="daily-complete">Dnešní sada je hotová. Tvoje výsledky zůstávají uložené.</p>' : ''}<div class="reveal-actions"><button class="primary-button" data-next>${allDone ? 'Prohlédnout dnešní sadu' : 'Další výrok'} <span aria-hidden="true">→</span></button><button class="text-button underlined" data-share>Zkopírovat výsledek bez řešení</button></div><p id="share-message" class="form-message" role="status"></p>`;
  }
  function render() {
    const p = currentPuzzle(), r = roundFor(), t = totals(), index = puzzles.indexOf(p);
    $('balance-control').hidden = !hasAccount();
    $('balance').textContent = hasAccount() ? t.points : '';
    $('edition-date').textContent = new Intl.DateTimeFormat('cs-CZ', {timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric'}).format(new Date(activeDate + 'T12:00:00Z'));
    $('edition-date').dateTime = activeDate;
    $('edition-count').textContent = day.ids.length ? '05 VÝROKŮ' : 'ČEKÁME NA NOVÉ';
    $('puzzle-sheet').hidden = !p; $('daily-waiting').hidden = !!p;
    $('hint-section').hidden = !p; $('goal-note').hidden = !p;
    if (!p) {
      $('waiting-title').textContent = day.ids.length ? 'Dnes už nic neopakujeme.' : 'Další zprávy připravujeme.';
      $('waiting-copy').textContent = day.ids.length ? 'Výroky dnešní sady už máš v historii. Znovu ti je jako nové nenabídneme. Tvoje starší hry i body zůstávají uložené.' : 'Všechny úplné sady z aktuálně schválené zásoby už máš přidělené. Připravujeme další nové výroky. Tvoje historie i body zůstávají uložené a staré hádanky se znovu nevrací.';
      for (const id of ['guess-form','result-panel','reveal-panel','history-section','give-up']) $(id).hidden = true;
      $('solved-count').textContent = day.ids.length ? 'Už znáš' : '—';
      $('collection-marks').replaceChildren();
      $('collection-copy').textContent = day.ids.length ? 'Žádná opakovaná hádanka.' : 'Čekáme na další nové výroky.';
      renderCollection(); renderStats(t);
      document.dispatchEvent(new Event('septanda:progress'));
      document.dispatchEvent(new CustomEvent('septanda:scene', {detail:{status:'waiting',score:null,attempts:0,id:null}}));
      return;
    }
    if (Daily.markSeen(day,p.id)) save();
    $('puzzle-number').textContent = pad(index + 1); $('puzzle-category').textContent = p.category.toLocaleUpperCase('cs');
    $('distorted-message').textContent = p.chain.at(-1);
    $('guess-form').hidden = r.status !== 'playing';
    if ($('guess').value !== r.draft) $('guess').value = r.draft;
    for (const type of Object.keys(COST)) {
      const owned = r.hints.length > 0, button = $('hint-' + type);
      const level=Math.min(3,Math.max(1,r.hintLevel||1));
      button.disabled = r.status !== 'playing' || (owned ? level>=3 : t.points < COST[type]);
      button.classList.toggle('purchased', owned);
      button.querySelector('strong').textContent=owned && level<3?'Další stopa':'Tři postupné stopy';
      button.querySelector('.price').innerHTML = owned ? '<small>Odemčeno</small>' : `${COST[type]} <small>bodů</small>`;
      $('hint-' + type + '-content').hidden = !owned;
      $('hint-' + type + '-content').innerHTML = owned?Guidance.clues(p).slice(0,level).map((text,i)=>`<p><strong>Stopa ${i+1}</strong><br>${escape(text)}</p>`).join(''):'';
    }
    $('hint-status').textContent = r.status !== 'playing' ? 'Celý řetězec je teď přístupný pod výrokem.' : r.hints.length ? `Stopa ${r.hintLevel||1} ze 3. Další už stojí 0 bodů.` : t.points < COST.clue ? 'Na stopy teď body nestačí.' : 'Za 50 bodů odemkneš všechny tři. Otevíráš je postupně.';
    $('give-up').hidden = r.status !== 'playing';
    const today = Daily.dayTotals(day);
    $('daily-position').textContent = `DNEŠNÍ VÝROK ${index + 1} Z 5`;
    $('solved-count').textContent = `${today.completed} / 5`;
    $('collection-copy').textContent = today.skipped ? `${today.completed - today.skipped} nových dokončeno · ${today.skipped} už znáš z dřívějška.` : today.completed === 5 ? 'Dnešní sada je hotová.' : `${today.completed} z 5 dokončeno dnes.`;
    const progressButton = (item, i, rail) => {
      const status = day.progress[item.id]?.status || 'playing', unlocked = Daily.canSelect(day, item.id), skipped = day.skipped.includes(item.id);
      return `<button class="${skipped ? 'skipped' : status} ${item.id === p.id ? 'current' : ''}" data-select="${item.id}" aria-label="Dnešní výrok ${i + 1}, ${skipped ? 'už znáš z dřívějška' : status === 'won' ? 'rozluštěno' : status === 'revealed' ? 'odhaleno' : unlocked ? 'aktuální' : 'zatím zamčeno'}" ${item.id === p.id ? 'aria-current="step"' : ''} ${unlocked ? '' : 'disabled'}>${rail ? i + 1 : ''}</button>`;
    };
    $('daily-route').innerHTML = puzzles.map((item, i) => `${i ? `<b class="${day.progress[puzzles[i - 1].id]?.status && day.progress[puzzles[i - 1].id].status !== 'playing' ? 'complete' : ''}" aria-hidden="true"></b>` : ''}${progressButton(item, i, true)}`).join('');
    $('collection-marks').innerHTML = puzzles.map((item, i) => progressButton(item, i, false)).join('');
    renderResult(r); renderReveal(p, r); renderHistory(r); renderCollection(); renderStats(t);
    document.dispatchEvent(new Event('septanda:progress'));
    document.dispatchEvent(new CustomEvent('septanda:scene', {detail: {status:r.status, score:r.attempts.at(-1)?.score.total ?? null, attempts:r.attempts.length, id:p.id}}));
  }
  function syncCurrent(date, id) {
    read();
    if (date === activeDate && id === day.selected) return true;
    save(); $('form-message').textContent = ''; render();
    announce(date !== activeDate ? 'Nový den. Je připravena další pětice výroků.' : 'Postup byl aktualizován z dalšího okna.');
    return false;
  }
  function storeDraft() {
    if (!currentPuzzle()) return true;
    const draft = $('guess').value.slice(0, 400), date = activeDate, id = day.selected;
    if (!syncCurrent(date, id)) return false;
    if (roundFor().status === 'playing') { roundFor().draft = draft; save(); }
    return true;
  }
  function select(id) {
    if (!storeDraft() || !Daily.canSelect(day, id)) return;
    day.selected = id; save(); $('form-message').textContent = ''; render();
    if ($('collection-dialog').open) $('collection-dialog').close();
    $('puzzle-heading').scrollIntoView({block: 'start'});
    if (roundFor().status === 'playing') $('guess').focus({preventScroll: true});
  }
  function submit(event) {
    event.preventDefault();
    const text = $('guess').value.trim();
    // Ověření proti nejnovějšímu uloženému stavu chrání i před běžným dvojím kliknutím.
    if (!syncCurrent(activeDate, day.selected)) return;
    const p = currentPuzzle(), r = roundFor();
    if (!p || !r || r.status !== 'playing') { render(); return; }
    if (!engine.normalize(text)) { $('form-message').textContent = 'Nejdřív napiš svůj tip. Stačí i první nápad.'; $('guess').focus(); return; }
    if (text.length > 400) { $('form-message').textContent = 'Zkus tip zkrátit na nejvýše 400 znaků.'; return; }
    if (r.attempts.some(a => engine.normalize(a.text) === engine.normalize(text))) {
      $('form-message').textContent = 'Tento tip už je v historii. Zkus znění trochu změnit.'; return;
    }
    const score = engine.evaluate(text, p);
    r.attempts.push({id: globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), text, time: Date.now(), score}); r.draft = '';
    if (score.accepted) r.status = 'won';
    save(); $('form-message').textContent = ''; render();
    const feedback=Guidance.feedback(text,p,score.accepted);
    announce(`${feedback.title} ${feedback.detail}${feedback.matched.length?' Shodná slova: '+feedback.matched.join(', ')+'.':''}${score.accepted ? ' Připsáno 200 bodů.' : ''}`);
    if (score.accepted) { $('reveal-title').focus({preventScroll: true}); $('reveal-panel').scrollIntoView({block: 'start'}); }
    else { $('result-panel').scrollIntoView({block: 'nearest'}); $('guess').focus({preventScroll: true}); }
  }
  function buy(type) {
    const draft = $('guess').value; if (!syncCurrent(activeDate, day.selected)) return;
    const r = roundFor(); if (!r) return; r.draft = draft;
    if (!Object.hasOwn(COST, type) || r.status !== 'playing') return;
    if(r.hints.includes(type)) {
      r.hintLevel=Math.min(3,(r.hintLevel||1)+1);save();render();
      announce(`Stopa ${r.hintLevel}: ${Guidance.clues(currentPuzzle())[r.hintLevel-1]}`);return;
    }
    if (totals().points < COST[type]) { $('hint-status').textContent = 'Na tuto nápovědu teď nemáš dost bodů.'; return; }
    r.hints.push(type);r.hintLevel=1; save(); render();
    announce(`Nápověda zakoupena za ${COST[type]} bodů. ${currentPuzzle().hint}`);
  }
  async function share() {
    const r = roundFor(), index = puzzles.findIndex(p => p.id === day.selected) + 1;
    if (!r) return;
    const hintCount = Number(r.hints.length > 0);
    const text = `Šeptanda · ${Daily.displayDate(activeDate)} · Osobní výrok ${index}/5\n${r.status === 'won' ? 'Rozluštěno' : 'Odhaleno bez odměny'} · ${r.attempts.length} ${plural(r.attempts.length, 'pokus', 'pokusy', 'pokusů')} · ${hintCount} ${plural(hintCount, 'nápověda', 'nápovědy', 'nápověd')}\n${location.origin}${location.pathname}`;
    try { await navigator.clipboard.writeText(text); $('share-message').textContent = 'Výsledek je ve schránce. Řešení zůstalo tajemstvím.'; }
    catch (_) { $('share-message').textContent = 'Automatické kopírování není dostupné. Výsledek si můžeš vybrat a zkopírovat:'; const box = document.createElement('textarea'); box.value = text; box.readOnly = true; box.setAttribute('aria-label', 'Výsledek ke zkopírování'); $('share-message').append(box); box.select(); }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.open) { if (button.dataset.open === 'stats-dialog') renderStats(totals()); openDialog(button.dataset.open); }
    else if (button.hasAttribute('data-close')) button.closest('dialog').close();
    else if (button.dataset.select) select(button.dataset.select);
    else if (button.dataset.hint) buy(button.dataset.hint);
    else if (button.hasAttribute('data-guide')) { $('hint-section').scrollIntoView({block:'center'});$('hint-clue').focus(); }
    else if (button.hasAttribute('data-next')) {
      if (!syncCurrent(activeDate, day.selected)) return;
      const next = Daily.nextId(day);
      if (next) select(next); else openDialog('collection-dialog');
    } else if (button.hasAttribute('data-share')) share();
  });
  $('guess-form').addEventListener('submit', submit);
  $('guess').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('guess-form').requestSubmit(); }
  });
  $('guess').addEventListener('input', storeDraft);
  $('give-up').addEventListener('click', () => {
    if (!currentPuzzle()) return;
    const id = day.selected, date = activeDate;
    ask('Odhalit původní výrok?', 'Uvidíš řešení, jeho příběh i všech pět předání. Za tuto hádanku už nezískáš 200 bodů; zakoupené nápovědy se nevracejí. Pak se otevře další výrok dnešní sady.', 'Odhalit bez odměny', () => {
      if (!syncCurrent(date, id)) return; const r = roundFor(); if (r.status !== 'playing') return;
      r.status = 'revealed'; r.draft = ''; save(); render(); $('reveal-title').focus({preventScroll: true}); $('reveal-panel').scrollIntoView({block: 'start'}); announce('Výrok odhalen bez bodové odměny.');
    });
  });
  $('confirm-action').addEventListener('click', () => { const task = confirmTask; confirmTask = null; $('confirm-dialog').close(); if (task) task(); });
  $('confirm-dialog').addEventListener('close', () => { confirmTask = null; });
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  }));
  window.addEventListener('storage', event => {
    if (event.key !== KEY) return;
    read(); render(); announce('Postup byl aktualizován z dalšího okna.');
  });
  function checkNewDay() {
    if (Daily.dayKey() === activeDate) return;
    read(); save(); $('form-message').textContent = ''; render();
    announce('Nový den. Je připravena další pětice výroků.');
  }
  window.addEventListener('focus', checkNewDay);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNewDay(); });
  setInterval(checkNewDay, 30000);
  read(); save(); render();
  function exportState() { storeDraft(); return JSON.parse(JSON.stringify(state)); }
  function replaceState(incoming) {
    const clean = Daily.sanitizeState(incoming); if (!clean) return false;
    state = clean; activateDay(); save(); $('form-message').textContent = ''; render(); return true;
  }
  function guestState() {
    if (KEY === GUEST_KEY) return exportState();
    try { return Daily.sanitizeState(JSON.parse(localStorage.getItem(GUEST_KEY))); } catch (_) { return null; }
  }
  function backupPending(value){try{const old=pendingBackup();const snapshots=old?.format==='septanda-pending-backup'?old.snapshots:old?[old]:[];if(!snapshots.some(s=>JSON.stringify(s)===JSON.stringify(value)))snapshots.push(value);localStorage.setItem(KEY+'.pending-backup',JSON.stringify({format:'septanda-pending-backup',snapshots}));}catch(_){throw new Error('Zálohu místních tipů nelze uložit. Před synchronizací si stáhni svůj postup.');}}
  function pendingBackup(){try{return JSON.parse(localStorage.getItem(KEY+'.pending-backup')||'null');}catch(_){return null;}}
  globalThis.SeptandaGame = Object.freeze({storageKey: () => KEY, setAccount, exportState, replaceState, guestState, hasAccount,backupPending,pendingBackup, scene: () => ({status:roundFor()?.status || 'waiting', score:roundFor()?.attempts.at(-1)?.score.total ?? null, attempts:roundFor()?.attempts.length || 0, id:currentPuzzle()?.id || null})});
})();
