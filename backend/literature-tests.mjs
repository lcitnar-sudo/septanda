import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import * as game from '../literature-game.mjs';
import {createLiteratureAPI} from './literature-api.mjs';
import {fileStore} from '../legacy-server/file-store.mjs';
import {fail} from './http.mjs';
const dir=await mkdtemp(path.join(os.tmpdir(),'septanda-literature-api-'));
const ids=['12345678-1234-1234-1234-123456789abc','22345678-1234-1234-1234-123456789abc'];
const db={async verifiedUser(req){const n=req.headers.get('authorization');if(!['Bearer synthetic-a','Bearer synthetic-b'].includes(n))fail(401,'Přihlas se.');return {id:ids[n.endsWith('a')?0:1],email:'synthetic@example.test',email_confirmed_at:'2026-10-24',user_metadata:{}};},async read(table,query,options){assert.equal(table,'septanda_profiles','never touches original game progress');assert(query.includes(options.user.id));return {data:[{display_name:'Testovací hráč'}]};}};
const store=fileStore(dir),handle=createLiteratureAPI({game,store,db,clock:()=>new Date('2026-10-24T10:00:00Z')});
const req=(body,who='a',origin='https://example.test')=>new Request('https://example.test/.netlify/functions/literature-player',{method:body?'POST':'GET',headers:{Authorization:'Bearer synthetic-'+who,Origin:origin,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
async function call(body,who='a'){const r=await handle(req(body,who));const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));return result;}
try{
  assert.equal((await handle(new Request('https://example.test/literature-player'))).status,401);
  assert.equal((await handle(req({action:'daily'},'a','https://evil.test'))).status,403);
  const a=await call(),b=await call(null,'b');assert.equal(a.account.id,ids[0]);assert.equal(b.account.id,ids[1]);
  assert.notEqual(a.state.seed,b.state.seed);assert.deepEqual((await call()).state,a.state,'new visit retains assigned daily text');
  const id=a.result,item=game.data.samples.find(s=>s.id===id),correct=game.data.authors.find(x=>x.id===item.author).name;
  await Promise.all([call({action:'hint',id,level:1}),call({action:'hint',id,level:1})]);
  assert.equal((await call()).state.rounds[id].hints,1,'concurrent/retried same hint is charged once');
  assert.equal((await handle(req({action:'hint',id,level:3}))).status,409);
  await call({action:'draft',id,text:'Rozepsaná odpověď'});assert.equal((await call()).state.rounds[id].draft,'Rozepsaná odpověď');
  const solved=await call({action:'answer',id,text:correct});assert.equal(solved.result.kind,'correct');assert.equal(game.engine.award(solved.state.rounds[id]),150);
  await call({action:'hint',id,level:2});await call({action:'reveal',id});await call({action:'answer',id,text:correct});
  assert.equal(game.engine.award((await call()).state.rounds[id]),150,'terminal award never changes on retries');
  await call({action:'save',id,saved:true});assert((await call()).state.saved.includes(id));await call({action:'save',id,saved:false});assert(!(await call()).state.saved.includes(id));
  assert.equal(Object.keys((await call(null,'b')).state.rounds).length,1,'other player cannot see history');
  const other=game.data.samples.find(s=>s.id!==id),guest=game.engine.fresh('guest');game.engine.open(guest,other.id,'2026-10-24');guest.rounds[other.id].status='solved';
  const imported=await call({action:'import',state:guest});assert.equal(imported.state.rounds[other.id].status,'playing','client cannot invent a solved record');
  game.engine.submit(guest,other,other.name,game.data.authors,'2026-10-24');
  // Build the genuine guest round from scratch, then explicitly import it.
  guest.rounds[other.id]=game.engine.fresh('empty').rounds[other.id];delete guest.rounds[other.id];game.engine.submit(guest,other,other.name,game.data.authors,'2026-10-24');
  const valid=await call({action:'import',state:guest});assert.equal(valid.state.rounds[other.id].status,'solved');assert.equal(valid.state.rounds[id].status,'solved','old account result preserved');
  const before=JSON.stringify(valid.state);assert.equal((await handle(req({action:'answer',id:'../../players/'+ids[1],text:'x'}))).status,400);assert.equal(JSON.stringify((await call()).state),before);
  const corrupt={...guest,rounds:{L01:{status:'solved',hints:-50,draft:'',attempts:[]}}};assert.equal((await handle(req({action:'import',state:corrupt}))).status,400);
  const entries=await store.list({prefix:'players/'});assert.equal(entries.blobs.length,2);assert(entries.blobs.every(x=>ids.some(id=>x.key==='players/'+id)));
  console.log('Literary API: verified owner isolation, origin checks, persistent daily selection, concurrent hints, drafts, terminal awards and explicit validated guest import passed.');
}finally{await rm(dir,{recursive:true,force:true});}
