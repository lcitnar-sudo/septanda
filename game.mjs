// Same catalog and scoring as the browser. No player data.
const root={SEPTANDA_PUZZLES:[{"id":"caesar-victory","answer":"Přišel jsem, viděl jsem, zvítězil jsem.","variants":["Přišel, viděl, zvítězil.","Přišel jsem, viděl jsem a zvítězil jsem.","Přišel, viděl a zvítězil.","Veni, vidi, vici."],"concepts":[["prisel","dorazil","prisli","prichod"],["videl","spatril","rozhl","uvidel"],["zvitez","vyhral","vyhrat","vitez","porazil"]],"paraphrases":["Dorazil jsem na místo, prohlédl si situaci a vyhrál.","Rychle jsem přišel a porazil protivníka."],"contradictions":["prohral","prohrat","nezvitez","nevyhral","odesel","utekl"]},{"id":"proverb-pit","answer":"Kdo jinému jámu kopá, sám do ní padá.","variants":["Kdo jinému jámu kope, sám do ní spadne.","Kdo druhému jámu kopá, sám do ní padá.","Kdo jinému jámu kopá, ten do ní sám padá.","Kdo jinému jámu kope, sám do ní padá."],"concepts":[["jinemu","druhemu","nekomu","ostatnim"],["jamu","past","skod","ubliz"],["sam","sobe","vrati","doplat"],["pada","spadne","padne","vrati","ubliz","uskod","doplat"]],"paraphrases":["Kdo jinému škodí, uškodí nakonec sám sobě.","Když někomu ublížíš, nakonec se ti to vrátí.","Špatné činy se člověku vrátí."],"contradictions":["nepada","nespadne","nevrati","neuskodi","zachrani"]},{"id":"poem-may","answer":"Byl pozdní večer — první máj — večerní máj — byl lásky čas.","variants":["Byl pozdní večer, první máj, večerní máj, byl lásky čas.","Byl pozdní večer první máj večerní máj byl lásky čas."],"concepts":[["pozdni","vecer","soumrak","stmiv"],["prvni","prvniho"],["maj","kveten","kvetna"],["lask","zamil","milenc"]],"paraphrases":["První květnový večer byl časem zamilovaných.","Pozdě večer na začátku května byl čas na lásku."],"contradictions":["rano","ranni","nenavist","prosinec","leden"]},{"id":"caesar-dice","answer":"Kostky jsou vrženy.","variants":["Kostka je vržena.","Alea iacta est.","Iacta alea est."],"concepts":[["kostk","rozhod","krok"],["vrzen","hod","nevrat","zpet","ucinen"]],"paraphrases":["Rozhodnutí už padlo a nelze je vzít zpět.","Byl učiněn nevratný krok."],"contradictions":["nejsou","neni","nevrzen","nerozhod","odvolano"]},{"id":"proverb-work","answer":"Bez práce nejsou koláče.","variants":["Bez práce není koláč."],"concepts":[["prac","usili","namah","snaz","pricin"],["kolac","odmen","vysled","uspech"],["bez","nejsou","neni","musis","nutn","zadarm"]],"paraphrases":["Bez úsilí nepřijde odměna.","Chceš-li výsledek, musíš se přičinit.","Úspěch vyžaduje práci."],"contradictions":["jsou kolace","vsechno zadarmo","usili neni treba"]},{"id":"poem-noon","answer":"U lavice dítě stálo, z plna hrdla křičelo.","variants":["U lavice dítě stálo, zplna hrdla křičelo."],"concepts":[["lavic","sedatk","stol"],["dite","deck","ditko"],["stal","stoji","postav"],["kric","krik","rv","hlasit"]],"paraphrases":["Dítě stálo u lavice a hlasitě křičelo.","Vedle lavice stálo dítě a řvalo."],"contradictions":["mlcelo","tise","spalo","sedelo"]},{"id":"descartes","answer":"Myslím, tedy jsem.","variants":["Myslím, tudíž jsem.","Myslím, a proto jsem.","Cogito, ergo sum.","Je pense, donc je suis."],"concepts":[["mysl","premysl","pochyb","cogito"],["jsem","exist","byti","sum"]],"paraphrases":["To, že přemýšlím, dokazuje mou existenci.","Mohu pochybovat o všem, ale musím existovat, když pochybuji."],"contradictions":["nemyslim","nejsem","neexistuji","neexistuje"]},{"id":"proverb-measure","answer":"Dvakrát měř, jednou řež.","variants":["Dvakrát měř a jednou řež.","Dvakrát měřit, jednou řezat."],"concepts":[["dvakrat","dvakrate","dvakrat"],["mer","zmer","over","promysl"],["jednou","jedenkrat"],["rez","udelej","jednej","cin"]],"paraphrases":["Než něco uděláš, důkladně si to promysli.","Nejprve si věc ověř, teprve potom jednej."],"contradictions":["jednou mer","dvakrat rez","nemer"]},{"id":"poem-bouquet","answer":"Zemřela matka a do hrobu dána, siroty po ní zůstaly.","variants":["Zemřela matka a do hrobu dána, siroty po ní zůstaly;"],"concepts":[["zemrel","umrel","smrt"],["matka","mama","mamink","matic"],["hrob","pohrb"],["sirot","zustal","deti"]],"paraphrases":["Matka zemřela a byla pohřbena, zůstaly po ní osiřelé děti.","Po smrti maminky zůstaly děti samy."],"contradictions":["nezemrela","ozila","otec","nezustaly"]}]};
/* Deterministické místní hodnocení. Rozpoznává celé znění i uvnitř delšího úryvku. */
(function (root) {
  'use strict';
  const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = text => normalize(text).split(' ').filter(Boolean);
  const stop = new Set(['a', 'i', 'jsem', 'je', 'jsou', 'byl', 'byla', 'se', 'si', 'to', 'do', 'v', 've', 'u', 'z', 'ze', 'na', 'po', 'ni', 'ten', 'ta', 'kdo', 'ze', 's', 'o', 'tom', 'mi']);
  const optional = new Set(['a', 'i']);
  const negativeExceptions = new Set(['nebo', 'nez', 'nezli', 'nejdriv', 'nejprve', 'nejen', 'nekdo', 'nekdy', 'nekde', 'neco', 'nekteri', 'nekolik']);
  const isNegative = word => ['ne', 'nikdy', 'nikoli', 'nikoliv', 'zadny', 'nepravda'].includes(word) || (word.length >= 4 && word.startsWith('ne') && !negativeExceptions.has(word));
  function distance(a, b, transpositions = false) {
    let before = null, row = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) {
        next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (transpositions && before && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) next[j] = Math.min(next[j], before[j - 2] + 1);
      }
      before = row; row = next;
    }
    return row[b.length];
  }
  function typo(a, b) {
    if (a === b) return 0;
    // Krátká slova ani změnu záporu nepovažujeme za překlep.
    if (Math.min(a.length, b.length) < 3 || Math.max(a.length, b.length) < 4 || isNegative(a) !== isNegative(b)) return Infinity;
    const edits = distance(a, b, true);
    return edits <= (Math.min(a.length, b.length) >= 8 ? 2 : 1) ? edits : Infinity;
  }
  function wordSimilarity(a, b) {
    if (a === b) return 1;
    const edits = typo(a, b);
    return Number.isFinite(edits) ? 1 - edits / Math.max(a.length, b.length) : 0;
  }
  function lexical(guess, reference) {
    const a = tokens(guess), b = tokens(reference), used = new Set();
    let matched = 0;
    for (const word of a) {
      let best = 0, index = -1;
      b.forEach((other, i) => { const s = used.has(i) ? 0 : wordSimilarity(word, other); if (s > best) { best = s; index = i; } });
      if (index >= 0) { used.add(index); matched += best * (stop.has(word) ? .3 : 1); }
    }
    const wa = a.reduce((s, w) => s + (stop.has(w) ? .3 : 1), 0), wb = b.reduce((s, w) => s + (stop.has(w) ? .3 : 1), 0);
    const overlap = 2 * matched / Math.max(1, wa + wb);
    const edit = 1 - distance(normalize(guess), normalize(reference)) / Math.max(normalize(guess).length, normalize(reference).length, 1);
    return Math.min(1, .8 * overlap + .2 * Math.max(0, edit));
  }
  function conceptCoverage(guess, puzzle) {
    const words = tokens(guess);
    return puzzle.concepts.filter(group => group.some(stem => words.some(w => w === stem || (stem.length >= 4 && w.startsWith(stem))))).length / puzzle.concepts.length;
  }
  // Srovnání v pořadí slov: okolní verše jsou zdarma, vnitřní odchylky mají omezený rozpočet.
  // Nehledáme jen společná klíčová slova; musí být poznat celé původní znění.
  function align(words, reference) {
    const ref = tokens(reference);
    const blank = start => ({cost: 0, start, matched: 0, typos: 0, missing: 0, conjunctions: 0, extra: 0, wrong: 0, edgeMissing: 0});
    let row = Array.from({length: words.length + 1}, (_, j) => blank(j));
    const add = (state, delta) => ({...state, ...Object.fromEntries(Object.entries(delta).map(([key, value]) => [key, state[key] + value]))});
    const better = (a, b) => a.cost < b.cost - 1e-8 || (Math.abs(a.cost - b.cost) < 1e-8 && a.matched > b.matched) ? a : b;
    const cache = new Map();
    for (let i = 0; i < ref.length; i++) {
      const word = ref[i];
      const deletion = optional.has(word) ? {cost: .2, conjunctions: 1} : {cost: 1.25, missing: 1, edgeMissing: Number(i === 0 || i === ref.length - 1)};
      const next = [add(row[0], deletion)];
      for (let j = 1; j <= words.length; j++) {
        const key = word + ':' + words[j - 1];
        if (!cache.has(key)) cache.set(key, typo(word, words[j - 1]));
        const edits = cache.get(key);
        const match = add(row[j - 1], Number.isFinite(edits) ? {cost: edits * .35, matched: 1, typos: edits} : {cost: 2, wrong: 1});
        next[j] = better(match, better(add(row[j], deletion), add(next[j - 1], {cost: .8, extra: 1})));
      }
      row = next;
    }
    let best = {...row[0], end: 0};
    row.forEach((state, j) => { best = better({...state, end: j}, best); });
    return {...best, reference: ref, text: words.slice(best.start, best.end).join(' '), prefix: words.slice(0, best.start).join(' ')};
  }
  function conflict(text, puzzle, reference) {
    const known = tokens(reference).filter(isNegative);
    const negative = tokens(text).some(w => isNegative(w) && !known.some(k => Number.isFinite(typo(k, w))));
    return negative || puzzle.contradictions.some(c => new RegExp('(?:^| )' + c + (c.includes(' ') ? '(?: |$)' : '[a-z]*(?: |$)')).test(text));
  }
  function deniedPrefix(text) {
    return /(?:^| )(?:ne|nikoli|nikoliv|nepravda)(?: |$)/.test(text) || /(?:^| )(?:neni|nebyla|nebylo) pravda(?: |$)/.test(text) || /(?:^| )(?:tohle|toto|to) neni(?: |$)/.test(text);
  }
  function evaluate(text, puzzle) {
    const n = normalize(text);
    if (!n) return {total: 0, words: 0, meaning: 0, accepted: false, conflict: false};
    const references = [puzzle.answer, ...puzzle.variants];
    if (references.some(v => normalize(v) === n)) return {total: 100, words: 100, meaning: 100, accepted: true, conflict: false};
    const windows = references.map(r => align(tokens(n), r));
    for (const match of windows) {
      const length = match.reference.length;
      const faithful = match.wrong === 0 && match.edgeMissing === 0 && match.typos <= (length >= 8 ? 3 : 1) && match.conjunctions <= 2 && match.missing <= (length >= 8 ? 1 : 0) && match.extra <= 1 && match.matched >= Math.max(3, length - match.conjunctions - match.missing);
      if (!faithful || !match.text || conflict(match.text, puzzle, match.reference.join(' ')) || deniedPrefix(match.prefix)) continue;
      const exact = match.cost === 0;
      return {total: exact ? 100 : 97, words: exact ? 100 : 95, meaning: 100, accepted: true, conflict: false};
    }
    const words = Math.round(100 * Math.max(...references.map((r, i) => Math.max(lexical(n, r), windows[i].text ? lexical(windows[i].text, r) : 0))));
    const coverage = conceptCoverage(n, puzzle), paraphrase = Math.max(0, ...puzzle.paraphrases.map(r => lexical(n, r)));
    let meaning = Math.round(100 * Math.max(coverage * .96, paraphrase * .98));
    const hasConflict = references.every(r => conflict(n, puzzle, normalize(r))) || deniedPrefix(n);
    if (hasConflict) meaning = Math.min(meaning, 25);
    return {total: Math.min(96, Math.round(words * .6 + meaning * .4)), words, meaning, accepted: false, conflict: hasConflict};
  }
  function label(total) {
    return total >= 97 ? 'Rozluštěno' : total >= 80 ? 'Téměř rozluštěno' : total >= 60 ? 'Na správné stopě' : total >= 40 ? 'Zachycený význam' : total >= 20 ? 'Vzdálená ozvěna' : 'Ztracená slova';
  }
  root.SeptandaEngine = Object.freeze({normalize, evaluate, label});
})(root);

