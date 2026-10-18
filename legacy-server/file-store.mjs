import {mkdir,readFile,writeFile,rename,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export function fileStore(directory) {
  let pending=Promise.resolve();
  const filename=key=>path.join(directory,Buffer.from(key).toString('hex')+'.json');
  const getRecord=async key=>{try{return JSON.parse(await readFile(filename(key),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
  return {
    async get(key){return (await getRecord(key))?.data ?? null;},
    async getWithMetadata(key){const r=await getRecord(key);return r?{data:r.data,etag:r.etag}:null;},
    setJSON(key,data,options={}) {
      const task=pending.then(async()=>{
        await mkdir(directory,{recursive:true});const old=await getRecord(key);
        if(options.onlyIfNew && old || options.onlyIfMatch && old?.etag!==options.onlyIfMatch)return {modified:false};
        const etag=createHash('sha256').update(JSON.stringify(data)).digest('hex');
        const file=filename(key);await writeFile(file+'.tmp',JSON.stringify({key,data,etag}));await rename(file+'.tmp',file);return {modified:true,etag};
      });pending=task.catch(()=>{});return task;
    },
    async delete(key){try{await unlink(filename(key));}catch(e){if(e.code!=='ENOENT')throw e;}},
    async list({prefix=''}) {
      await mkdir(directory,{recursive:true});const files=(await readdir(directory)).filter(n=>n.endsWith('.json'));
      const records=await Promise.all(files.map(n=>readFile(path.join(directory,n),'utf8').then(JSON.parse)));
      return {blobs:records.filter(r=>r.key.startsWith(prefix)).map(r=>({key:r.key,etag:r.etag}))};
    }
  };
}
