import {getStore} from '@netlify/blobs';
import * as game from '../../emoji-game.mjs';
import {createEmojiAPI} from '../../backend/emoji-api.mjs';
import {safeError} from '../../backend/http.mjs';
export default async request=>{try{
  const name=process.env.SEPTANDA_STORE?process.env.SEPTANDA_STORE+'-emoji':'septanda-emoji-v1';
  return await createEmojiAPI({game,store:getStore({name,consistency:'strong',region:'eu-central-1'})})(request);
}catch(error){return safeError(error);}};
