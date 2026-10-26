import {createHash} from 'node:crypto';
import {createSupabase} from './supabase.mjs';
import {fail,json,safeError,readJSON,checkOrigin} from './http.mjs';

// Bonus history has its own store. It cannot change reading or original-game scores.
export function createEmojiAPI({game,store,db=createSupabase(),clock=()=>new Date()}={}){
  const E=game.engine,items=game.data.items,find=id=>items.find(p=>p.id===id);
  return async request=>{try{
    if(!['GET','POST'].includes(request.method))return json({error:'Nepodporovaná metoda.'},405,{Allow:'GET, POST'});
    checkOrigin(request);const user=await db.verifiedUser(request);if(!user.email_confirmed_at)fail(403,'Nejdřív potvrď svůj e-mail.');
    const body=request.method==='POST'?await readJSON(request,256*1024):{action:'daily'};
    if(!['daily','answer','hint','reveal','draft','import'].includes(body.action))fail(400,'Neznámá akce.');
    if(!['daily','import'].includes(body.action)&&!find(body.id))fail(400,'Tuto bonusovou hádanku neznáme.');
    if(['answer','draft'].includes(body.action)&&(typeof body.text!=='string'||body.text.length>150))fail(400,'Napiš název do 150 znaků.');
    if(body.action==='hint'&&(!Number.isInteger(body.level)||body.level<1||body.level>2))fail(400,'Neplatná stopa.');
    let guest;if(body.action==='import'){try{guest=E.parse(JSON.stringify(body.state));}catch{fail(400,'Místní bonusový deník nemá platný formát.');}if(Object.keys(guest.rounds).length>500)fail(413,'Deník je příliš velký.');}
    const date=E.day(clock()),key='players/'+user.id;
    for(let retry=0;retry<10;retry++){
      const record=await store.getWithMetadata(key,{type:'json'});
      const state=record?E.parse(JSON.stringify(record.data.state)):E.fresh(createHash('sha256').update('septanda-emoji-v1:'+user.id).digest('hex'));
      const before=JSON.stringify(state);let result=null;E.assign(state,date,items);
      if(body.action==='daily')result=state.days[date]||null;
      else if(body.action==='import'){
        for(const [id,r] of Object.entries(guest.rounds)){
          const item=find(id),old=state.rounds[id];if(!item||old?.status==='solved'||old?.status==='revealed')continue;
          const rebuilt=E.fresh('import'),next=E.open(rebuilt,id,date);next.hints=Math.max(old?.hints||0,r.hints);
          for(const a of [...(old?.attempts||[]),...r.attempts].slice(0,500))E.answer(rebuilt,item,a.text,items,date);
          if(r.status==='revealed'&&next.status==='playing')E.reveal(rebuilt,id,date);
          next.draft=r.draft;state.rounds[id]=next;
        }
      }else{
        if(!Object.hasOwn(state.rounds,body.id))fail(403,'Hraj svou přidělenou hádanku.');
        const r=state.rounds[body.id];
        if(body.action==='answer')result=E.answer(state,find(body.id),body.text,items,date);
        if(body.action==='hint'){if(body.level>r.hints+1)fail(409,'Stopy se otevírají postupně.');if(body.level>r.hints)E.hint(state,body.id,date);}
        if(body.action==='reveal')E.reveal(state,body.id,date);
        if(body.action==='draft'&&r.status==='playing')r.draft=body.text;
      }
      const changed=JSON.stringify(state)!==before,revision=(record?.data.revision||0)+(changed||!record?1:0);
      if(changed||!record){const saved=await store.setJSON(key,{state,revision},record?{onlyIfMatch:record.etag}:{onlyIfNew:true});if(!saved.modified)continue;}
      return json({state,date,revision,result});
    }fail(409,'Bonus se právě ukládá na jiném zařízení. Zkus to znovu.');
  }catch(error){return safeError(error);}};
}
