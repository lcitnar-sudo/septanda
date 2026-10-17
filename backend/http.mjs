export const fail = (status, message, code) => { throw Object.assign(new Error(message), {status, code}); };
export const json = (body, status = 200, extra = {}) => Response.json(body, {status,
  headers: {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin', ...extra}});
export function safeError(error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 503;
  return json({error: status >= 500 ? 'Ukládání do účtu je teď nedostupné. Místní hra může pokračovat.' : error.message,
    ...(error?.code && status < 500 ? {code:error.code} : {})}, status);
}
export async function readJSON(request, maximum = 2 * 1024 * 1024) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) fail(415,'Požadavek musí obsahovat JSON.');
  if (Number(request.headers.get('content-length')) > maximum) fail(413,'Historie je příliš velká pro jedno uložení.');
  const reader = request.body?.getReader();
  let size = 0; const chunks=[];
  if (!reader) fail(400,'Prázdný požadavek.');
  while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength;
    if (size > maximum) { await reader.cancel(); fail(413,'Historie je příliš velká pro jedno uložení.'); } chunks.push(value); }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400,'Neplatný JSON.'); }
  if (!value || Array.isArray(value) || typeof value !== 'object') fail(400,'Neplatný požadavek.');
  return value;
}
export function nickname(value) {
  if (typeof value !== 'string') fail(400,'Vyplň přezdívku.');
  const name = value.normalize('NFC').trim().replace(/ +/g,' ');
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,23}$/u.test(name)) fail(400,'Přezdívka musí mít 2 až 24 znaků: písmena, čísla, mezery, tečku, pomlčku nebo podtržítko.');
  return name;
}
export function checkOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) fail(403,'Požadavek musí přijít ze stejného webu.');
}
