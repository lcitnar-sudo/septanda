import {createHash} from 'node:crypto';
import {createSupabase} from './supabase.mjs';
import {fail,json,safeError,readJSON,checkOrigin} from './http.mjs';

// Private literary records never enter the original game's progress or scores.
export function createLiteratureAPI({game,store,db=createSupabase(),clock=()=>new Date()}={}) {
  const E=game.engine,D=game.data;
  const find=id=>D.samples.find(s=>s.id===id);
  function importGuest(state,raw) {
    let guest;try{guest=E.parse(JSON.stringify(raw));}catch{fail(400,'Místní deník nemá platný formát.');}
    if(Object.keys(guest.rounds).length>500)fail(413,'Deník je příliš velký.');
    for(const [id,r] of Object.entries(guest.rounds)) {
      const item=find(id);if(!item)continue;
      if(r.attempts.length>1000 || r.draft.length>100)fail(400,'Neplatná historie úryvku.');
      const old=state.rounds[id];if(old && old.status!=='playing')continue;
      const rebuilt=E.fresh('import');const next=E.open(rebuilt,id,E.day(clock()));next.hints=Math.max(old?.hints||0,r.hints);
      for(const attempt of [...(old?.attempts||[]),...r.attempts]) E.submit(rebuilt,item,String(attempt.text).slice(0,100),D.authors,E.day(clock()));
      if(r.status==='revealed' && next.status==='playing')E.reveal(rebuilt,id,E.day(clock()));
      // A claimed win is accepted only if an actual correct answer can be replayed.
      next.draft=r.draft;state.rounds[id]=next;
    }
    state.saved=[...new Set([...state.saved,...guest.saved.filter(id=>find(id) && state.rounds[id]?.status!=='playing')])];
  }
  return async request=>{
    try{
      if(!['GET','POST'].includes(request.method))return json({error:'Nepodporovaná metoda.'},405,{Allow:'GET, POST'});
      const user=await db.verifiedUser(request);
      if(!user.email_confirmed_at)fail(403,'Nejdřív potvrď svůj e-mail.');
      let body={action:'daily'};
      if(request.method==='POST'){checkOrigin(request);body=await readJSON(request,256*1024);}
      if(!['daily','open','answer','hint','reveal','save','draft','import'].includes(body.action))fail(400,'Neznámá akce.');
      const item=find(body.id);
      if(!['daily','import'].includes(body.action) && !item)fail(400,'Tento úryvek není v testu.');
      const {data:profiles}=await db.read('septanda_profiles',`user_id=eq.${user.id}&select=display_name&limit=1`,{user});
      const account={id:user.id,name:profiles?.[0]?.display_name||user.user_metadata?.display_name||'Hráčský účet',email:user.email};
      const date=E.day(clock()),key='players/'+user.id;
      for(let retry=0;retry<10;retry++){
        const record=await store.getWithMetadata(key,{type:'json'});
        const state=record?E.parse(JSON.stringify(record.data.state)):E.fresh(createHash('sha256').update('septanda-literature-v1:'+user.id).digest('hex'));
        const before=JSON.stringify(state);let result=null;
        E.assign(state,date,D.samples);
        if(body.action==='daily')result=state.days[date]||null;
        else if(body.action==='import')importGuest(state,body.state);
        else {
          const r=E.open(state,item.id,date);
          if(body.action==='answer'){
            if(typeof body.text!=='string'||body.text.length>100)fail(400,'Napiš jméno do 100 znaků.');
            if(r.attempts.length>=1000)fail(429,'U této ukázky už je mnoho tipů. Využij stopy.');
            result=E.submit(state,item,body.text,D.authors,date);
          }
          if(body.action==='hint'){
            if(!Number.isInteger(body.level)||body.level<1||body.level>3)fail(400,'Neplatná stopa.');
            if(body.level>r.hints+1)fail(409,'Stopy se otevírají postupně.');
            if(body.level>r.hints)E.hint(state,item.id,date);
          }
          if(body.action==='reveal')E.reveal(state,item.id,date);
          if(body.action==='draft'){
            if(typeof body.text!=='string'||body.text.length>100)fail(400,'Neplatná rozepsaná odpověď.');
            if(r.status==='playing')r.draft=body.text;
          }
          if(body.action==='save'){
            if(typeof body.saved!=='boolean'||r.status==='playing')fail(400,'Nejdřív odhal autora.');
            state.saved=state.saved.filter(id=>id!==item.id);if(body.saved)state.saved.push(item.id);
          }
        }
        const changed=JSON.stringify(state)!==before,revision=(record?.data.revision||0)+(changed||!record?1:0);
        if(changed||!record){const saved=await store.setJSON(key,{state,revision},record?{onlyIfMatch:record.etag}:{onlyIfNew:true});if(!saved.modified)continue;}
        return json({account,state,revision,result,date});
      }
      fail(409,'Postup se právě ukládá na jiném zařízení. Zkus to znovu.');
    }catch(error){return safeError(error);}
  };
}
