import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
export async function makeCatalog(){
  const original=await readFile(new URL('content/original-puzzles.js',root),'utf8');
  const puzzles=JSON.parse(await readFile(new URL('content/new-puzzles.json',root),'utf8'));
  const calendar=JSON.parse(await readFile(new URL('content/schedule.json',root),'utf8'));
  const context=vm.createContext({});vm.runInContext(original,context);
  const legacyIds=Array.from(context.SEPTANDA_PUZZLES,p=>p.id);
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
  const schedule={version:1,timeZone:'Europe/Prague',start:calendar.startDate,end:calendar.endDate,legacyIds,days:calendar.days,afterEnd:calendar.afterEnd};
  const content=original+'\n/* Kurátorská zásoba100 dnů; původních9 záznamů zůstává kvůli historii. */\nglobalThis.SEPTANDA_PUZZLES.push(...'+JSON.stringify(puzzles)+');\nglobalThis.SEPTANDA_SCHEDULE='+JSON.stringify(schedule)+';\n';
  await writeFile(new URL('client/puzzles.js',root),content);
  return {puzzles:puzzles.length,days:calendar.days.length};
}
