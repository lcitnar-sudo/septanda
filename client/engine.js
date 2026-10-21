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
  function evaluate(text, puzzle, mode='classic') {
    if(mode==='author-v1'||mode==='author-v2')return root.SeptandaAuthors.evaluate(text,puzzle,mode);
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
})(globalThis);
