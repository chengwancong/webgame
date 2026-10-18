import {readFile,access} from 'node:fs/promises';
import {join,resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
export const starseaRoot=resolve(import.meta.dirname,'..');
export const starseaGroups=['npc','monsters','bosses','vfx','scenes','props'];
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function validateStarsea({allowMissing=false}={}){
 const requirement=JSON.parse(await readFile(join(starseaRoot,'docs/starsea/requirements.json'),'utf8'));
 const wanted={npc:requirement.npcs,monsters:requirement.monsters,bosses:requirement.bosses,vfx:requirement.vfx,scenes:[...requirement.maps,...requirement.sceneAssets],props:requirement.props};
 const groups=[],errors=[],missingGroups=[],seen=new Set(),hashes=new Map(),urls=new Set();
 const scan=value=>{if(typeof value==='string'&&value.startsWith('/art/'))urls.add(value);else if(Array.isArray(value))value.forEach(scan);else if(value&&typeof value==='object')Object.values(value).forEach(scan);};
 async function file(record){
  if(!record?.path||!record.sha256)return errors.push('File missing path/hash: '+JSON.stringify(record));
  const path=isAbsolute(record.path)?record.path:join(starseaRoot,record.path);let bytes;
  try{if(hashes.has(path)){if(hashes.get(path)!==record.sha256)errors.push('Inconsistent hash declaration '+record.path);return;}
   bytes=await readFile(path);const actual=sha(bytes);hashes.set(path,actual);if(actual!==record.sha256)errors.push('File hash mismatch: '+record.path);
   if(record.bytes!==undefined&&record.bytes!==bytes.length)errors.push('File size mismatch '+record.path);
   if(record.width!==undefined||record.height!==undefined){const meta=await sharp(bytes).metadata();if(meta.width!==record.width||meta.height!==record.height)errors.push('Image dimension mismatch '+record.path);if(record.alpha===true&&!meta.hasAlpha&&!path.endsWith('.svg'))errors.push('Image has no alpha '+record.path);}
  }catch(e){errors.push('Unreadable file '+record.path+': '+e.message);}
 }
 for(const group of starseaGroups){
  let manifest,bytes;try{bytes=await readFile(join(starseaRoot,'assets/starsea',group,'manifest.json'));manifest=JSON.parse(bytes);}catch(e){missingGroups.push(group);if(!allowMissing)errors.push('Missing group '+group+': '+e.message);continue;}
  if(manifest.schemaVersion!==1||manifest.group!==group||!Array.isArray(manifest.assets))errors.push('Invalid manifest '+group);
  const ids=new Set(manifest.assets.map(a=>a.id));for(const required of wanted[group])if(!ids.has(required.id))errors.push('Missing requirement '+required.id);
  for(const asset of manifest.assets){
   if(seen.has(asset.id))errors.push('Duplicate asset '+asset.id);seen.add(asset.id);
   if(!wanted[group].some(a=>a.id===asset.id))errors.push('Unexpected asset '+asset.id);
   for(const key of ['name','type','source','files','runtime','actions','states','dependencies','status'])if(asset[key]===undefined)errors.push(asset.id+' missing '+key);
   if(!Array.isArray(asset.chapters))errors.push(asset.id+' missing chapters');
   if(!asset.source?.path||!asset.source?.sha256)errors.push(asset.id+' missing source trace');
   if(!asset.files?.length)errors.push(asset.id+' no registered files');else for(const f of asset.files)await file(f);
   if(asset.source?.path&&asset.source?.sha256&&!Array.isArray(asset.source.path)){
    const p=isAbsolute(asset.source.path)?asset.source.path:join(starseaRoot,asset.source.path);
    try{await access(p);if(/\.[\w]+$/.test(p))await file({path:asset.source.path,sha256:asset.source.sha256});}catch(e){errors.push(asset.id+' missing original source '+p);}
   }
   scan(asset.runtime);scan(asset.actions);scan(asset.states);
   if(group==='props'){const required=wanted.props.find(a=>a.id===asset.id);for(const state of required.states)if(!asset.runtime.states?.[state]?.file)errors.push(asset.id+' missing prop state '+state);}
   if(group==='monsters')for(const action of ['idle','move','attack','hurt','death','skill']){const a=asset.runtime.actions?.[action];if(!a?.frames?.length||a.fallback)errors.push(asset.id+' invalid full action '+action);}
   if(group==='bosses'&&asset.runtime.actionSelection?.priority?.[0]!=='death')errors.push(asset.id+' death priority missing');
  }
  for(const key of ['nativeSourceFiles','sharedFiles','productionFiles'])for(const f of manifest[key]??[])await file(f);
  groups.push({group,manifest,sha256:sha(bytes),path:'assets/starsea/'+group+'/manifest.json'});
 }
 for(const url of urls){try{await access(join(starseaRoot,'apps/web/public',decodeURI(url).split('?')[0]));}catch{errors.push('Unpublished runtime URL '+url);}}
 const summary={ok:errors.length===0&&missingGroups.length===0,designVersion:requirement.version,required:129,registered:seen.size,groups:Object.fromEntries(groups.map(g=>[g.group,g.manifest.assets.length])),sourceAndPackageFiles:hashes.size,runtimeURLs:urls.size,missingGroups,errors};
 return {summary,groups,requirement};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){const result=await validateStarsea({allowMissing:process.argv.includes('--allow-missing')});console.log(JSON.stringify(result.summary,null,2));if(!result.summary.ok&&!process.argv.includes('--allow-missing'))process.exitCode=1;}
