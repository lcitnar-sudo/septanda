import * as game from '../../game.mjs';
import {createCloudAPI} from '../../backend/api.mjs';
const handle=createCloudAPI({game});
export default request => handle(request,'player');
