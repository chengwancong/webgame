import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'../../..'),docs=join(root,'docs/starsea');
const req=JSON.parse(await readFile(join(docs,'requirements.json'),'utf8'));
const groups={npc:req.npcs,monsters:req.monsters,bosses:req.bosses,vfx:req.vfx,scenes:[...req.maps,...req.sceneAssets],props:req.props};
const phase=process.argv[2]??'current',report={date:'2026-10-04',designVersion:req.version,phase,groups:{},issues:[]};
const issue=(group,id,reason)=>report.issues.push({group,id,reason});
const asPath=p=>p.startsWith('/art/')?join(root,'apps/web/public',p):isAbsolute(p)?p:join(root,p);
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const [group,expected] of Object.entries(groups)){
 const path=join(root,'assets/starsea',group,'manifest.json');let manifest;
 try{manifest=JSON.parse(await readFile(path,'utf8'));}catch(error){report.groups[group]={exists:false,expected:expected.length,error:error.code??error.message};continue;}
 const assets=Array.isArray(manifest.assets)?manifest.assets:Object.values(manifest.assets??{});
 const ids=new Set(assets.map(a=>a.id));const missing=expected.filter(a=>!ids.has(a.id)).map(a=>a.id);
 const result={exists:true,version:manifest.version,expected:expected.length,delivered:assets.length,missing,filesChecked:0,nativeProfiles:0,atlases:0,imagePixels:0,checks:[]};report.groups[group]=result;
 for(const asset of assets){
  if(!expected.some(a=>a.id===asset.id))issue(group,asset.id,'ID outside frozen design');
  if(!asset.source)issue(group,asset.id,'Missing provenance');
  if(!asset.runtime)issue(group,asset.id,'Missing consumable runtime');
  const files=Array.isArray(asset.files)?asset.files:Object.values(asset.files??{});
  if(!files.length)issue(group,asset.id,'No declared files');
  for(const f of files){
   const spec=typeof f==='string'?{path:f}:f;const file=spec.path??spec.file;
   if(!file){issue(group,asset.id,'Unrecognized file record');continue;}
   let bytes;try{bytes=await readFile(asPath(file));}catch{issue(group,asset.id,'File missing: '+file);continue;}
   result.filesChecked++;if(spec.sha256&&hash(bytes)!==spec.sha256)issue(group,asset.id,'Hash mismatch: '+file);
   if(/\.(png|webp|jpg|jpeg)$/i.test(file)){try{const meta=await sharp(bytes).metadata();result.imagePixels+=(meta.width??0)*(meta.height??0);if(spec.width&&meta.width!==spec.width||spec.height&&meta.height!==spec.height)issue(group,asset.id,'Image dimensions mismatch: '+file);if(spec.alpha===true&&!meta.hasAlpha)issue(group,asset.id,'Expected transparent image: '+file);}catch{issue(group,asset.id,'Image decode failure: '+file);}}
  }
  if(asset.runtime?.kind==='native'){
   let profile;try{profile=JSON.parse(await readFile(asPath(asset.runtime.profile),'utf8'));}catch{issue(group,asset.id,'Native profile unreadable');continue;}
   result.nativeProfiles++;
   try{const skeleton=JSON.parse(await readFile(asPath(profile.runtime.json),'utf8'));const clips=skeleton.animations??{},skins=new Set((skeleton.skins??[]).map(s=>s.name));
    for(const skin of profile.skinNames??[])if(!skins.has(skin))issue(group,asset.id,'Absent native skin: '+skin);
    if(!profile.referenceHeight||!profile.previewBounds)issue(group,asset.id,'Native geometry not measured');
    if(!(profile.fps>0))issue(group,asset.id,'Invalid native frame clock');
    for(const weapon of Object.values(profile.weapons??{}))for(const [action,motion] of Object.entries(weapon.actions??{})){const clip=typeof motion==='string'?motion:motion.name;if(!clips[clip])issue(group,asset.id,'Absent native action '+action+': '+clip);}
    result.checks.push({id:asset.id,kind:'native',version:skeleton.skeleton?.spine,skins:profile.skinNames,referenceHeight:profile.referenceHeight,actionMaps:Object.values(profile.weapons??{}).map(w=>w.actions)});
   }catch(error){issue(group,asset.id,'Native source unreadable: '+error.message);}
  }else if(asset.runtime?.kind==='atlas'){
   result.atlases++;
   try{const atlas=JSON.parse(await readFile(asPath(asset.runtime.atlas),'utf8'));const frames=atlas.frames??{};const acts=asset.runtime.actions??asset.actions??{};for(const [action,def] of Object.entries(acts)){const keys=Array.isArray(def)?def:Array.isArray(def.frames)?def.frames:null;if(keys)for(const key of keys)if(!frames[key])issue(group,asset.id,'Atlas action frame absent '+action+'/'+key);}result.checks.push({id:asset.id,kind:'atlas',frames:Object.keys(frames).length,fps:asset.runtime.fps,anchor:asset.runtime.anchor});}catch(error){issue(group,asset.id,'Atlas unreadable: '+error.message);}
  }
 }
}
report.complete=Object.values(report.groups).every(g=>g.exists&&!g.missing.length)&&!report.issues.length;
await mkdir(join(docs,'reviews'),{recursive:true});await writeFile(join(docs,'reviews','manifest-'+phase+'.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({phase,groups:Object.fromEntries(Object.entries(report.groups).map(([k,v])=>[k,{exists:v.exists,expected:v.expected,delivered:v.delivered,missing:v.missing?.length,filesChecked:v.filesChecked}])),issues:report.issues,complete:report.complete}));
if(report.issues.length)process.exitCode=1;
