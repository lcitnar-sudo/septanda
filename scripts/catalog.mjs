import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {assertHistoryContract} from './history-contract.mjs';
const root=new URL('../',import.meta.url);
export async function makeCatalog({recordHistory=false}={}){
  const original=await readFile(new URL('content/original-puzzles.js',root),'utf8');
  const puzzles=JSON.parse(await readFile(new URL('content/new-puzzles.json',root),'utf8'));
  const calendar=JSON.parse(await readFile(new URL('content/schedule.json',root),'utf8'));
  const review=JSON.parse(await readFile(new URL('content/editorial-review.json',root),'utf8'));
  const context=vm.createContext({});vm.runInContext(original,context);
  const legacyIds=Array.from(context.SEPTANDA_PUZZLES,p=>p.id);
  for(const p of context.SEPTANDA_PUZZLES)if(review.entries[p.id]?.specificClue)p.guidance={clues:[p.hint,review.entries[p.id].specificClue]};
  if(!puzzles.length || puzzles.length%5!==0)throw new Error('New puzzles must make complete daily sets');
  const all=[...legacyIds,...puzzles.map(p=>p.id)];
  if(new Set(all).size!==all.length)throw new Error('Duplicate puzzle IDs');
  vm.runInContext(await readFile(new URL('client/engine.js',root),'utf8'),context);
  const answers=new Map();
  for(const p of [...context.SEPTANDA_PUZZLES,...puzzles]) for(const answer of [p.answer,...p.variants]) {
    const normalized=context.SeptandaEngine.normalize(answer),other=answers.get(normalized);
    if(other && other!==p.id)throw new Error('Duplicate answer in puzzles '+other+' and '+p.id);
    answers.set(normalized,p.id);
  }
  const scheduled=calendar.days.flatMap(day=>Array.isArray(day)?day:day.ids);
  if(calendar.days.some(day=>(Array.isArray(day)?day:day.ids)?.length!==5) || scheduled.length!==puzzles.length || new Set(scheduled).size!==scheduled.length || scheduled.some(id=>!puzzles.some(p=>p.id===id)))throw new Error('Daily schedule repeats or omits a new puzzle');
  if(calendar.afterEnd!=='wait-for-new-content')throw new Error('The calendar must not restart old puzzles');
  if(review.version!==1 || new Set(review.approvedIds).size!==review.approvedIds.length || review.approvedIds.length<5)throw new Error('Missing editorial admission review');
  for(const p of [...context.SEPTANDA_PUZZLES,...puzzles]) {
    const entry=review.entries[p.id];
    if(!entry || !['approved','held'].includes(entry.status) || review.approvedIds.includes(p.id)!==(entry.status==='approved'))throw new Error('Unreviewed puzzle: '+p.id);
    if(!entry.contentSha256)throw new Error('Missing content review fingerprint: '+p.id);
    {
      const fields=Object.fromEntries(['answer','variants','hint','chain','guidance'].sort().map(k=>[k,p[k]??null]));
      if(createHash('sha256').update(JSON.stringify(fields)).digest('hex')!==entry.contentSha256)throw new Error('Content changed after editorial review: '+p.id);
    }
  }
  const schedule={version:1,timeZone:'Europe/Prague',start:calendar.startDate,end:calendar.endDate,legacyIds,days:calendar.days,afterEnd:calendar.afterEnd,personal:{version:1,start:review.personalStart,approvedIds:review.approvedIds}};
  const authorData=JSON.parse(await readFile(new URL('content/authors.json',root),'utf8'));
  const proof=JSON.parse(await readFile(new URL('content/admission-proof.json',root),'utf8'));
  const quoteNorm=s=>String(s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const vocabulary=authorData.guidance;
  for(const [id,profile] of Object.entries({...authorData.profiles,...authorData.guessProfiles})){
    if(id==='folk')continue;
    const g=profile.guidance;
    if(!g||!vocabulary?.environments[g.environment]||!g.periods?.length||!g.domains?.length||!g.focus?.length||g.periods.some(k=>!vocabulary.periods[k]||!Number.isInteger(vocabulary.periods[k].order))||g.domains.some(k=>!vocabulary.domains[k])||g.focus.some(k=>!vocabulary.focus[k]))throw Error('Chybí ověřená vodítka osobnosti: '+id);
  }
  for(const [id,entry] of Object.entries(authorData.entries)){
    const p=context.SEPTANDA_PUZZLES.find(p=>p.id===id)||puzzles.find(p=>p.id===id),profile=authorData.profiles[entry.profile];
    if(!p || !profile || !profile.aliases?.length || entry.clues?.length!==3)throw Error('Neověřené autorství: '+id);
    if(entry.admission){const evidence=proof.entries[id];if(!evidence||evidence.quote!==p.answer||!entry.sourceURLs.includes(evidence.url)||!evidence.match.includes(quoteNorm(p.answer))||!/^[a-f0-9]{64}$/.test(evidence.sourceSha256))throw Error('Chybí primární doklad nového obsahu: '+id);}
    else if(!review.approvedIds.includes(id))throw Error('Chybí schválení otázky: '+id);
    if(entry.meaning&&(entry.profile!=='folk'||entry.meaning.options?.length!==4||new Set(entry.meaning.options.map(o=>o.label)).size!==4||entry.meaning.options.filter(o=>o.id==='meaning'&&o.label===entry.meaning.correct).length!==1))throw Error('Neplatné možnosti významu: '+id);
    for(const use of entry.relatedUses||[])if(!use.id||!use.label||!use.aliases?.length||!use.explanation||!use.source?.label||!use.source?.url?.startsWith('https://')||!entry.sourceURLs.includes(use.source.url))throw Error('Nedoložené související použití: '+id);
    if(entry.story&&(!Array.isArray(entry.story.paragraphs)||entry.story.paragraphs.length<1||entry.story.paragraphs.length>4||entry.story.paragraphs.some(text=>typeof text!=='string'||!text.trim()||text.length>1800)||!entry.story.sourceURLs?.length||entry.story.sourceURLs.some(url=>!entry.sourceURLs.includes(url))||!entry.story.reviewedAt))throw Error('Neověřený příběh výroku: '+id);
    const original=entry.original;
    if(original&&(!['la','fr','it','en','de','grc','lzh'].includes(original.lang)||!original.language?.trim()||typeof original.text!=='string'||!original.text.trim()||original.text.length>1200||!original.source?.label?.trim()||!original.source.url?.startsWith('https://')||!entry.sourceURLs.includes(original.source.url)||!original.reviewedAt||(original.note!==undefined&&(typeof original.note!=='string'||original.note.length>300))))throw Error('Neověřené původní znění: '+id);
    if(entry.profile!=='folk'&&profile.guidance.environment!=='cz'&&!original)throw Error('Chybí původní jazyk cizojazyčného výroku: '+id);
    const {contentSha256,...fields}=entry;
    if(createHash('sha256').update(JSON.stringify({quote:p.answer,education:p.education,sources:p.sources,entry:fields,profile})).digest('hex')!==contentSha256)throw Error('Autorství se změnilo po kontrole: '+id);
  }
  await writeFile(new URL('client/authors-data.js',root),'globalThis.SEPTANDA_AUTHORS='+JSON.stringify(authorData)+';\n');
  const baseline=JSON.parse(await readFile(new URL('content/published-history.json',root),'utf8'));
  context.SEPTANDA_PUZZLES=[...context.SEPTANDA_PUZZLES,...puzzles];context.SEPTANDA_SCHEDULE=schedule;
  vm.runInContext(await readFile(new URL('client/daily.js',root),'utf8'),context);
  const contract={baseline,puzzles:context.SEPTANDA_PUZZLES,calendar,daily:context.SeptandaDaily,normalize:context.SeptandaEngine.normalize,appSource:await readFile(new URL('client/app.js',root),'utf8')};
  const snapshot=assertHistoryContract({...contract,requireComplete:!recordHistory});
  if(recordHistory)await writeFile(new URL('content/published-history.json',root),JSON.stringify(snapshot,null,2)+'\n');
  const legacyClues=Object.fromEntries(legacyIds.map(id=>[id,review.entries[id].specificClue]));
  const content=original+'\n(function(){const clues='+JSON.stringify(legacyClues)+';for(const p of globalThis.SEPTANDA_PUZZLES)if(clues[p.id])p.guidance={clues:[p.hint,clues[p.id]]};})();\n/* Archiv vydaných identit; nové osobní hry používají jen schválený výběr. */\nglobalThis.SEPTANDA_PUZZLES.push(...'+JSON.stringify(puzzles)+');\nglobalThis.SEPTANDA_SCHEDULE='+JSON.stringify(schedule)+';\n';
  await writeFile(new URL('client/puzzles.js',root),content);
  return {puzzles:puzzles.length,days:calendar.days.length};
}
