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
