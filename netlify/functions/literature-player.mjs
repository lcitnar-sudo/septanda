import {getStore} from '@netlify/blobs';
import * as game from '../../literature-game.mjs';
import {createLiteratureAPI} from '../../backend/literature-api.mjs';
import {safeError} from '../../backend/http.mjs';
export default async request=>{
  try{
    const name=process.env.SEPTANDA_STORE?process.env.SEPTANDA_STORE+'-literature':'septanda-literature-v1';
    const store=getStore({name,consistency:'strong',region:'eu-central-1'});
    return await createLiteratureAPI({game,store})(request);
  }catch(error){return safeError(error);}
};
