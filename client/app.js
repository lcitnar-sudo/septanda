(function () {
  'use strict';
  const allPuzzles = globalThis.SEPTANDA_PUZZLES, engine = globalThis.SeptandaEngine, Daily = globalThis.SeptandaDaily, Guidance=globalThis.SeptandaGuidance;
  const GUEST_KEY = 'septanda.v6.daily';
  if(!globalThis.SEPTANDA_PRACTICE&&!globalThis.SEPTANDA_DEMO){try{if(localStorage.getItem('septanda.session-present')||Object.keys(localStorage).some(k=>/^sb-.*-auth-token$/.test(k)))document.documentElement.classList.add('restoring-account');}catch(_){}}
  let KEY = GUEST_KEY;
  const LEGACY_KEY = 'septanda.v5.progress', INITIAL = 100, COST = {clue: 50};
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0');
  const plural = (n, one, few, many) => n === 1 ? one : n >= 2 && n <= 4 ? few : many;
  const blankRound = Daily.blankRound;
  let memoryOnly = false, state = Daily.createState(null), confirmTask = null;
  let day, activeDate, puzzles = [], skipBusy=false;
  function activateDay() {
    activeDate = Daily.dayKey();
    day = Daily.ensureDay(state, activeDate,{personal:true,playerId:KEY===GUEST_KEY?null:KEY.split('.account.')[1],upgrade:true});
    puzzles = Daily.playIds(day).map(id => allPuzzles.find(p => p.id === id));
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
  const mode=()=>Daily.modeFor(day),isAuthor=()=>Daily.isAuthorMode(mode());
  const isMeaning=()=>mode()==='author-v2'&&!!globalThis.SeptandaAuthors.get(currentPuzzle())?.meaning;
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
      const status = day.skipped.includes(p.id) ? 'Už znáš z dřívějška' : !unlocked ? 'Zatím zamčeno' : r.status === 'won' ? 'Rozluštěno' : r.status === 'revealed' ? (r.paidSkip?'Přeskočeno':'Odhaleno') : r.attempts.length ? `${r.attempts.length} ${plural(r.attempts.length, 'pokus', 'pokusy', 'pokusů')}` : 'Připraveno';
      return `<button class="collection-item" data-select="${p.id}" aria-current="${p.id === day.selected}" ${unlocked ? '' : 'disabled'}><span class="number">${pad(i + 1)}</span><span><strong>${escape(isAuthor()?'Původ výroku':p.category)}</strong><small>${escape(isAuthor()?'Jméno, nebo lidová tradice':p.era)}</small></span><span class="status">${status}</span></button>`;
    }).join('') || '<p class="muted">Další nové zprávy připravujeme. Staré hádanky znovu nenasazujeme.</p>';
  }
  function archiveGroup(title, ids, progress,mode='classic') {
    const records = ids.filter(id => { const r = progress[id]; return r && (r.attempts.length || r.hints.length || r.chainLevel || r.draft || r.status !== 'playing'); });
    if (!records.length) return '';
    return `<section class="archive-group"><h3>${escape(title)}</h3>${records.map(id => {
      const p = allPuzzles.find(p => p.id === id), r = progress[id];
      return `<details class="archive-round"><summary>${escape(r.status === 'playing' ? p.category : p.answer)} · ${r.attempts.length} ${plural(r.attempts.length, 'tip', 'tipy', 'tipů')}</summary><ol>${r.attempts.map(a => `<li>${escape(a.text)} <strong>${a.score.accepted?(Daily.isAuthorMode(mode)?'Rozpoznaný původ':'Rozpoznané znění'):'Předchozí tip'}</strong></li>`).join('')}</ol>${r.hints.length?`<p class="small">Zakoupené nápovědy: ${r.hints.length}${r.hints.includes('clue')?` · Postupné stopy ${r.hintLevel||1}/3`:''}</p>`:''}${r.chainLevel?`<p class="small">Odkrytá předání věty: ${r.chainLevel}/4</p>`:''}${r.paidSkip?`<p class="small">Přeskočeno za ${Daily.skipCharge(r)} bodů</p>`:''}${r.draft ? `<p>Rozepsáno: ${escape(r.draft)}</p>` : ''}</details>`;
    }).join('')}</section>`;
  }
  function renderStats(t) {
    if (!hasAccount()) { $('stats-content').replaceChildren(); if ($('stats-dialog').open) $('stats-dialog').close(); return; }
    const today = Daily.dayTotals(day);
    const history = Object.entries(state.archivedDays||{}).sort(([a],[b])=>b.localeCompare(a)).map(([date,old])=>archiveGroup(Daily.displayDate(date)+' · Původní tichá pošta',old.ids,old.progress)).join('') + Object.keys(state.days).filter(key => key !== activeDate).sort().reverse().map(key => archiveGroup(Daily.displayDate(key), state.days[key].ids, state.days[key].progress,Daily.modeFor(state.days[key]))).join('') + archiveGroup('Předchozí verze hry', allPuzzles.map(p => p.id), state.legacy.progress) + archiveGroup('Dřívější výsledky z dneška', day.ids.filter(id=>!Daily.playIds(day).includes(id)), day.progress);
    $('stats-content').innerHTML = `<div class="stats-grid"><div class="stat"><strong>${t.points}</strong><span>bodů k dispozici</span></div><div class="stat"><strong>${puzzles.length ? today.completed + " / " + puzzles.length : "—"}</strong><span>dnes dokončeno</span></div><div class="stat"><strong>${today.attempts}</strong><span>dnešních tipů</span></div></div><div class="ledger"><span>Body na začátek</span><span>+${INITIAL}</span><span>Odměny celkem</span><span>+${t.solved * 200}</span><span>Stopy a přeskočení</span><span>−${t.spent}</span><span>Dnes rozluštěno</span><span>${today.solved} / ${puzzles.length}</span></div>${history ? `<details class="past-games"><summary>Starší hry a tipy</summary>${history}</details>` : ''}`;
  }
  function renderResult(r) {
    const last = r.status === 'won' ? r.attempts.findLast(a => a.score.accepted) : r.attempts.at(-1), panel = $('result-panel');
    panel.hidden = !last || isAuthor()&&r.status==='won';
    if (!last || isAuthor()&&r.status==='won') { panel.innerHTML = ''; return; }
    const author=globalThis.SeptandaAuthors,near=isAuthor()?author.proximity(last.text,currentPuzzle(),mode()):null;
    const previous=near?r.attempts.slice(0,r.attempts.indexOf(last)).findLast(a=>{const p=author.proximity(a.text,currentPuzzle(),mode());return p&&p.id!==near.id;}):null;
    const f=Guidance.feedback(last.text,currentPuzzle(),last.score.accepted,mode(),previous?.text);
    const traits=f.traits?.length?`<dl class="author-guidance" aria-label="Vodítka z tvého tipu">${f.traits.map(t=>`<div class="${t.match?'is-match':'is-miss'}"><dt>${escape(t.label)}${t.match?' · shoda':''}</dt><dd>${escape(t.text)}</dd></div>`).join('')}</dl>`:'';
    panel.innerHTML=`<p class="eyebrow">${f.accepted?'UZNANÝ TIP':'STOPA Z TVÉHO TIPU'}</p><h2 id="result-title">${escape(f.title)}</h2><p>${escape(f.detail)}</p>${traits}${f.comparison?`<p class="guidance-comparison" role="status">${escape(f.comparison)}</p>`:''}${f.matched.length?`<div class="guidance-words" aria-label="Shodná podstatná slova">${f.matched.map(word=>`<span>${escape(word)}</span>`).join('')}</div>`:''}${!f.accepted?`<p class="guidance-caution">${escape(f.caution)}</p><button class="text-button underlined" data-guide>Chci konkrétnější stopu</button>`:''}`;
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
      const f=Guidance.feedback(a.text,currentPuzzle(),a.score.accepted,mode());
      row.innerHTML = `<span class="attempt-index">${pad(r.attempts.length - i)}</span><div><p class="attempt-text">${escape(a.text)}</p><p class="attempt-detail">${f.accepted?(isAuthor()?(f.relatedUse?'Rozpoznaná souvislost':'Rozpoznaný původ'):'Rozpoznané původní znění'):isAuthor()?(f.traits?.length?'Shoda: '+escape(f.traits.filter(t=>t.match).map(t=>t.label.toLowerCase()).join(', ')||'zatím žádné vodítko'):'Tento tip neumíme srovnat podle osobnosti.'):f.matched.length?'Shodná slova: '+escape(f.matched.join(', ')):'Zatím bez shodného podstatného slova.'}</p></div><div class="attempt-score"><small>${f.accepted?'Rozluštěno':'Pokus'}</small></div>`;
      fragment.append(row);
    });
    $('history').replaceChildren(fragment);
  }
  function renderAuthorReveal(p,r){
    const panel=$('reveal-panel');panel.hidden=r.status==='playing';if(panel.hidden){panel.innerHTML='';return;}
    const author=globalThis.SeptandaAuthors,entry=author.get(p),profile=author.profile(p),education=p.education,won=r.status==='won',done=Daily.dayTotals(day).completed===puzzles.length;
    const labels={'folk':'LIDOVÁ TRADICE','traditional':'TRADIČNĚ PŘIPISOVÁNO','speaker':'MLUVČÍ V DOCHOVANÉM PODÁNÍ','literary-author':'AUTOR DÍLA','documented':'DOLOŽENÝ PŮVOD'};
    const media=education.image?globalThis.SEPTANDA_IMAGES?.[education.image]:null;
    const picture=media?`<figure class="education-media"><img src="${escape(media.data)}" alt="${escape(media.alt)}" width="330" height="410" decoding="async" loading="lazy"><figcaption>${escape(media.caption||'')}</figcaption></figure>`:'';
    const story=(entry.story?.paragraphs||[education.summary]).map(text=>`<p>${escape(text)}</p>`).join('');
    const related=(entry.relatedUses||[]).map(use=>`<section class="related-use"><h3>Další známá souvislost · ${escape(use.label)}</h3><p>${escape(use.explanation)}</p><a href="${escape(use.source.url)}" target="_blank" rel="noopener noreferrer">${escape(use.source.label)} →</a></section>`).join('');
    const originalSource=entry.original?`<p>Původní jazyk: <a href="${escape(entry.original.source.url)}" target="_blank" rel="noopener noreferrer">${escape(entry.original.source.label)}</a></p>`:'';
    panel.innerHTML=`<div class="reveal-top"><p class="eyebrow">${labels[entry.attribution]}</p><span class="award">${won?'+200 bodů připsáno':r.paidSkip?`Přeskočeno · −${Daily.skipCharge(r)} bodů`:'Odhaleno · bez odměny'}</span></div><blockquote class="reveal-quotation">${escape(p.answer)}</blockquote><h2 id="reveal-title" tabindex="-1">${escape(profile.name)}</h2><article class="education-card ${media?'has-media':''}">${picture}<div class="education-copy"><p class="eyebrow">${entry.profile==='folk'?'PROČ SE TO ŘÍKÁ':'OSOBNOST ZA SLOVY'}</p><p>${escape(profile.bio)}</p><p class="education-work">${escape(education.work)}</p><p class="small muted">${escape(p.era)}</p><div class="quote-story">${story}</div><a class="education-original" href="${escape(p.sources[0].url)}" target="_blank" rel="noopener noreferrer">Doložený pramen →</a>${related}</div></article><details class="source-details"><summary>Jak původ dokládáme</summary><p>${escape(p.attribution)}</p>${originalSource}${p.sources.map(s=>`<p><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)}</a></p>`).join('')}${media?`<p class="image-credit">${escape(media.credit)} <a href="${escape(media.source)}" target="_blank" rel="noopener noreferrer">Zdroj obrázku</a> · <a href="${escape(media.licenseUrl)}" target="_blank" rel="noopener noreferrer">Licence</a></p>`:''}</details>${done?'<p class="daily-complete">Dnešní sada je hotová. Tvoje výsledky zůstávají uložené.</p>':''}<div class="reveal-actions"><button class="primary-button" data-next>${done?'Prohlédnout dnešní sadu':'Další výrok'} →</button><button class="text-button underlined" data-share>Zkopírovat výsledek bez řešení</button></div><p id="share-message" class="form-message" role="status"></p>`;
  }
  function renderReveal(p, r) {
    if(isAuthor()){renderAuthorReveal(p,r);return;}
    const panel = $('reveal-panel'); panel.hidden = r.status === 'playing';
    if (panel.hidden) { panel.innerHTML = ''; return; }
    const won = r.status === 'won';
    const allDone = Daily.dayTotals(day).completed === puzzles.length;
    const education = p.education || {label: 'Původ úryvku', person: p.author, work: p.origin, summary: p.context};
    const media = education.image ? globalThis.SEPTANDA_IMAGES?.[education.image] : null;
    const original = p.sources[0];
    const picture = media ? `<figure class="education-media ${media.kind === 'work' ? 'work-image' : ''}"><img src="${escape(media.data)}" alt="${escape(media.alt)}" width="330" height="410" decoding="async" loading="lazy"><figcaption>${escape(media.caption || '')}</figcaption></figure>` : '';
    const imageCredit = media ? `<p class="image-credit">${escape(media.credit)} <a href="${escape(media.source)}" target="_blank" rel="noopener noreferrer">Zdroj obrázku</a> · <a href="${escape(media.licenseUrl)}" target="_blank" rel="noopener noreferrer">Licence</a></p>` : '';
    panel.innerHTML = `<div class="reveal-top"><p class="eyebrow">${won ? 'SLOVA JSOU ZPÁTKY DOMA' : 'PŮVODNÍ ZPRÁVA'}</p><span class="award">${won ? '+200 bodů připsáno' : r.paidSkip?`Přeskočeno · −${Daily.skipCharge(r)} bodů`:'Odhaleno · bez odměny'}</span></div><h2 id="reveal-title" tabindex="-1">„${escape(p.answer)}“</h2><article class="education-card ${media ? 'has-media' : ''}">${picture}<div class="education-copy"><p class="eyebrow">${escape(education.label)}</p><h3>${escape(education.person)}</h3><p class="education-work">${escape(education.work)}</p><p class="education-summary">${escape(education.summary)}</p><a class="education-original" href="${escape(original.url)}" target="_blank" rel="noopener noreferrer">Původní zdroj <span aria-hidden="true">→</span></a></div></article><details class="source-details"><summary>Podrobnosti a atribuce</summary><p class="attribution">${escape(p.attribution)}</p><div class="source-links">${p.sources.map(s => `<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)}</a>`).join('')}</div>${imageCredit}</details><details class="chain-details"><summary>Celá cesta tiché pošty · originál a 5 předání</summary><ol class="chain-list"><li><span>0</span>${escape(p.answer)}</li>${p.chain.map((text, i) => `<li><span>${i + 1}</span>${escape(text)}</li>`).join('')}</ol></details>${allDone ? '<p class="daily-complete">Dnešní sada je hotová. Tvoje výsledky zůstávají uložené.</p>' : ''}<div class="reveal-actions"><button class="primary-button" data-next>${allDone ? 'Prohlédnout dnešní sadu' : 'Další výrok'} <span aria-hidden="true">→</span></button><button class="text-button underlined" data-share>Zkopírovat výsledek bez řešení</button></div><p id="share-message" class="form-message" role="status"></p>`;
  }
  function renderMode(){
    const author=isAuthor();
    $('intro-title').innerHTML='Šeptá se to po staletí.<br><em>Víš, kdo to řekl a proč?</em>';
    $('intro-copy').textContent=author?'Tři výroky denně. Vypátrej, komu patří, a objev jejich příběhy.':'';
    $('intro-copy').hidden=!author;
    $('history-access').hidden=!Object.keys(state.archivedDays||{}).length;
    $('classic-history-content').innerHTML=Object.entries(state.archivedDays||{}).sort(([a],[b])=>b.localeCompare(a)).map(([date,old])=>archiveGroup(Daily.displayDate(date),old.ids,old.progress)).join('') || '<p>V původní sadě zatím nebyly odeslané žádné tipy ani zakoupené nápovědy.</p>';
    $('guess').placeholder=mode()==='author-v2'?'Jméno autora nebo mluvčího':author?'Jméno autora nebo lidový původ':'Tvůj tip na původní znění';
    $('guess-label').textContent=$('guess').placeholder;$('guess').maxLength=author?120:400;
    $('guess-instructions').textContent=author?'Stačí příjmení nebo celé jméno. Diakritiku neřeš.':'Na čárkách ani diakritice nezáleží.';
    $('hint-clue').querySelector('small').textContent=isMeaning()?'Souvislost, dvě možnosti a vysvětlení.':author?'Souvislost, pramen a čtyři osobnosti.':'Od významu ke konkrétnímu obrazu.';
    $('message-label').textContent=isMeaning()?'JAK ROZUMÍŠ TĚMTO SLOVŮM?':author?'ČÍ JSOU TATO SLOVA?':'ZACHYCENÁ ZPRÁVA';
    $('rules-author').hidden=!author;$('rules-classic').hidden=author;
    $('scoring-author').hidden=!author;$('scoring-classic').hidden=author;
    $('rules-title').textContent=author?'Najdi původ a smysl slov.':'Vrať slovům jejich začátek.';
    $('scoring-title').textContent=author?'Autor, význam a stopy.':'Co už sedí a kam dál.';
    $('goal-copy').innerHTML=author?'Poznej autora nebo význam rčení.<br>Za slovy tě čeká příběh.':'Nemusíš trefit každou čárku.<br>Musíš poznat původní výrok.';
  }
  function render() {
    const p = currentPuzzle(), r = roundFor(), t = totals(), index = puzzles.indexOf(p);
    renderMode();
    $('balance-control').hidden = !hasAccount();
    $('balance').textContent = hasAccount() ? t.points : '';
    $('edition-date').textContent = new Intl.DateTimeFormat('cs-CZ', {timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric'}).format(new Date(activeDate + 'T12:00:00Z'));
    $('edition-date').dateTime = activeDate;
    $('edition-count').textContent = puzzles.length ? pad(puzzles.length)+' '+(puzzles.length===3?'VÝROKY':'VÝROKŮ') : 'ČEKÁME NA NOVÉ';
    $('puzzle-sheet').hidden = !p; $('daily-waiting').hidden = !!p;
    $('hint-section').hidden = !p; $('transmission-section').hidden = !p; $('goal-note').hidden = !p;
    if (!p) {
      $('waiting-title').textContent = puzzles.length ? 'Dnes už nic neopakujeme.' : 'Další zprávy připravujeme.';
      $('waiting-copy').textContent = puzzles.length ? 'Výroky dnešní sady už máš v historii. Znovu ti je jako nové nenabídneme. Tvoje starší hry i body zůstávají uložené.' : 'Všechny úplné sady z aktuálně schválené zásoby už máš přidělené. Připravujeme další nové výroky. Tvoje historie i body zůstávají uložené a staré hádanky se znovu nevrací.';
      for (const id of ['guess-form','result-panel','reveal-panel','history-section','give-up','skip-help']) $(id).hidden = true;
      $('solved-count').textContent = puzzles.length ? 'Už znáš' : '—';
      $('collection-marks').replaceChildren();
      $('collection-copy').textContent = puzzles.length ? 'Žádná opakovaná hádanka.' : 'Čekáme na další nové výroky.';
      renderCollection(); if($('stats-dialog').open)renderStats(t);
      document.dispatchEvent(new Event('septanda:progress'));
      document.dispatchEvent(new CustomEvent('septanda:scene', {detail:{status:'waiting',score:null,attempts:0,id:null}}));
      return;
    }
    if (Daily.markSeen(day,p.id)) save();
    $('puzzle-number').textContent = pad(index + 1); $('puzzle-category').textContent = isAuthor()?'PÁTRÁNÍ PO PŮVODU':p.category.toLocaleUpperCase('cs');
    $('puzzle-heading').textContent=isMeaning()?'Co toto rčení znamená?':isAuthor()?globalThis.SeptandaAuthors.get(p).question:'Co zaznělo na začátku?';
    $('puzzle-category').textContent=mode()==='author-v1'?'PÁTRÁNÍ PO PŮVODU':isMeaning()?'HLEDÁME VÝZNAM RČENÍ':isAuthor()?(globalThis.SeptandaAuthors.get(p).attribution==='speaker'?'HLEDÁME MLUVČÍHO':globalThis.SeptandaAuthors.get(p).profile==='folk'?'HLEDÁME PŮVOD':globalThis.SeptandaAuthors.get(p).attribution==='literary-author'?'HLEDÁME AUTORA DÍLA':'HLEDÁME AUTORA VÝROKU'):p.category.toLocaleUpperCase('cs');
    $('question-scope').hidden=!isAuthor();$('question-scope').textContent=isMeaning()?'Vyber výklad, který nejlépe odpovídá rčení.':isAuthor()?(mode()==='author-v2'?globalThis.SeptandaAuthors.get(p).scope.replace(/ Pokud není známý,[\s\S]*/, ''):globalThis.SeptandaAuthors.get(p).scope):'';
    $('distorted-message').textContent = isAuthor()?p.answer:p.chain.at(-1);
    const original=isAuthor()?globalThis.SeptandaAuthors.get(p)?.original:null;
    $('quote-original').hidden=!original;
    $('quote-original').innerHTML=original?`<figcaption class="eyebrow">V původním jazyce · ${escape(original.language)}</figcaption><blockquote lang="${escape(original.lang)}">${escape(original.text)}</blockquote>${original.note?`<p class="small muted">${escape(original.note)}</p>`:''}`:'';
    $('guess-form').hidden = r.status !== 'playing';
    $('guess').hidden=isMeaning();$('guess-label').hidden=isMeaning();$('input-help').hidden=isMeaning();$('guess-submit').hidden=isMeaning();
    const meaningOptions=isMeaning()?globalThis.SeptandaAuthors.options(p,mode()):[];
    $('meaning-options').hidden=!isMeaning();$('meaning-options').innerHTML=meaningOptions.map(o=>`<button type="button" class="meaning-option" data-meaning-choice="${escape(o.id)}" ${r.status!=='playing'?'disabled':''}>${escape(o.label)}</button>`).join('');
    if(isMeaning()&&r.hints.includes('clue')&&(r.hintLevel||1)>=2){const wrong=meaningOptions.filter(o=>o.id!=='meaning').slice(0,2).map(o=>o.id);$('meaning-options').innerHTML=meaningOptions.filter(o=>!wrong.includes(o.id)).map(o=>`<button type="button" class="meaning-option" data-meaning-choice="${escape(o.id)}">${escape(o.label)}</button>`).join('');}
    $('defer-puzzle').hidden=r.status!=='playing'||!isAuthor();$('author-suggestions').replaceChildren();
    if ($('guess').value !== r.draft) $('guess').value = r.draft;
    for (const type of Object.keys(COST)) {
      const owned = r.hints.length > 0, button = $('hint-' + type);
      const level=Math.min(3,Math.max(1,r.hintLevel||1));
      button.disabled = skipBusy || r.status !== 'playing' || (owned ? level>=3 : t.points < COST[type]);
      button.classList.toggle('purchased', owned);
      button.querySelector('strong').textContent=owned && level<3?'Další stopa':'Tři postupné stopy';
      button.querySelector('.price').innerHTML = owned ? '<small>Odemčeno</small>' : `${COST[type]} <small>bodů</small>`;
      $('hint-' + type + '-content').hidden = !owned;
      $('hint-' + type + '-content').innerHTML = owned?Guidance.clues(p,mode()).slice(0,level).map((text,i)=>`<p><strong>Stopa ${i+1}</strong><br>${escape(text)}</p>`).join(''):'';
    }
    $('hint-options').hidden=isMeaning()||!(isAuthor() && r.hints.includes('clue') && (r.hintLevel||1)>=3);
    $('hint-options').innerHTML=$('hint-options').hidden?'':globalThis.SeptandaAuthors.options(p,mode()).map(o=>`<button type="button" class="secondary-button author-option" data-author-choice="${escape(o.id)}" ${r.status!=='playing'||skipBusy?'disabled':''}>${escape(o.label)}</button>`).join('');
    $('hint-status').textContent = r.status !== 'playing' ? (isAuthor()?'Příběh a původ najdeš pod výrokem.':'Celý řetězec je teď přístupný pod výrokem.') : r.hints.length ? `Stopa ${r.hintLevel||1} ze 3. Další už stojí 0 bodů.` : t.points < COST.clue ? 'Na stopy teď body nestačí.' : 'Za 50 bodů odemkneš všechny tři. Otevíráš je postupně.';
    renderTransmissions(p,r,t);
    $('give-up').hidden = r.status !== 'playing';
    $('give-up').disabled = skipBusy || !isAuthor()&&t.points<Daily.skipCost;
    $('give-up').textContent = skipBusy?'Ukládám…':t.points<Daily.skipCost&&isAuthor()?'Odhalit bez odměny':'Přeskočit výrok · −100 bodů';
    $('skip-help').hidden = r.status !== 'playing';
    $('skip-help').textContent=t.points<Daily.skipCost&&isAuthor()?'Na placené přeskočení body nestačí. Můžeš otázku odložit nebo odhalit bez odměny.':'Přeskočený výrok se počítá do dnešního limitu. Za přeskočení nezískáš odměnu.';
    $('guess').disabled=skipBusy;
    const today = Daily.dayTotals(day);
    $('daily-position').textContent = `DNEŠNÍ VÝROK ${index + 1} Z ${puzzles.length}`;
    $('solved-count').textContent = `${today.completed} / ${puzzles.length}`;
    $('collection-copy').textContent = today.skipped ? `${today.completed - today.skipped} nových dokončeno · ${today.skipped} už znáš z dřívějška.` : today.completed === puzzles.length ? 'Dnešní sada je hotová.' : `${today.completed} z ${puzzles.length} dokončeno dnes.`;
    const progressButton = (item, i, rail) => {
      const status = day.progress[item.id]?.status || 'playing', unlocked = Daily.canSelect(day, item.id), skipped = day.skipped.includes(item.id);
      return `<button class="${skipped ? 'skipped' : status} ${item.id === p.id ? 'current' : ''}" data-select="${item.id}" aria-label="Dnešní výrok ${i + 1}, ${skipped ? 'už znáš z dřívějška' : status === 'won' ? 'rozluštěno' : status === 'revealed' ? (day.progress[item.id]?.paidSkip?'přeskočeno':'odhaleno') : unlocked ? 'aktuální' : 'zatím zamčeno'}" ${item.id === p.id ? 'aria-current="step"' : ''} ${unlocked ? '' : 'disabled'}>${rail ? i + 1 : ''}</button>`;
    };
    $('daily-route').innerHTML = puzzles.map((item, i) => `${i ? `<b class="${day.progress[puzzles[i - 1].id]?.status && day.progress[puzzles[i - 1].id].status !== 'playing' ? 'complete' : ''}" aria-hidden="true"></b>` : ''}${progressButton(item, i, true)}`).join('');
    $('collection-marks').innerHTML = puzzles.map((item, i) => progressButton(item, i, false)).join('');
    renderResult(r); renderReveal(p, r); renderHistory(r); renderCollection(); if($('stats-dialog').open)renderStats(t);
    document.dispatchEvent(new Event('septanda:progress'));
    document.dispatchEvent(new CustomEvent('septanda:scene', {detail: {meaning:isMeaning(),mode:mode(),status:r.status, score:r.attempts.at(-1)?.score.total ?? null, attempts:r.attempts.length, id:p.id,fact:r.status!=='playing'?(p.education?.summary||p.meaning||''):''}}));
  }
  function syncCurrent(date, id) {
    read();
    if (date === activeDate && id === day.selected) return true;
    save(); $('form-message').textContent = ''; render();
    announce(date !== activeDate ? 'Nový den. Je připravena další osobní sada.' : 'Postup byl aktualizován z dalšího okna.');
    return false;
  }
  function renderTransmissions(p,r,t) {
    const level=Daily.chainLevel(r),max=p.chain.length-1,done=r.status!=='playing'||isAuthor();
    $('transmission-section').hidden=done;
    const button=$('reveal-transmission');
    button.disabled=skipBusy || done || level>=max || t.points<Daily.chainCost;
    button.querySelector('strong').textContent=level>=max?'Všechna předání odkryta':'Předchozí podoba věty';
    button.querySelector('.price').innerHTML=level>=max?'<small>Hotovo</small>':`${Daily.chainCost} <small>bodů</small>`;
    $('transmission-content').hidden=!level;
    $('transmission-content').innerHTML=p.chain.slice(max-level,max).reverse().map((text,i)=>`<li><span class="eyebrow">PŘEDÁNÍ ${max-i} Z ${p.chain.length}</span><p>${escape(text)}</p></li>`).join('');
    $('transmission-status').textContent=`Odkryto ${level} ze ${max}. `+(level>=max?'Původní výrok ještě zbývá uhodnout.':t.points<Daily.chainCost?'Na další předání potřebuješ 50 bodů.':'Každé další předání stojí 50 bodů.');
  }
  async function buyTransmission() {
    if(skipBusy || isAuthor() || !currentPuzzle() || !storeDraft())return;
    const id=day.selected,date=activeDate,r=roundFor(),max=currentPuzzle().chain.length-1;
    if(r.status!=='playing' || Daily.chainLevel(r)>=max || totals().points<Daily.chainCost)return;
    const level=Daily.chainLevel(r)+1;skipBusy=true;render();
    try {
      if(hasAccount() && globalThis.SeptandaCloud?.isActive())await globalThis.SeptandaCloud.revealChainStep(date,id,level);
      else {const current=roundFor(id);current.chainLevel=level;save();}
      announce('Předchozí podoba věty je odkrytá. '+currentPuzzle().chain[max-level]);
    } catch(error){$('form-message').textContent=error.message;announce(error.message);}
    finally{skipBusy=false;render();}
  }
  function storeDraft() {
    if (!currentPuzzle()) return true;
    const draft = $('guess').value.slice(0, 400), date = activeDate, id = day.selected;
    if (!syncCurrent(date, id)) return false;
    if (roundFor().status === 'playing') { roundFor().draft = draft; save(); }
    return true;
  }
  function select(id) {
    if(skipBusy)return;
    if (!storeDraft() || !Daily.canSelect(day, id)) return;
    day.selected = id; save(); $('form-message').textContent = ''; render();
    if ($('collection-dialog').open) $('collection-dialog').close();
    $('puzzle-heading').scrollIntoView({block: 'start'});
    if (roundFor().status === 'playing') $('guess').focus({preventScroll: true});
  }
  function submit(event) {
    event.preventDefault();
    if(skipBusy)return;
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
    if(mode()==='author-v2'&&!isMeaning()&&!globalThis.SeptandaAuthors.identify(text,true)&&globalThis.SeptandaAuthors.suggestions(text).length>1){$('author-suggestions').innerHTML=globalThis.SeptandaAuthors.suggestions(text).map(c=>`<button type="button" class="name-suggestion" data-author-name="${escape(c.name)}">${escape(c.name)}</button>`).join('');$('form-message').textContent='Upřesni, kterou osobnost myslíš. Tento zápis nepočítáme jako pokus.';return;}
    const score = engine.evaluate(text, p, mode());
    r.attempts.push({id: globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), text, time: Date.now(), score}); r.draft = '';
    if (score.accepted) r.status = 'won';
    save(); $('form-message').textContent = ''; render();
    const feedback=Guidance.feedback(text,p,score.accepted,mode());
    announce(`${feedback.title} ${feedback.detail}${feedback.matched.length?' Shodná slova: '+feedback.matched.join(', ')+'.':''}${score.accepted ? ' Připsáno 200 bodů.' : ''}`);
    if (score.accepted) { $('reveal-title').focus({preventScroll: true}); $('reveal-panel').scrollIntoView({block: 'start'}); }
    else { $('result-panel').scrollIntoView({block: 'nearest'}); if(!isMeaning())$('guess').focus({preventScroll: true}); }
  }
  function buy(type) {
    if(skipBusy)return;
    const draft = $('guess').value; if (!syncCurrent(activeDate, day.selected)) return;
    const r = roundFor(); if (!r) return; r.draft = draft;
    if (!Object.hasOwn(COST, type) || r.status !== 'playing') return;
    if(r.hints.includes(type)) {
      r.hintLevel=Math.min(3,(r.hintLevel||1)+1);save();render();
      announce(`Stopa ${r.hintLevel}: ${Guidance.clues(currentPuzzle(),mode())[r.hintLevel-1]}`);return;
    }
    if (totals().points < COST[type]) { $('hint-status').textContent = 'Na tuto nápovědu teď nemáš dost bodů.'; return; }
    r.hints.push(type);r.hintLevel=1; save(); render();
    announce(`Nápověda zakoupena za ${COST[type]} bodů. ${Guidance.clues(currentPuzzle(),mode())[0]}`);
  }
  async function share() {
    const r = roundFor(), index = puzzles.findIndex(p => p.id === day.selected) + 1;
    if (!r) return;
    const hintCount = Number(r.hints.length > 0);
    const text = `Šeptanda · ${Daily.displayDate(activeDate)} · Osobní výrok ${index}/${puzzles.length}\n${r.status === 'won' ? 'Rozluštěno' : r.paidSkip?`Přeskočeno −${Daily.skipCharge(r)} bodů`:'Odhaleno bez odměny'} · ${r.attempts.length} ${plural(r.attempts.length, 'pokus', 'pokusy', 'pokusů')} · ${hintCount} ${plural(hintCount, 'nápověda', 'nápovědy', 'nápověd')}\n${location.origin}${location.pathname}`;
    try { await navigator.clipboard.writeText(text); $('share-message').textContent = 'Výsledek je ve schránce. Řešení zůstalo tajemstvím.'; }
    catch (_) { $('share-message').textContent = 'Automatické kopírování není dostupné. Výsledek si můžeš vybrat a zkopírovat:'; const box = document.createElement('textarea'); box.value = text; box.readOnly = true; box.setAttribute('aria-label', 'Výsledek ke zkopírování'); $('share-message').append(box); box.select(); }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    if (button.dataset.open) { if (button.dataset.open === 'stats-dialog') renderStats(totals()); openDialog(button.dataset.open); }
    else if (button.hasAttribute('data-close')) button.closest('dialog').close();
    else if (button.dataset.select) select(button.dataset.select);
    else if(button.dataset.authorChoice){
      if(!isAuthor() || roundFor().status!=='playing' || (roundFor().hintLevel||0)<3 || !roundFor().hints.includes('clue'))return;
      const option=globalThis.SeptandaAuthors.options(currentPuzzle(),mode()).find(o=>o.id===button.dataset.authorChoice);if(!option)return;
      $('guess').value=option.label;submit({preventDefault(){}});
    }
    else if(button.dataset.meaningChoice){if(!isMeaning()||roundFor().status!=='playing')return;const o=globalThis.SeptandaAuthors.options(currentPuzzle(),mode()).find(o=>o.id===button.dataset.meaningChoice);if(o){$('guess').value=o.label;submit({preventDefault(){}});}}
    else if(button.dataset.authorName){$('guess').value=button.dataset.authorName;$('author-suggestions').replaceChildren();$('guess').focus();}
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
  $('guess').addEventListener('input',()=>{storeDraft();if(!isAuthor()||isMeaning())return;const choices=globalThis.SeptandaAuthors.suggestions($('guess').value);$('author-suggestions').innerHTML=choices.map(c=>`<button type="button" class="name-suggestion" data-author-name="${escape(c.name)}">${escape(c.name)}</button>`).join('');});
  $('reveal-transmission').addEventListener('click', buyTransmission);
  $('give-up').addEventListener('click', () => {
    if (!currentPuzzle() || skipBusy || roundFor().status!=='playing') return;
    const id = day.selected, date = activeDate;
    const free=isAuthor()&&totals().points<Daily.skipCost;
    ask(free?'Odhalit bez odměny?':'Přeskočit za 100 bodů?', free?'Výrok se odhalí a započítá do dnešní trojice. Body nezískáš ani neztratíš. Můžeš ho místo toho zdarma odložit.':'Odečte se 100 bodů a přejdeš na další výrok dnešní sady. Tento se počítá do denního limitu; jeho řešení zůstane v přehledu. Za přeskočený výrok nezískáš odměnu. Zakoupené stopy se nevracejí.', free?'Odhalit bez odměny':'Přeskočit · −100 bodů', async () => {
      if (!syncCurrent(date, id)) return; const r = roundFor(); if (r.status !== 'playing' || !free&&totals().points<Daily.skipCost) return;
      storeDraft();skipBusy=true;render();
      try {
        if(hasAccount() && globalThis.SeptandaCloud?.isActive())await globalThis.SeptandaCloud.skipPuzzle(date,id,free);
        else {const current=roundFor(id);current.status='revealed';if(free)current.freeReveal=true;else{current.paidSkip=true;current.skipCharge=Daily.skipCost;}current.draft='';save();}
        const next=Daily.nextId(day);
        if(next)day.selected=next;
        save();$('form-message').textContent='';
        announce((free?'Odhaleno bez odměny. ':'Přeskočeno za 100 bodů. ')+(next?'Pokračuj dalším výrokem.':'Dnešní sada je hotová.'));
      } catch(error){$('form-message').textContent=error.message;announce(error.message);}
      finally{skipBusy=false;render();}
      $('puzzle-heading').scrollIntoView({block:'start'});
    });
  });
  $('defer-puzzle').addEventListener('click',()=>{if(!isAuthor()||!storeDraft())return;const choices=Daily.playIds(day).filter(id=>id!==day.selected&&(!day.progress[id]||day.progress[id].status==='playing'));if(choices.length){select(choices[0]);announce('Odloženo zdarma. Ke všem třem otázkám se můžeš vrátit.');}else{$('form-message').textContent='Zbývá poslední otázka. Můžeš se k ní vrátit později; rozepsaný tip je uložený.';}});
  $('confirm-action').addEventListener('click', async () => { const task = confirmTask; confirmTask = null; $('confirm-dialog').close(); if (task) await task(); });
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
    announce('Nový den. Je připravena další osobní sada.');
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
  function changed(){save();document.dispatchEvent(new Event('septanda:progress'));}
  function notebook(id,saved){const records=[state.legacy.progress,...Object.values(state.days).map(d=>d.progress),...Object.values(state.archivedDays||{}).map(d=>d.progress)];if(!records.some(p=>['won','revealed'].includes(p[id]?.status)))return false;state.notebook={...(state.notebook||{}),[id]:{saved:!!saved,updatedAt:Date.now()}};changed();return true;}
  function rate(id,difficulty,helpful=null){if(!day.ids.includes(id)||!(difficulty===null&&typeof helpful==='boolean')&&!['easy','fair','hard','unclear'].includes(difficulty))return false;roundFor(id).feedback={difficulty,helpful:typeof helpful==='boolean'?helpful:null,updatedAt:Date.now()};changed();return true;}
    globalThis.SeptandaGame = Object.freeze({inspect:()=>JSON.parse(JSON.stringify(state)),notebook,rate,select,storageKey: () => KEY, setAccount, exportState, replaceState, guestState, hasAccount,backupPending,pendingBackup, scene: () => ({meaning:isMeaning(),mode:mode(),status:roundFor()?.status || 'waiting', score:roundFor()?.attempts.at(-1)?.score.total ?? null, attempts:roundFor()?.attempts.length || 0, id:currentPuzzle()?.id || null,fact:roundFor()?.status!=='playing'?(currentPuzzle()?.education?.summary||currentPuzzle()?.meaning||''):''})});
})();
