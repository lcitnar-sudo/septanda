import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
export async function makeCatalog(){
  const original=await readFile(new URL('content/original-puzzles.js',root),'utf8');
  const puzzles=JSON.parse(await readFile(new URL('content/new-puzzles.json',root),'utf8'));
  const calendar=JSON.parse(await readFile(new URL('content/schedule.json',root),'utf8'));
  const context=vm.createContext({});vm.runInContext(original,context);
  const legacyIds=Array.from(context.SEPTANDA_PUZZLES,p=>p.id);
  if(puzzles.length!==500)throw new Error('Expected500 new puzzles');
  const all=[...legacyIds,...puzzles.map(p=>p.id)];
  if(new Set(all).size!==509)throw new Error('Duplicate puzzle IDs');
  const schedule={version:1,timeZone:'Europe/Prague',start:calendar.startDate,end:calendar.endDate,legacyIds,days:calendar.days,afterEnd:calendar.afterEnd};
  const content=original+'\n/* Kurátorská zásoba100 dnů; původních9 záznamů zůstává kvůli historii. */\nglobalThis.SEPTANDA_PUZZLES.push(...'+JSON.stringify(puzzles)+');\nglobalThis.SEPTANDA_SCHEDULE='+JSON.stringify(schedule)+';\n';
  await writeFile(new URL('client/puzzles.js',root),content);
  return {puzzles:puzzles.length,days:calendar.days.length};
}
