import {publicConfiguration,CONSENT} from './config.mjs';
import {createSupabase,isUUID} from './supabase.mjs';
import {createProgressTools} from './progress.mjs';
import {fail,json,safeError,readJSON,nickname,checkOrigin} from './http.mjs';

const INITIAL_STATS = Object.freeze({solved:0,spent:0,attempts:0,revealed:0,points:100});
function consent(record,confirmed) {
  return {granted:Boolean(record?.granted),active:Boolean(record?.granted && confirmed),version:record?.version || CONSENT.version,
    text:record?.text || CONSENT.text,grantedAt:record?.granted_at || null,withdrawnAt:record?.withdrawn_at || null,updatedAt:record?.updated_at || null};
}
function account(user,profile) { return {id:user.id,name:profile.display_name,email:user.email,emailConfirmed:Boolean(user.email_confirmed_at)}; }
function adminUser(row) {
  return {id:row.id || row.user_id,name:row.name || row.display_name,email:row.email,emailConfirmed:Boolean(row.email_confirmed_at),
    createdAt:row.created_at,stats:row.stats || INITIAL_STATS,consent:consent(row,Boolean(row.email_confirmed_at))};
}
export function createCloudAPI({game,env=process.env,fetcher=fetch,db=createSupabase({env,fetcher}),clock=()=>new Date()}={}) {
  const tools=createProgressTools(game);
  async function readPlayer(user) {
    const id=`user_id=eq.${user.id}`;
    const [profileResult,progressResult,consentResult,admin] = await Promise.all([
      db.read('septanda_profiles',`${id}&select=display_name,email,email_confirmed_at&limit=1`,{user}),
      db.read('septanda_progress',`${id}&select=state,revision,stats&limit=1`,{user}),
      db.read('septanda_marketing_consents',`${id}&select=granted,version,text,granted_at,withdrawn_at,updated_at&limit=1`,{user}),db.isAdmin(user)
    ]);
    const profile=profileResult.data?.[0],progress=progressResult.data?.[0],choice=consentResult.data?.[0];
    if (!profile || !progress || !choice) fail(503,'Nejprve dokonči nastavení databáze Supabase.');
    return {account:account(user,profile),state:progress.state,revision:Number(progress.revision),stats:progress.stats || INITIAL_STATS,
      consent:consent(choice,Boolean(user.email_confirmed_at)),admin};
  }
  async function player(request) {
    if (!['GET','POST'].includes(request.method)) return json({error:'Nepodporovaná metoda.'},405,{Allow:'GET, POST'});
    const user=await db.verifiedUser(request);
    if (request.method==='GET') return json(await readPlayer(user));
    checkOrigin(request);
    const body=await readJSON(request);
    if (body.action==='profile') { await db.updateProfile(user,nickname(body.name));return json(await readPlayer(user)); }
    if (body.action==='consent') {
      if (typeof body.granted!=='boolean') fail(400,'Zvol platný stav souhlasu.');
      await db.rpc('septanda_set_consent',{p_user:user.id,p_granted:body.granted});
      return json(await readPlayer(user));
    }
    if (body.action!=='sync') fail(400,'Neznámá akce.');
    for (let retry=0;retry<8;retry++) {
      const {data}=await db.read('septanda_progress',`user_id=eq.${user.id}&select=state,revision&limit=1`,{user});
      const old=data?.[0];if (!old) fail(503,'Nejprve dokonči nastavení databáze Supabase.');
      const merged=tools.merge(old.state,body.state,{now:clock(),importLegacy:body.importLegacy===true});
      const result=await db.rpc('septanda_commit_progress',{p_user:user.id,p_expected_revision:Number(old.revision),p_state:merged.state,p_stats:merged.stats,p_scores:merged.scores});
      if (result?.saved===true) return json(await readPlayer(user));
    }
    fail(409,'Postup se právě ukládá na jiném zařízení. Zkus uložení za chvíli znovu.','conflict');
  }
  async function leaderboard(request) {
    if (request.method!=='GET') return json({error:'Nepodporovaná metoda.'},405,{Allow:'GET'});
    const date=new URL(request.url).searchParams.get('date') || game.daily.dayKey(clock());
    if (!game.daily.validDay(date) || date>game.daily.dayKey(clock())) fail(400,'Neplatné datum žebříčku.');
    const user=await db.verifiedUser(request,true);
    const rows=await db.rpc('septanda_public_leaderboard',{p_date:date,p_me:user?.id || null});
    return json({date,entries:rows?.entries || [],me:rows?.me || null,total:Number(rows?.total)||0});
  }
  async function adminUsers(request) {
    if (request.method!=='GET') return json({error:'Nepodporovaná metoda.'},405,{Allow:'GET'});
    const user=await db.verifiedUser(request);
    // A protected database membership is authoritative; metadata supplied at signup never grants administration.
    if (!await db.isAdmin(user)) fail(403,'Tento přehled je dostupný pouze správci.','admin_required');
    const search=new URL(request.url).searchParams,target=search.get('user');
    if (target) {
      if (!isUUID(target)) fail(400,'Neplatné označení hráče.');
      const [{data:profiles},{data:stats},{data:consents},{data:events}]=await Promise.all([
        db.read('septanda_profiles',`user_id=eq.${target}&select=user_id,display_name,email,email_confirmed_at,created_at&limit=1`),
        db.read('septanda_progress',`user_id=eq.${target}&select=stats&limit=1`),
        db.read('septanda_marketing_consents',`user_id=eq.${target}&select=granted,version,text,granted_at,withdrawn_at,updated_at&limit=1`),
        db.read('septanda_consent_events',`user_id=eq.${target}&select=id,granted,version,text,recorded_at,source&order=recorded_at.desc&limit=500`)
      ]);
      if (!profiles?.[0]) fail(404,'Hráč nebyl nalezen.');
      return json({user:adminUser({...profiles[0],...consents?.[0],stats:stats?.[0]?.stats}),consentEvents:(events||[]).map(row=>({id:row.id,granted:row.granted,version:row.version,text:row.text,recordedAt:row.recorded_at,source:row.source}))});
    }
    const filter=search.get('filter') || 'all';if (!['all','marketing'].includes(filter)) fail(400,'Neplatný filtr hráčů.');
    const integer=(value,fallback,minimum,maximum)=>value===null?fallback:/^\d+$/.test(value)?Math.min(maximum,Math.max(minimum,Number(value))):fail(400,'Neplatné stránkování.');
    const limit=integer(search.get('limit'),50,1,100),offset=integer(search.get('offset'),0,0,100000);
    const result=await db.rpc('septanda_admin_list',{p_marketing:filter==='marketing',p_limit:limit,p_offset:offset});
    return json({users:(result?.users || []).map(adminUser),total:Number(result?.total)||0,limit,offset});
  }
  return async function handle(request,endpoint) {
    try {
      if (endpoint==='runtime-config') return request.method==='GET' ? json(publicConfiguration(env)) : json({error:'Nepodporovaná metoda.'},405,{Allow:'GET'});
      db.ready();
      if (endpoint==='player') return await player(request);
      if (endpoint==='cloud-leaderboard') return await leaderboard(request);
      if (endpoint==='admin-users') return await adminUsers(request);
      return json({error:'Nenalezeno.'},404);
    } catch (error) { return safeError(error); }
  };
}
