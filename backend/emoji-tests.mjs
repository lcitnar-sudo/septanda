import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import * as game from '../emoji-game.mjs';
import {createEmojiAPI} from './emoji-api.mjs';
import {fileStore} from '../legacy-server/file-store.mjs';
import {fail} from './http.mjs';
const dir=await mkdtemp(path.join(os.tmpdir(),'septanda-emoji-test-')),ids=['synthetic-a','synthetic-b'];
let date='2026-10-26';const db={async verifiedUser(req){const token=req.headers.get('authorization');const id=token?.slice(7);if(!ids.includes(id))fail(401,'Přihlas se.');return {id,email_confirmed_at:'2026-10-26'};},async read(){throw Error('Bonus must never read or alter the original database.');}};
const store=fileStore(dir),handle=createEmojiAPI({game,store,db,clock:()=>new Date(date+'T12:00Z')});
const req=(body={action:'daily'},id=ids[0],origin='https://test.example')=>new Request('https://test.example/.netlify/functions/emoji-player',{method:'POST',headers:{Authorization:'Bearer '+id,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
async function call(body,id){const r=await handle(req(body,id));const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return b;}
try{
  assert.equal((await handle(req({},'intruder'))).status,401);assert.equal((await handle(req({action:'daily'},ids[0],'https://evil.test'))).status,403);
  const a=await call(),b=await call(undefined,ids[1]),id=a.result,p=game.data.items.find(p=>p.id===id);
  assert.notEqual(a.state.seed,b.state.seed);assert.deepEqual((await call()).state,a.state);
  const unassigned=game.data.items.find(p=>p.id!==id);assert.equal((await handle(req({action:'reveal',id:unassigned.id}))).status,403);
  await Promise.all([call({action:'hint',id,level:1}),call({action:'hint',id,level:1})]);assert.equal((await call()).state.rounds[id].hints,1);
  await call({action:'draft',id,text:'Soukromý tip A'});assert.equal((await call()).state.rounds[id].draft,'Soukromý tip A');assert(!JSON.stringify((await call(undefined,ids[1])).state).includes('Soukromý'));
  const solved=await call({action:'answer',id,text:p.title});assert.equal(solved.result.kind,'correct');
  await call({action:'reveal',id});await call({action:'hint',id,level:2});assert.equal((await call()).state.rounds[id].status,'solved');assert.equal((await call()).state.rounds[id].hints,1);
  const guest=game.engine.fresh('guest');game.engine.open(guest,unassigned.id,date);guest.rounds[unassigned.id].status='solved';
  assert.equal((await call({action:'import',state:guest})).state.rounds[unassigned.id].status,'playing','claimed wins replayed, never trusted');
  delete guest.rounds[unassigned.id];game.engine.answer(guest,unassigned,unassigned.title,game.data.items,date);
  const imported=await call({action:'import',state:guest});assert.equal(imported.state.rounds[unassigned.id].status,'solved');assert.equal(imported.state.rounds[id].status,'solved');
  assert.equal((await handle(req({action:'answer',id,text:'x'.repeat(151)}))).status,400);
  assert.equal((await handle(req({action:'reveal',id:'../../players/'+ids[1]}))).status,400);
  for(let n=1;n<=12;n++){date='2026-11-'+String(n).padStart(2,'0');await call();}
  const end=await call();assert.equal(Object.keys(end.state.rounds).length,10);assert.equal(end.result,null,'bank exhaustion never recycles');
  const list=await store.list({prefix:'players/'});assert.equal(list.blobs.length,2);
  console.log('Emoji API: verified ownership, origin checks, private separate store, concurrent/idempotent hints, aliases, drafts, validated guest import, date and no-repeat exhaustion passed.');
}finally{await rm(dir,{recursive:true,force:true});}
