/** PX production inventory: runtime registrations and reachable application resources only. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runtimeResources} from '../../packages/asset-manifest/runtime-resources.ts';
import {actorCatalog} from '../../packages/asset-manifest/actors.ts';
import wardrobe from '../../packages/asset-manifest/wardrobe.json';
import ui from '../../packages/asset-manifest/ui.v2.json';
import story from '../../packages/asset-manifest/story-npcs.json';
import {iconNames} from '../../apps/web/src/ui/icons.ts';
import {hexGlyphs,hexCategoryGlyphs} from '../../apps/web/src/hex-rune-icon.ts';
import {actorRole} from './actor-spec.mjs';
import {nativeProfileFor} from '../../apps/web/src/starsea-actor-preview.ts';

export const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
export type InventoryRow={key:string;paths:string[];category:string;batch:string;source:string;missing:string[]};
const raster=/\.(png|webp|jpe?g|gif|svg)$/i;
const excluded=/(^|\/)(qa|legacy|preview[^/]*|evidence|scene-review-[^/]*)(\/|$)/i;
const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
function imagePaths(value:unknown):string[]{
 if(typeof value==='string')return value.startsWith('/art/')&&raster.test(value)&&!excluded.test(value)?[value]:[];
 if(Array.isArray(value))return value.flatMap(imagePaths);
 if(!value||typeof value!=='object')return [];
  return Object.entries(value).filter(([k])=>!['source','sha256','review','evidence','mockups','prompt','sourcePath','portrait'].includes(k)).flatMap(([,v])=>imagePaths(v));
}
/** Follow only local modules starting at the shipped client entry, not QA entry points. */
export function reachableClientFiles(){
 const found=new Set<string>(),visit=(file:string)=>{
  if(found.has(file)||!fs.existsSync(file)||excluded.test(file.replaceAll('\\','/')))return;
  found.add(file);if(file.endsWith('.css')){const css=fs.readFileSync(file,'utf8');for(const m of css.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g))visit(path.resolve(path.dirname(file),m[1]));return;}if(!/\.[cm]?[jt]sx?$/.test(file))return;
  const text=fs.readFileSync(file,'utf8');
  for(const match of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/g)){
   const base=path.resolve(path.dirname(file),match[1]);
   const next=[base,base+'.ts',base+'.json',path.join(base,'index.ts')].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());if(next)visit(next);
  }
 };
 visit(path.join(root,'apps/web/src/main.ts'));return found;
}
export function collectInventory():InventoryRow[]{
 const rows:InventoryRow[]=[],seen=new Set<string>();
 const portMap=runtimeResources.get('ss-map-port') as any,portFile=portMap?.runtime.file&&path.join(root,'apps/web/public',portMap.runtime.file);
 const portDecorations=new Set<string>(portFile&&fs.existsSync(portFile)?read(portFile).decorations.map((d:any)=>d.resourceId):[]);
 const add=(key:string,paths:string[],category:string,batch:string,source:string)=>{
  paths=[...new Set(paths)].sort();if(!paths.length||seen.has(key))return;seen.add(key);
  rows.push({key,paths,category,batch,source,missing:paths.filter(p=>!fs.existsSync(path.join(root,p.startsWith('code:')?'':'apps/web/public',p.replace(/^(native-profile|motion|code):/,'').split('#')[0])))});
 };
 for(const [id,a] of runtimeResources){
  const asset=a as any,r=asset.runtime,category=r.kind==='native'&&(id.startsWith('ow-npc-')||asset.type==='motion')?'npc':r.kind==='effect'?'vfx':asset.group;
  const batch=category==='npc'?'PX3':category==='pets'?'PX7':['monsters','bosses'].includes(category)?'PX4':category==='vfx'||id.startsWith('fx-')?'PX6':/\/hub-port\//.test(r.file??'')||id==='ow-hub-port-marks'||portDecorations.has(id)?'PX2':'PX5';
  const paths=imagePaths({...r,variants:r.variants?.filter((v:any)=>v.file===r.file)});
  if(r.kind==='native'){
   const actions=[...Object.keys(asset.actions??{}).filter(k=>k!=='skills'),...Object.keys(asset.actions?.skills??{})];
   for(const action of actions)for(const phase of ['default','phase-enter','phase-active','phase-end']){const profile=nativeProfileFor({...asset,states:asset.states??{}},action,phase);if(profile)paths.push(profile);}
   if(!paths.length)paths.push('unregistered-profile:'+id);
  }
  add(id,paths,category,batch,'runtimeResources');
  if(category==='monsters'&&actorRole(id,category)==='ordinary')add(id+':elite',paths.map(p=>p+'#elite'),category,'PX4','runtime elite flag');
  for(const variant of r.variants??[])if(variant.file&&variant.file!==r.file)add(`${id}:variant:${variant.id}`,[variant.file],category,'PX5','runtimeResources variant');
 }
 for(const [id,a] of Object.entries(actorCatalog))if(a.source!=='starsea'){
  add(id,[`/art/${a.texture??id}.png`],id==='hero'?'hero':'actor',id==='hero'?'PX1':'PX4','actorCatalog');
  if(id!=='hero'&&actorRole(id,'actor')==='ordinary')add(id+':elite',[`/art/${a.texture??id}.png#elite`],'actor','PX4','runtime elite flag');
 }
 for(const type of ['sword','hammer','axe','bow','staff','hidden','wand'])add(`hero:${type}:native`,[`/art/mini-hero/navy/profile.json#weapon:${type}`],'hero','PX1','nativeKit gameplay weapon');
 const legacyFamilies:Record<string,string>={sword:'sword',hammer:'axe',axe:'axe',bow:'bow',staff:'magic',hidden:'fist',wand:'magic',gun:'gun',fist:'fist',spear:'spear',magic:'magic'};
 for(const [type,family] of Object.entries(legacyFamilies))add(`hero:${type}:wardrobe`,[(wardrobe.motions as Record<string,{url:string}>)[family].url],'hero','PX1','wardrobe motion family');
 for(const [id,npc] of Object.entries(story.npcs))add(`story-npc:${id}`,[npc.profile],'npc','PX3','story-npcs.json');
 add('unit-shadow',['code:apps/web/src/scene.ts#unit-shadow'],'props','PX5','runtime generated shadow');
 for(const name of ['hero-portrait','hero-figure'])add('pixel-ui:'+name,['code:apps/web/src/pixel-images.ts#'+name],'image','PX8','pixel-mode hero HUD and character figure');
 for(const registry of ['pixel-inline-art.json','pixel-generated-art.json']){const inlineIndex=path.join(root,'packages/asset-manifest',registry);if(fs.existsSync(inlineIndex))for(const row of read(inlineIndex))add(row.key,row.paths,row.category,row.batch,row.source);}
 for(const [id,a] of Object.entries(ui.assets)){
  // Dialogue portraits remain in their original style, as required by PX3.
  if(a.kind==='portrait'||id.startsWith('portrait-')||id==='sample-world')continue;
  add(id,imagePaths(a),'icon','PX8','ui.v2.json');
 }
 // Retain every shipped modular part: any accepted outfit may be selected at runtime.
 for(const setId of wardrobe.shippedSets)add(`wardrobe:${setId}`,Object.keys(wardrobe.partSlots).flatMap(slot=>{
  const names=(wardrobe.partSlots as Record<string,string[]>)[slot];return Array.isArray(names)?names.map(part=>wardrobe.setUrlTemplate.replace('{setId}',setId).replace('{part}',part)):[];
 }),'wardrobe','PX1','wardrobe.json');
 const petFile=path.join(root,'apps/web/public/art/starsea/pets/v3/manifest.json');
 if(fs.existsSync(petFile))for(const asset of read(petFile).assets??[])add(asset.id,imagePaths(asset.runtime),'pet','PX7','pets/v3/manifest.json');
 for(const id of iconNames)add('ui-icon:'+id,['code:apps/web/src/ui/icons.ts#'+id],'icon','PX8','inline UI glyph');
 for(const id of ['bag','build','growth','appearance','goal','settings','combat','today','commission','port-build','chart','warehouse','archive','pets','stargate','coin','pause','play','more','material','xp'])add('hud-icon:'+id,['code:apps/web/src/hud-icons.ts#'+id],'icon','PX8','inline HUD glyph');
 for(const id of [...hexGlyphs,...hexCategoryGlyphs,'generic'])add('hex:'+id,['code:apps/web/src/hex-rune-icon.ts#'+id],'icon','PX8','inline HEX glyph');
 for(const profile of Object.values(wardrobe.styleOverrides))for(const [id,parts]of Object.entries(profile))add('wardrobe-style:'+id,imagePaths(parts),'icon','PX9','appearance thumbnails');
 const explore=read(path.join(root,'packages/content/hub-explore.json'));
 for(const id of Object.keys(explore.keys??{}))for(const locked of ['', '-locked'])add('key:'+id+locked,[`/art/hub-ui/keys/key-${id}${locked}.png`],'icon','PX9','chart door key template');
 const chart=read(path.join(root,'packages/content/hub-chart.json'));
 const regionIds=new Set<string>((chart.regions??[]).map((r:any)=>r.id));
 for(const id of regionIds)add('chart-bg:'+id,[`/art/hub-ui/chart-bg-${id}.webp`],'image','PX9','chart background template');
 for(const id of ['s','a','b'])add('grade:'+id,[`/art/hub-fun/grade-${id}.png`],'icon','PX9','run grade template');
 for(const file of reachableClientFiles()){
  const name=path.relative(root,file).replaceAll('\\','/');
  if(file.endsWith('.json')){
   if(!name.startsWith('packages/asset-manifest/')||/sockets|catalog|wardrobe|open-world|starsea|ui\.v2/.test(name))continue;
   const j=read(file);for(const [key,value] of Object.entries(j))add(`${path.basename(file,'.json')}:${key}`,imagePaths(value),/fx/.test(name)?'effect':'runtime',/fx/.test(name)?'PX6':/pet/.test(name)?'PX7':'PX8',name);
  }else{
   const text=fs.readFileSync(file,'utf8');
   if(file.endsWith('.css'))for(const match of text.matchAll(/url\(\s*['"]?(\/art\/[^)'"\s]+\.(?:png|webp|jpe?g|svg))/g))add('css:'+match[1],[match[1]],'chrome','PX9',name);
   for(const match of text.matchAll(/['"](\/art\/[^'"`$]+\.(?:png|webp|jpe?g))['"]/g))if(!excluded.test(match[1]))add(`file:${match[1]}`,[match[1]],'literal',/fx|effect/.test(name)?'PX6':/pet/.test(name)?'PX7':'PX8',name);
  }
 }
 return rows.sort((a,b)=>a.batch.localeCompare(b.batch)||a.key.localeCompare(b.key));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const rows=collectInventory(),counts=Object.fromEntries([...new Set(rows.map(r=>r.batch))].map(b=>[b,rows.filter(r=>r.batch===b).length]));
 const target=process.argv.indexOf('--output');if(target>=0)fs.writeFileSync(process.argv[target+1],JSON.stringify(rows,null,2)+'\n');
 console.log(JSON.stringify({rows:rows.length,counts,missingFiles:rows.reduce((n,r)=>n+r.missing.filter(p=>!p.startsWith('native-profile:')).length,0),reachableModules:reachableClientFiles().size}));
}
