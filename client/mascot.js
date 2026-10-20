/* Autorské ilustrace doplní manifest SEPTANDA_MASCOT_ASSETS. Bez obrázku se modul nezobrazuje. */
(function (root) {
  'use strict';
  const box = document.getElementById('mascot-guide'), image = document.getElementById('mascot-image'), copy = document.getElementById('mascot-copy');
  const states = Object.freeze({
    idle:{alt:'Šeptík, historický badatel s brašnou',copy:'Prozkoumáme, co se cestou změnilo.'},
    thinking:{alt:'Šeptík přemýšlí nad stopou',copy:'Která část zprávy mohla zůstat stejná?'},
    success:{alt:'Šeptík má radost z rozluštění',copy:'Máme to. Původní slova jsou zpátky.'},
    surprise:{alt:'Překvapený Šeptík nachází novou souvislost',copy:'Tohle už zní povědomě. Zkus původní znění.'},
    retry:{alt:'Šeptík hledá další stopu po neúspěšném pokusu',copy:'Zkus jiný úhel. Jaká myšlenka zůstává?'},
    discovery:{alt:'Šeptík objevuje historický dokument',copy:'Podíváme se, odkud slova pocházejí.'}
  });
  const authorCopy={idle:'Vypátráme, komu tahle slova patří.',thinking:'Čí hlas v těch slovech slyšíš?',success:'Máme původ. A za ním další příběh.',surprise:'Zkus jméno, které tě napadlo.',retry:'Zkus jinou osobnost nebo si vezmi stopu.',discovery:'Podíváme se na autora, význam i pramen.'};
  let authorMode=false;
  let active = 'idle', loadId = 0, lastPuzzle = null;
  function show(state) {
    if (!Object.hasOwn(states,state)) return;
    active = state;
    const assets = root.SEPTANDA_MASCOT_ASSETS || {}, asset = assets[state] || assets.idle;
    const src = typeof asset === 'string' ? asset : asset?.src;
    if (!src) { box.hidden = true; return; }
    const ticket = ++loadId, probe = new Image();
    probe.onload = () => { if (ticket !== loadId) return; image.src = src; image.alt = states[state].alt; copy.textContent = authorMode?authorCopy[state]:states[state].copy; box.dataset.state = state; box.hidden = false; };
    probe.onerror = () => { if (ticket === loadId) box.hidden = true; };
    probe.src = src;
  }
  function reflect(scene) {
    if (!scene) return;
    const changed=authorMode!==(scene.mode==='author-v1');authorMode=scene.mode==='author-v1';
    const next = scene.status === 'won' ? 'success' : scene.status === 'revealed' ? 'discovery' : scene.attempts ? scene.score >= 80 ? 'surprise' : 'retry' : 'idle';
    if (lastPuzzle !== scene.id || next !== active || changed) show(next);
    lastPuzzle = scene.id;
  }
  document.addEventListener('septanda:scene', event => reflect(event.detail));
  document.getElementById('guess').addEventListener('input', () => { if (document.getElementById('guess').value.trim()) { if (active !== 'thinking') show('thinking'); } else reflect(root.SeptandaGame?.scene?.()); });
  document.addEventListener('septanda:mascot-assets', () => show(active));
  root.SeptandaMascot = Object.freeze({states:Object.keys(states),show});
  reflect(root.SeptandaGame?.scene?.());
  if (lastPuzzle === null) show('idle');
})(globalThis);
