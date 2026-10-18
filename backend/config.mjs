export const CONSENT = Object.freeze({
  version: '2026-10-16-v1',
  text: 'Chci e-mailem dostávat novinky o Šeptandě, nových hrách a tematických vydáních. Souhlas mohu kdykoli odvolat v nastavení účtu.'
});

function publicKey(value) {
  if (typeof value!=='string' || value.startsWith('sb_secret_')) return false;
  if (value.startsWith('sb_publishable_')) return true;
  try { const parts=value.split('.');return parts.length===3 && JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')).role==='anon'; } catch { return false; }
}

export function configuration(env = process.env) {
  const url = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  let validURL = false;
  try { const parsed = new URL(url); validURL = !parsed.username && !parsed.password && !parsed.search && !parsed.hash && (parsed.protocol === 'https:' || (env.SEPTANDA_ALLOW_LOCAL_SUPABASE === 'true' && ['localhost', '127.0.0.1'].includes(parsed.hostname))); } catch {}
  const configured = validURL && publicKey(publishableKey) && Boolean(serviceKey);
  return {url, publishableKey, serviceKey, configured};
}

export function publicConfiguration(env = process.env) {
  const config = configuration(env);
  return {provider: config.configured ? 'supabase' : 'legacy', configured: config.configured,
    supabase: config.configured ? {url: config.url, publishableKey: config.publishableKey} : null,
    consent: CONSENT, cloudAvailable: config.configured};
}
