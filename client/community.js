(function () {
  'use strict';
  const form = document.getElementById('contact-form'), status = document.getElementById('contact-status'), button = document.getElementById('contact-submit');
  let sending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (sending || !form.reportValidity()) return;
    status.textContent = ''; status.classList.remove('is-success');
    if (/^(localhost|127(?:\.\d+){3}|\[::1\])$/.test(location.hostname) || location.protocol === 'file:') {
      status.textContent = 'V místním náhledu se zprávy neodesílají. Formulář bude přijímat zprávy po nahrání na Netlify a zapnutí detekce formulářů.';
      return;
    }
    sending = true; button.disabled = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(),15000);
    try {
      const body = new URLSearchParams(new FormData(form));
      const response = await fetch('/', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString(),signal:controller.signal});
      if (!response.ok) throw new Error('Zprávu se nepodařilo odeslat. Text zůstal ve formuláři; zkus to prosím za chvíli.');
      form.reset(); status.textContent = 'Děkujeme, zpráva byla odeslána.'; status.classList.add('is-success');
    } catch (error) {
      status.classList.remove('is-success');
      status.textContent = error.name === 'AbortError' ? 'Odesílání trvá příliš dlouho. Text zůstal ve formuláři; zkus to prosím znovu.' : error instanceof TypeError ? 'Spojení se nepodařilo. Zpráva zůstala ve formuláři.' : error.message;
    } finally { clearTimeout(timeout); sending = false; button.disabled = false; }
  });
})();

(function (root) {
  'use strict';
  const $ = id => document.getElementById(id), status = $('progress-transfer-status');
  let selected = null;
  function clearFile() { selected = null; $('progress-file').value = ''; $('progress-file-confirm').hidden = true; $('progress-file-preview').textContent = ''; }
  $('profile-export').addEventListener('click', () => {
    const state = root.SeptandaGame.exportState();
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'}), url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'septanda-postup-' + root.SeptandaDaily.dayKey() + '.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
    status.textContent = 'Export je připravený ke stažení. Soubor uchovej v soukromí.';
  });
  $('progress-file').addEventListener('change', async () => {
    selected = null; $('progress-file-confirm').hidden = true; $('progress-file-preview').textContent = ''; status.textContent = '';
    const file = $('progress-file').files?.[0]; if (!file) return;
    try {
      if (file.size > 1800000) throw new Error('Soubor je příliš velký pro jednorázový přenos. Limit je 1,8 MB.');
      const raw = JSON.parse(await file.text());
      if (!raw || raw.version !== 6) throw new Error('Vyber export herního postupu Šeptandy ve formátu JSON verze 6.');
      if (Object.keys(raw.days || {}).some(day => !root.SeptandaDaily.validDay(day) || day > root.SeptandaDaily.dayKey())) throw new Error('Soubor obsahuje neplatný nebo budoucí herní den.');
      const clean = root.SeptandaDaily.sanitizeState(raw); if (!clean) throw new Error('Soubor se nepodařilo přečíst.');
      const totals = root.SeptandaDaily.totals(clean);
      if (![clean.legacy?.progress || {}, ...Object.values(clean.days || {}).map(day => day.progress || {})].some(progress => Object.values(progress).some(round => round.attempts?.length || round.hints?.length || round.draft || round.status !== 'playing'))) throw new Error('Soubor neobsahuje žádný odehraný postup.');
      selected = {state:clean,key:root.SeptandaGame.storageKey()};
      $('progress-file-preview').textContent = file.name + ' · ' + totals.solved + ' rozluštěno · ' + totals.attempts + ' tipů. Potvrzením se postup sloučí s účtem „' + $('profile-name').textContent + '“. Dosavadní záznamy účtu se zachovají. Přidej pouze svůj vlastní postup.';
      $('progress-file-confirm').hidden = false;
    } catch (error) { status.textContent = error instanceof SyntaxError ? 'Soubor není platný JSON export Šeptandy.' : error.message; }
  });
  $('progress-file-confirm').addEventListener('click', async () => {
    if (!selected) return;
    if (selected.key !== root.SeptandaGame.storageKey()) { clearFile(); status.textContent = 'Účet se změnil. Vyber soubor znovu.'; return; }
    $('progress-file-confirm').disabled = true; status.textContent = '';
    try { await root.SeptandaCloud.importLocalState(selected.state); clearFile(); status.textContent = 'Postup ze souboru je přidaný do účtu.'; }
    catch (error) { status.textContent = error.message || 'Přenos se nepodařil. Soubor zůstal připravený k dalšímu pokusu.'; }
    finally { $('progress-file-confirm').disabled = false; }
  });
  $('profile-dialog').addEventListener('close', clearFile);
})(globalThis);
