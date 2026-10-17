import {getStore} from '@netlify/blobs';
import {createHandler} from '../../legacy-server/service.mjs';
export default async (request,context) => {
  try {
    const store=getStore({name:process.env.SEPTANDA_STORE || 'septanda-players-v1',consistency:'strong',region:'eu-central-1'});
    return await createHandler(store)(request,{remoteIP:context.ip || 'unknown'});
  } catch {
    return Response.json({error:'Žebříček je teď nedostupný. Hra může pokračovat.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
};
