import {readFile,writeFile,mkdir,cp,copyFile,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../..');
const backup=join(root,'assets/equipment-remake-20261003/previous-live-20261004');
assert(backup.startsWith(root+'\\'));
try{await access(backup);throw Error('Live backup already exists; preserve it and inspect before reuse');}catch(error){if(error.code!=='ENOENT')throw error;}
const paths=['assets/ui-source/v2/ui-source.json','packages/asset-manifest/ui.v2.json','packages/content/equipment-catalog.json','packages/contracts/index.ts'];
const prior=JSON.parse(await readFile(join(root,'assets/ui-source/v2/equipment-handdrawn/catalog.json'),'utf8'));
assert.equal(prior.items.length,324);
await mkdir(backup,{recursive:true});
await cp(join(root,'assets/ui-source/v2/equipment-handdrawn'),join(backup,'equipment-handdrawn'),{recursive:true,errorOnExist:true,force:false});
const metadata=[];
for(const path of paths){
 const bytes=await readFile(join(root,path)),name=path.replaceAll('/','__');
 await copyFile(join(root,path),join(backup,name));
 metadata.push({path,backup:name,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(join(backup,'backup.json'),JSON.stringify({createdAt:new Date().toISOString(),root,icons:324,sets:54,originalHighResolutionFolderRetained:'assets/ui-source/v2/equipment-handdrawn-originals',metadata},null,2)+'\n');
console.log(JSON.stringify({backup,icons:324,sets:54}));
