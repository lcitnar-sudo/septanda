/* Real Supabase SDK, synthetic auth transport: no external accounts or e-mails. */
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const user = {id:'12345678-1234-1234-1234-123456789abc',aud:'authenticated',role:'authenticated',email:'player@example.test',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
const memory = new Map(), clients = [];
const storage = {getItem:key=>memory.get(key) ?? null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
let refreshes = 0;
function token(exp) { return [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp,role:'authenticated'})).toString('base64url'),'synthetic-signature'].join('.'); }
function authSession() { return {access_token:token(Math.floor(Date.now()/1000)+3600),refresh_token:'synthetic-refresh-'+refreshes,expires_in:3600,token_type:'bearer',user}; }
const transport = async (url,options) => {
  if (String(url).includes('grant_type=refresh_token')) { assert.match(String(options.body),/synthetic-refresh/); refreshes++; }
  else assert.ok(String(url).includes('grant_type=password'),'only synthetic sign-in and refresh requests');
  return Response.json(authSession());
};
function browserVisit() { const client=createClient('https://synthetic.supabase.co','synthetic-public-key',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage,storageKey:'septanda-session-test'},global:{fetch:transport}}); clients.push(client);return client; }
try {
  const first=browserVisit(); const login=await first.auth.signInWithPassword({email:user.email,password:'synthetic test only'}); assert.ifError(login.error);
  assert.ok(memory.has('septanda-session-test'),'login writes a persistent browser session'); first.auth.stopAutoRefresh();
  const nextVisit=browserVisit();const restored=await nextVisit.auth.getSession();assert.ifError(restored.error);assert.equal(restored.data.session.user.id,user.id,'new SDK instance restores the same account without a password');assert.equal(refreshes,0);nextVisit.auth.stopAutoRefresh();
  const expired=JSON.parse(memory.get('septanda-session-test'));expired.expires_at=Math.floor(Date.now()/1000)-60;expired.access_token=token(expired.expires_at);memory.set('septanda-session-test',JSON.stringify(expired));
  const laterVisit=browserVisit();const refreshed=await laterVisit.auth.getSession();assert.ifError(refreshed.error);assert.equal(refreshed.data.session.user.id,user.id);assert.equal(refreshes,1,'expired access token refreshes automatically on a later visit');assert.ok(JSON.parse(memory.get('septanda-session-test')).expires_at>Date.now()/1000,'fresh token persists for the next visit');
  console.log('PASS real Supabase SDK: persistent login across new visits and automatic expired-token refresh (synthetic transport).');
} finally { for (const client of clients) client.auth.stopAutoRefresh(); }