/* Pět výroků za pražský kalendářní den; stav hráče patří tomuto prohlížeči. */
(function (root) {
  'use strict';
  const pool = root.SEPTANDA_PUZZLES, engine = root.SeptandaEngine;
  const byId = new Map(pool.map(p => [p.id, p]));
  const HINT_COST = {clue: 50, small: 30, previous: 60};
  if (pool.length < 5) throw new Error('Denní sada potřebuje alespoň pět výroků.');
  function dayKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  function validDay(key) {
    if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    const date = new Date(key + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key;
  }
  function displayDate(key) {
    return new Intl.DateTimeFormat('cs-CZ', {timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'}).format(new Date(key + 'T12:00:00Z'));
  }
  function plan(key) {
    if (!validDay(key)) throw new Error('Neplatný den.');
    let seed = 2166136261;
    for (const char of 'septanda-daily-1:' + key) { seed ^= char.charCodeAt(0); seed = Math.imul(seed, 16777619); }
    const random = () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
      n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
    const ids = pool.map(p => p.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    return ids.slice(0, 5);
  }
  const blankRound = () => ({attempts: [], hints: [], status: 'playing', draft: ''});
  function cleanRound(source, puzzle) {
    const round = blankRound();
    if (!source || typeof source !== 'object') return round;
    if (Array.isArray(source.attempts)) {
      for (const a of source.attempts) {
        if (!a || typeof a.text !== 'string' || a.text.length > 400 || !engine.normalize(a.text)) continue;
        const score = engine.evaluate(a.text, puzzle);
        round.attempts.push({text: a.text, time: typeof a.time === 'number' ? a.time : 0, score});
        if (score.accepted) round.status = 'won';
      }
    }
    if (source.status === 'revealed') round.status = 'revealed';
    if (Array.isArray(source.hints)) round.hints = [...new Set(source.hints.filter(h => Object.hasOwn(HINT_COST, h)))];
    round.draft = typeof source.draft === 'string' ? source.draft.slice(0, 400) : '';
    return round;
  }
  function cleanProgress(source, ids) {
    const out = {};
    if (!source || typeof source !== 'object') return out;
    for (const id of ids) if (Object.hasOwn(source, id)) out[id] = cleanRound(source[id], byId.get(id));
    return out;
  }
  function createState(legacy) {
    return {version: 6, legacy: {progress: legacy?.version === 5 ? cleanProgress(legacy.progress, pool.map(p => p.id)) : {}}, days: {}};
  }
  function sanitizeState(raw) {
    const state = createState(null);
    if (!raw || raw.version !== 6) return null;
    state.legacy.progress = cleanProgress(raw.legacy?.progress, pool.map(p => p.id));
    if (raw.days && typeof raw.days === 'object') {
      for (const [key, source] of Object.entries(raw.days)) {
        if (!validDay(key) || !source || typeof source !== 'object') continue;
        const ids = Array.isArray(source.ids) && source.ids.length === 5 && new Set(source.ids).size === 5 && source.ids.every(id => byId.has(id)) ? source.ids.slice() : plan(key);
        const day = {ids, selected: source.selected, progress: cleanProgress(source.progress, ids)};
        if (!canSelect(day, day.selected)) day.selected = nextId(day) || ids[4];
        state.days[key] = day;
      }
    }
    return state;
  }
  function ensureDay(state, key) {
    if (!Object.hasOwn(state.days, key)) {
      const ids = plan(key);
      state.days[key] = {ids, selected: ids[0], progress: {}};
    }
    const day = state.days[key];
    if (!canSelect(day, day.selected)) day.selected = nextId(day) || day.ids[4];
    return day;
  }
  function roundFor(day, id = day.selected) {
    if (!day.ids.includes(id)) return null;
    return day.progress[id] || (day.progress[id] = blankRound());
  }
  function nextId(day) { return day.ids.find(id => !day.progress[id] || day.progress[id].status === 'playing') || null; }
  function canSelect(day, id) {
    const index = day.ids.indexOf(id), next = nextId(day);
    return index >= 0 && (next === null || index <= day.ids.indexOf(next));
  }
  function dayTotals(day) {
    return day.ids.reduce((t, id) => {
      const r = day.progress[id] || blankRound();
      t.solved += Number(r.status === 'won'); t.completed += Number(r.status !== 'playing');
      t.revealed += Number(r.status === 'revealed'); t.attempts += r.attempts.length;
      return t;
    }, {solved: 0, completed: 0, revealed: 0, attempts: 0});
  }
  function totals(state) {
    const t = {solved: 0, spent: 0, attempts: 0, revealed: 0, points: 100};
    const rounds = [state.legacy.progress, ...Object.values(state.days).map(day => day.progress)];
    for (const progress of rounds) for (const r of Object.values(progress)) {
      t.solved += Number(r.status === 'won'); t.revealed += Number(r.status === 'revealed');
      t.spent += r.hints.reduce((sum, h) => sum + HINT_COST[h], 0); t.attempts += r.attempts.length;
    }
    t.points = 100 + t.solved * 200 - t.spent;
    return t;
  }
  root.SeptandaDaily = Object.freeze({dayKey, validDay, displayDate, plan, blankRound, createState, sanitizeState, ensureDay, roundFor, nextId, canSelect, dayTotals, totals});
})(root);

export const puzzles=root.SEPTANDA_PUZZLES, engine=root.SeptandaEngine, daily=root.SeptandaDaily;
