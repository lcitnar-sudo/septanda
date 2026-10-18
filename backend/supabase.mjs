import {configuration} from './config.mjs';
import {fail} from './http.mjs';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const isUUID = value => typeof value === 'string' && UUID.test(value);
export function createSupabase({env = process.env, fetcher = fetch} = {}) {
  const config = configuration(env);
  const ready = () => { if (!config.configured) fail(503,'Supabase zatím není připojená.'); };
  async function request(path, {method='GET', body, token, service=false, prefer, count=false}={}) {
    ready();
    const key = service ? config.serviceKey : config.publishableKey;
    const headers = {apikey:key, Accept:'application/json'};
    if (token) headers.Authorization = 'Bearer ' + token;
    else if (service && key.split('.').length === 3) headers.Authorization = 'Bearer ' + key;
    if (body !== undefined) headers['Content-Type']='application/json';
    if (prefer || count) headers.Prefer = [prefer, count ? 'count=exact' : null].filter(Boolean).join(',');
    let result;
    try { result = await fetcher(config.url + path, {method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)}); }
    catch { fail(503,'Databáze je dočasně nedostupná.'); }
    let data;
    try { data = await result.json(); } catch { data = null; }
    if (!result.ok) {
      if (path === '/auth/v1/user') fail(401,'Přihlas se prosím znovu.','invalid_session');
      if (result.status === 409) fail(409,'Změna se potkala s jiným uložením. Zkus to znovu.','conflict');
      fail(503,'Databáze je dočasně nedostupná.');
    }
    return {data,total:count ? Number((result.headers.get('content-range') || '').split('/')[1]) || 0 : undefined};
  }
  async function verifiedUser(requestObject, optional=false) {
    const authorization = requestObject.headers.get('authorization') || '';
    const match = /^Bearer ([^\s]{20,8192})$/i.exec(authorization);
    if (!match) { if (optional && !authorization) return null; fail(401,'Pro uložení postupu se přihlas.','sign_in_required'); }
    // Ask Auth for the current user; never authorize by decoding an unverified JWT.
    const {data:user} = await request('/auth/v1/user',{token:match[1]});
    if (!isUUID(user?.id) || user.is_anonymous === true || !user.email) fail(401,'Přihlas se prosím e-mailem.','invalid_session');
    return {...user, accessToken:match[1]};
  }
  const read = async (table,query,{user,count=false}={}) => request(`/rest/v1/${table}?${query}`,{token:user?.accessToken,service:!user,count});
  const rpc = async (name,body) => (await request(`/rest/v1/rpc/${name}`,{method:'POST',body,service:true})).data;
  return {ready,verifiedUser,read,rpc,
    async updateProfile(user,name) { await request(`/rest/v1/septanda_profiles?user_id=eq.${user.id}`,{method:'PATCH',body:{display_name:name},service:true}); },
    async isAdmin(user) { const {data} = await read('septanda_admins',`user_id=eq.${user.id}&select=user_id&limit=1`,{user}); return Boolean(data?.length); }
  };
}
