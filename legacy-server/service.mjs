import {createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
const digest=value=>createHash('sha256').update(value).digest('hex');
import {puzzles, engine, daily} from './game.mjs';
const byId = new Map(puzzles.map(p => [p.id,p]));
const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const response = (body, status=200, extra={}) => Response.json(body, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const accountKey=name=>digest(name.normalize('NFKC').toLocaleLowerCase('cs-CZ'));
const privateAccount=account=>({id:account.id,name:account.name,email:account.email || null});
function sessionToken(request) {
  const match=/(?:^|;\s*)septanda_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie') || '');
  return match?.[1] || null;
}
function cookie(request, token, maxAge) {
  return `septanda_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
}
async function session(store, request, now) {
  const token=sessionToken(request);if(!token)return null;
  const record=await store.get('sessions/'+digest(token),{type:'json'});
  if(!record || record.expires<=now.getTime())return null;
  const account=await store.get('accounts/'+accountKey(record.name),{type:'json'});
  return account?.id===record.id ? privateAccount(account) : null;
}
async function limit(store, key, maximum, now) {
  const bucket=Math.floor(now.getTime()/600000), path=`limits/${key}/${bucket}`;
  for(let i=0;i<6;i++) {
    const previous=await store.getWithMetadata(path,{type:'json'}), count=(previous?.data?.count || 0)+1;
    if(count>maximum)fail(429,'Příliš mnoho pokusů. Zkus to za deset minut.');
    const result=await store.setJSON(path,{count},previous?{onlyIfMatch:previous.etag}:{onlyIfNew:true});
    if(result.modified)return;
  }
  fail(429,'Příliš mnoho současných pokusů. Zkus to později.');
}
async function authenticate(store,request,body,now,remoteIP) {
  const name=nickname(body.name),key=accountKey(name);
  const email=body.action==='register'?emailAddress(body.email):null;
  if(typeof body.password!=='string' || body.password.length<10 || body.password.length>128)fail(400,'Heslo musí mít 10 až 128 znaků.');
  await limit(store,'account/'+key,10,now);
  let account;
  if(body.action==='register') {
    await limit(store,'registration/'+digest(remoteIP || 'local'),10,now);
    const salt=randomBytes(16).toString('hex'),hash=Buffer.from(await scrypt(body.password,salt,64)).toString('hex');
    account={id:randomBytes(16).toString('hex'),name,email,salt,hash};
    const result=await store.setJSON('accounts/'+key,account,{onlyIfNew:true});
    if(!result.modified)fail(409,'Tahle přezdívka už má účet. Zvol jinou nebo se přihlas.');
  } else {
    account=await store.get('accounts/'+key,{type:'json'});
    const hash=Buffer.from(await scrypt(body.password,account?.salt || 'missing-account-salt',64));
    if(!account || !timingSafeEqual(hash,Buffer.from(account.hash,'hex')))fail(401,'Přezdívka nebo heslo nesouhlasí.');
  }
  const token=randomBytes(32).toString('hex');
  await store.setJSON('sessions/'+digest(token),{id:account.id,name:account.name,expires:now.getTime()+30*86400000});
  return {account:privateAccount(account),cookie:cookie(request,token,30*86400)};
}
function emailAddress(value) {
  if(typeof value!=='string')fail(400,'Vyplň e-mail.');
  const email=value.trim().toLowerCase();
  // Common, unquoted e-mail addresses; validate again on the server.
  const syntax=/^[a-z0-9.!#$%&'*+\/=\?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
  const local=email.split('@')[0];
  if(email.length>254 || local.length>64 || !syntax.test(email) || local.startsWith('.') || local.endsWith('.') || local.includes('..'))fail(400,'Vyplň platný e-mail, například jmeno@domena.cz.');
  return email;
}
async function updateEmail(store,account,body,now) {
  if(!account)fail(401,'Pro doplnění e-mailu se přihlas.');
  const email=emailAddress(body.email);
  if(typeof body.password!=='string' || body.password.length<10 || body.password.length>128)fail(400,'Potvrď změnu současným heslem.');
  await limit(store,'email-change/'+account.id,10,now);
  const key='accounts/'+accountKey(account.name);
  for(let retry=0;retry<6;retry++) {
    const previous=await store.getWithMetadata(key,{type:'json'}),current=previous?.data;
    if(!current || current.id!==account.id)fail(401,'Přihlas se prosím znovu.');
    const hash=Buffer.from(await scrypt(body.password,current.salt,64));
    if(!timingSafeEqual(hash,Buffer.from(current.hash,'hex')))fail(401,'Současné heslo nesouhlasí.');
    if(current.email===email)return privateAccount(current);
    const next={...current,email};
    const saved=await store.setJSON(key,next,{onlyIfMatch:previous.etag});
    if(saved.modified)return privateAccount(next);
  }
  fail(409,'Účet se právě mění v jiném okně. Zkus uložení znovu.');
}
function nickname(value) {
  if (typeof value !== 'string') fail(400,'Vyplň přezdívku.');
  const name=value.normalize('NFC').trim().replace(/ +/g,' ');
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,23}$/u.test(name)) fail(400,'Použij 2 až 24 znaků: písmena, čísla, mezery, tečku, pomlčku nebo podtržítko.');
  return name;
}
function candidate(body, date, account, previous, known) {
  if (body.date !== date) fail(409,'Zkontroluj datum zařízení. Žebříček už používá dnešní české datum.');
  let ids=daily.plan(date);
  if(body.assignmentVersion===1 && date>=daily.personalStart) {
    if(body.assignmentSeed!==daily.accountSeed(account.id))fail(400,'Neplatná identita osobní sady.');
    const offered=body.rounds?.map(r=>r?.id);
    if(!Array.isArray(offered) || !(previous?[3,5].includes(offered.length):daily.validPersonalSize(date,offered.length)) || new Set(offered).size!==offered.length || !offered.every(id=>byId.has(id) && (previous || daily.approvedIDs.includes(id))))fail(400,'Neplatná osobní sada.');
    if(previous && previous.rounds.map(r=>r.id).join()!==offered.join())fail(409,'Dnešní sada už je uložená. Použij původní prohlížeč.');
    if(!previous && offered.some(id=>known.has(id)))fail(409,'Tento výrok už máš v dřívější historii.');
    ids=offered;
  }
  if (!Array.isArray(body.rounds) || body.rounds.length !== ids.length) fail(400,'Neplatná délka dnešní sady.');
  return body.rounds.map((r,i) => {
    if (!r || r.id !== ids[i] || !['playing','won','revealed'].includes(r.status) || typeof r.hint !== 'boolean') fail(400,'Neplatný výsledek dnešní sady.');
    if (r.status === 'won' && (typeof r.answer !== 'string' || r.answer.length > 400 || !engine.evaluate(r.answer,byId.get(r.id)).accepted)) fail(400,'Výsledek se nepodařilo ověřit.');
    return {id:r.id,status:r.status,hint:r.hint,...(r.status==='revealed' && (r.paidSkip===true || ids.length===3 || date>=daily.paidSkipStart)?{paidSkip:true}:{})};
  });
}
function merge(previous, incoming) {
  const rounds=incoming.map((r,i) => {
    const old=previous?.rounds?.[i];
    const terminal=old && old.status!=='playing';
    return {id:r.id, status:terminal?old.status:r.status, hint:r.hint || Boolean(old?.hint),...((terminal?old.status==='revealed' && old.paidSkip:r.paidSkip)?{paidSkip:true}:{})};
  });
  let locked=false;
  for (const r of rounds) {
    if (locked && (r.status !== 'playing' || r.hint)) fail(400,'Výroky se dokončují postupně.');
    if (r.status === 'playing') locked=true;
  }
  return rounds;
}
function publicEntry(record) {
  const solved=record.rounds.filter(r=>r.status==='won').length;
  const hints=record.rounds.filter(r=>r.hint).length;
  const skipped=record.rounds.filter(r=>r.status==='revealed' && r.paidSkip).length;
  return {id:record.id,name:record.name,points:solved*200-hints*50-skipped*daily.skipCost,solved,completed:record.rounds.filter(r=>r.status!=='playing').length};
}
async function board(store,date,id) {
  const {blobs}=await store.list({prefix:`records/${date}/`});
  const records=[];
  // Read in bounded batches instead of opening unbounded concurrent requests.
  for(let i=0;i<blobs.length;i+=20) {
    const batch=await Promise.all(blobs.slice(i,i+20).map(b=>store.get(b.key,{type:'json'})));
    records.push(...batch.filter(Boolean));
  }
  const entries=records.map(publicEntry).sort((a,b)=>b.points-a.points || a.name.localeCompare(b.name,'cs') || a.id.localeCompare(b.id));
  let rank=0;
  entries.forEach((entry,i)=>{if(i===0 || entry.points!==entries[i-1].points) rank=i+1;entry.rank=rank;});
  const me=id ? entries.find(e=>e.id===id) || null : null;
  return {date,entries:entries.slice(0,100),total:entries.length,me};
}
export function createHandler(store,{now=()=>new Date(),local=false}={}) {
  return async (request,{remoteIP='local'}={}) => {
    try {
      const url=new URL(request.url),time=now(),date=daily.dayKey(time);
      const origin=request.headers.get('origin');
      if(origin && origin!==url.origin) fail(403,'Požadavek musí přijít z této hry.');
      if (!['GET','POST'].includes(request.method)) return response({error:'Nepodporovaná operace.'},405);
      let account=await session(store,request,time),setCookie;
      if(request.method==='POST') {
        if(!request.headers.get('content-type')?.startsWith('application/json')) fail(415,'Očekává se JSON.');
        if(Number(request.headers.get('content-length'))>8192) fail(413,'Požadavek je příliš dlouhý.');
        const raw=await request.text();
        if(Buffer.byteLength(raw)>8192) fail(413,'Požadavek je příliš dlouhý.');
        let body;try{body=JSON.parse(raw);}catch{fail(400,'Neplatný požadavek.');}
        if(!body || typeof body !== 'object') fail(400,'Neplatný požadavek.');
        if(['register','login'].includes(body.action)) {
          const auth=await authenticate(store,request,body,time,remoteIP);account=auth.account;setCookie=auth.cookie;
        } else if(body.action==='logout') {
          const token=sessionToken(request);if(token)await store.delete('sessions/'+digest(token));
          account=null;setCookie=cookie(request,'',0);
        } else if(body.action==='update-email') {
          account=await updateEmail(store,account,body,time);
        } else if(body.action==='sync') {
          if(!account)fail(401,'Pro zapsání bodů se přihlas.');
          const key=`records/${date}/${account.id}`;
          const {blobs}=await store.list({prefix:'records/'});
          const known=new Set();let earlierPoints=0;
          for(const item of blobs)if(item.key.endsWith('/'+account.id) && item.key<key) {
            const record=await store.get(item.key,{type:'json'});
            if(record)earlierPoints+=publicEntry(record).points;
            for(const round of record?.rounds||[])known.add(round.id);
          }
          let saved=false;
          for(let retry=0;retry<6;retry++) {
            const existing=await store.getWithMetadata(key,{type:'json'}),previous=existing?.data;
            const incoming=candidate(body,date,account,previous,known);
            const record={id:account.id,name:account.name,date,rounds:merge(previous,incoming)};
            const newSkip=record.rounds.some((r,i)=>r.paidSkip && !['won','revealed'].includes(previous?.rounds?.[i]?.status));
            if(newSkip && 100+earlierPoints+publicEntry(record).points<0)fail(409,'Na přeskočení potřebuješ alespoň 200 bodů.');
            if(previous && JSON.stringify(record)===JSON.stringify(previous)){saved=true;break;}
            const result=await store.setJSON(key,record,existing?{onlyIfMatch:existing.etag}:{onlyIfNew:true});
            if(result.modified){saved=true;break;}
          }
          if(!saved) fail(409,'Skóre se právě mění v jiném okně. Obnov pořadí a zkus to znovu.');
        } else fail(400,'Neznámá operace.');
      }
      return response({...await board(store,date,account?.id),account,local},200,setCookie?{'Set-Cookie':setCookie}:{});
    } catch(error) {
      // No passwords, submitted answers, session tokens or internal errors in responses/logs.
      return response({error:error.status ? error.message : 'Žebříček se teď nepodařilo načíst. Zkus to za chvíli.'},error.status || 503);
    }
  };
}
