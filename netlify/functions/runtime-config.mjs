import {publicConfiguration} from '../../backend/config.mjs';
import {json} from '../../backend/http.mjs';
export default async request => request.method==='GET' ? json(publicConfiguration()) : json({error:'Nepodporovaná metoda.'},405,{Allow:'GET'});
