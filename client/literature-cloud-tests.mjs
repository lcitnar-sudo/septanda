import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import * as game from '../literature-game.mjs';
const code=await readFile(new URL('./literature-cloud.js',import.meta.url),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
const user={id:'12345678-1234-1234-1234-123456789abc'},signed={user,access_token:'synthetic-token'};
const elements=new Map(),listeners=new Map(),calls=[],identities=[],pauses=[];let session=signed,authError=null,gate,failProfile=false,callback,options;
function el(id){if(!elements.has(id))elements.set(id,{id,hidden:false,value:'',checked:false,open:false,disabled:false,textContent:'',listeners:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},showModal(){this.open=true;},close(){this.open=false;this.listeners.close?.();},focus(){},querySelectorAll(){return [el('tab-login'),el('tab-register')];}});return elements.get(id);}
el('tab-login').dataset={auth:'login'};el('tab-register').dataset={auth:'register'};el('lit-auth').open=true;
const document={getElementById:el,querySelector:()=>[...elements.values()].find(e=>e.open),addEventListener(k,fn){listeners.set(k,fn);},hidden:false};
const state=game.engine.fresh('account');game.engine.assign(state,'2026-10-24',game.data.samples);
const config={configured:true,supabase:{url:'https://synthetic.supabase.co',publishableKey:'synthetic-public'},consent:{text:'Dobrovolné novinky',version:'v1'}};
let release;gate=new Promise(r=>release=r);
const context=vm.createContext({document,console,URL,AbortSignal,crypto:globalThis.crypto,location:{origin:'https://example.test'},setTimeout,clearTimeout,addEventListener(){},
  SeptandaLiteraryGame:{guestState:()=>null,async setIdentity(id,s){identities.push({id,state:clone(s||{})});},async apply(){},async flushDrafts(){},pause:b=>pauses.push(b),focus(){}},
  SeptandaSupabase:{createClient(url,key,o){assert.equal(url,config.supabase.url);options=o;return {auth:{onAuthStateChange(fn){callback=fn;},async getSession(){return {data:{session}};},async signInWithPassword(){if(authError)return {error:Error(authError)};session=signed;return {data:{session}};},async signUp(body){calls.push({signup:body});return {data:{session:null}};},async resetPasswordForEmail(){return {};},async signOut(){session=null;return {};}}};}},
  async fetch(url,opts={}){if(url.endsWith('runtime-config'))return {ok:true,json:async()=>config};assert.equal(url,'/.netlify/functions/literature-player');assert.equal(opts.headers.Authorization,'Bearer synthetic-token');calls.push(JSON.parse(opts.body));if(gate)await gate;if(failProfile)throw Error('Network unavailable');return {ok:true,json:async()=>({state:clone(state),account:{id:user.id,name:'Čtenář',email:'private@example.test'},result:state.days['2026-10-24']})};}
});
const settle=async()=>{await new Promise(r=>setTimeout(r,2));for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
const click=async action=>{await listeners.get('click')({target:{closest:()=>({dataset:{auth:action},disabled:false})}});};
vm.runInContext(code,context);await settle();
assert.equal(el('lit-auth').open,false,'restored/sign-in session closes login before profile request finishes');assert.equal(el('lit-password').value,'');assert.equal(identities.length,0,'no account data before verified backend response');
assert(options.auth.persistSession&&options.auth.autoRefreshToken);release();gate=null;await settle();assert.equal(identities.at(-1).id,user.id);assert.equal(el('lit-profile').textContent,'Čtenář');assert.equal(el('lit-login').hidden,true);
await click('logout');assert.equal(identities.at(-1).id,null);assert.equal(el('lit-login').hidden,false);
await click('login');authError='Invalid login credentials';el('lit-email').value='synthetic@example.test';el('lit-password').value='synthetic-only';await el('lit-auth-form').listeners.submit({preventDefault(){}});assert.equal(el('lit-auth').open,true);assert.match(el('lit-auth-message').textContent,/nesouhlasí/);
authError=null;failProfile=true;await el('lit-auth-form').listeners.submit({preventDefault(){}});assert.equal(el('lit-auth').open,false,'profile failure never leaves login open');assert.equal(el('lit-password').value,'');assert.match(el('lit-sync-status').textContent,/přihlášený/);
await assert.rejects(context.SeptandaLiteratureCloud.command('daily'),/načtení/);failProfile=false;await click('reconnect');assert.equal(identities.at(-1).id,user.id);
await click('logout');await click('register');assert.equal(el('lit-consent').checked,false);assert.equal(el('lit-password').autocomplete,'new-password');await el('lit-auth-form').listeners.submit({preventDefault(){}});assert.equal(calls.at(-1).signup.options.data.marketing_opt_in,false);assert.equal(el('lit-confirmation').hidden,false);assert.equal(el('lit-auth-form').hidden,true);
// A repeated same-account SIGNED_IN closes a manually stale login without reloading progress.
await click('login');session=signed;await el('lit-auth-form').listeners.submit({preventDefault(){}});await click('login');const n=identities.length;callback('SIGNED_IN',signed);await settle();assert.equal(el('lit-auth').open,false);assert.equal(identities.length,n);
// A different account must cover the old view before its response, also on failure.
const previousCount=identities.length;let releaseSwitch;gate=new Promise(r=>releaseSwitch=r);
const second={...signed,user:{id:'87654321-4321-4321-4321-cba987654321'}};
callback('SIGNED_IN',second);await settle();assert.equal(pauses.at(-1),true,'account is covered before fetching another account');assert.equal(identities.length,previousCount,'unverified new account data never applied');
failProfile=true;releaseSwitch();gate=null;await settle();assert.equal(pauses.at(-1),true,'previous account remains covered after failed fetch');assert.equal(identities.length,previousCount);assert.equal(el('reading-reconnect').hidden,false);
failProfile=false;callback('SIGNED_IN',signed);await settle();assert.equal(pauses.at(-1),false);
console.log('Literary cloud client: persistent shared auth, immediate dialog closure, invalid credentials, backend failure/reconnect, logout isolation, confirmation instructions and unchecked consent passed (synthetic transport).');
