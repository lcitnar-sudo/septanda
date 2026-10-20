/* Factual word feedback and editorial clues; no claim of measuring semantic understanding. */
(function(root){
  'use strict';
  const normalize=root.SeptandaEngine.normalize;
  const stop=new Set(['a','i','v','ve','z','ze','s','se','si','je','jsou','jsem','jsi','byl','byla','bylo','by','to','ten','ta','te','do','na','po','o','u','k','ke','co','kdo','kdyz','jak','tak','ale','ani','aby','ze','ma','mit','me','mi','ti','tu','tebe','toho','tom','pro','pak']);
  const words=text=>normalize(text).split(' ').filter(Boolean);
  function feedback(text,puzzle,accepted=false,mode='classic'){
    if(mode==='author-v1')return root.SeptandaAuthors.feedback(text,puzzle,accepted);
    const typed=[...new Set(words(text).filter(w=>w.length>=3 && !stop.has(w)))];
    let matched=[];
    for(const reference of [puzzle.answer,...puzzle.variants]){
      const tokens=new Set(words(reference));
      const hits=typed.filter(w=>tokens.has(w));
      if(hits.length>matched.length)matched=hits;
    }
    return {accepted,matched,
      title:accepted?'Rozluštěno.':matched.length?'Tahle slova už sedí.':'Zkus najít jiná slova.',
      detail:accepted?'Původní výrok je zpátky.':matched.length?'Patří do jedné z přijímaných podob výroku. Zkus na nich postavit zbytek ustáleného znění.':'Zatím se neshoduje žádné podstatné slovo. Vrať se k obrazu v zadání nebo si otevři stopu.',
      caution:'Shoda slov nepotvrzuje správný význam ani pořadí. Čárky a diakritiku neřeš.'};
  }
  function clues(puzzle,mode='classic'){
    if(mode==='author-v1')return root.SeptandaAuthors.get(puzzle).clues;
    const prepared=puzzle.guidance?.clues?.filter(x=>typeof x==='string' && x.trim()) || [puzzle.hint];
    const reference=puzzle.variants.find(v=>normalize(v).split(' ').length>=3 && !/^[\x00-\x7f]+$/.test(v)) || puzzle.answer;
    const parts=reference.trim().split(/\s+/),count=parts.length<=4?1:2;
    const opening=parts.slice(0,count).join(' ').replace(/[,;:.!?]+$/,'');
    return [prepared[0],prepared[1] || 'Zkus si vybavit konkrétní obraz a ustálený obrat, ze kterého mohl vzniknout.',`Jedna přijímaná podoba začíná „${opening}…“. Zkus ji doplnit.`];
  }
  root.SeptandaGuidance=Object.freeze({feedback,clues});
})(globalThis);
