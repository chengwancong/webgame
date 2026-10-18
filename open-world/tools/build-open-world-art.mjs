import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {version,reference,assets,masks,actors,outstanding} from '../assets/open-world/spec.mjs';
import {symbols} from '../assets/open-world/map-symbols.mjs';
import {travelEffects} from '../assets/open-world/travel-effects.mjs';
import {applyWorldArtIntegration} from './world-art-integration.mjs';
const root=resolve(import.meta.dirname,'..'),group=join(root,'assets/open-world'),pub=join(root,'apps/web/public/art/open-world');
const hash=b=>createHash('sha256').update(b).digest('hex'),rel=p=>relative(root,p).replaceAll('\\','/');
const permissive=process.argv.includes('--allow-pending');
const json=async(p,v)=>{await mkdir(resolve(p,'..'),{recursive:true});await writeFile(p,JSON.stringify(v,null,2)+'\n');};
const file=async p=>{const bytes=await readFile(p),m=p.endsWith('.png')?await sharp(bytes).metadata():{};return {path:rel(p),sha256:hash(bytes),bytes:bytes.length,width:m.width,height:m.height,alpha:m.hasAlpha};};
const manifest={schemaVersion:1,version,reference,scope:'wind-island-art-foundation',status:'production-in-progress',gameplayIntegrated:false,accepted:false,assets:[],pending:[],outstanding};
await mkdir(join(pub,'textures'),{recursive:true});await mkdir(join(pub,'sprites'),{recursive:true});await mkdir(join(pub,'masks'),{recursive:true});
const env=JSON.parse(await readFile(join(root,'packages/asset-manifest/environment.v2.json'),'utf8'));
for(const def of assets){
 const source=join(root,def.source);try{await access(source);}catch(e){if(e.code!=='ENOENT')throw e;manifest.pending.push({id:def.id,name:def.name,reason:'source-not-produced'});continue;}
 let input=sharp(source);
 if(def.atlasFrame){const frame=env.frames[def.atlasFrame];if(!frame)throw Error('Unknown environment frame '+def.atlasFrame);const [left,top,width,height]=frame;input=input.extract({left,top,width,height});}
 const out=join(pub,def.kind==='ground'?'textures':'sprites',def.id+'.png');
 if(def.kind==='ground')input=input.resize(512,512,{fit:'cover'});
 else input=input.trim({threshold:1}).resize({width:768,height:768,fit:'inside',withoutEnlargement:true}).extend({top:8,bottom:8,left:8,right:8,background:{r:0,g:0,b:0,alpha:0}});
 await input.png().toFile(out);const meta=await sharp(out).metadata();
 if(def.kind==='sprite'&&!meta.hasAlpha)throw Error(def.id+' needs alpha');
 const width=meta.width,height=meta.height;
 manifest.assets.push({...def,source:{mode:def.sourceMode,path:def.source,...await file(source),adjustments:def.kind==='ground'?['Technical 512px resize; runtime mirrored-repeat sampling, not an original seamless-texture claim.']:['Technical alpha trim, proportional resize, 8px padding; painted colors and form unchanged.']},files:[await file(source),await file(out)],runtime:{kind:def.kind,file:'/art/open-world/'+(def.kind==='ground'?'textures/':'sprites/')+def.id+'.png',width,height,anchor:def.kind==='ground'?[0,0]:[.5,(height-8)/height],displayWidth:def.displayWidth,displayHeight:def.displayWidth?def.displayWidth*height/width:undefined,sampling:def.sampling,states:def.states??[def.state??'default'],statePolicy:def.statePolicy},status:'imported-awaiting-visual-review',accepted:false});
}
// Geometric blend masks are code-owned sampling data, not illustrative art.
for(const name of masks){const pixels=Buffer.alloc(256*256);for(let y=0;y<256;y++)for(let x=0;x<256;x++){let v;const px=x/255,py=y/255;switch(name){case 'east':v=px;break;case 'west':v=1-px;break;case 'north':v=1-py;break;case 'south':v=py;break;case 'radial':v=1-Math.hypot(px-.5,py-.5)*2;break;case 'radial-inverse':v=Math.hypot(px-.5,py-.5)*2;break;case 'corner-ne':v=1-Math.hypot(px-1,py)/Math.SQRT2;break;case 'corner-sw':v=1-Math.hypot(px,py-1)/Math.SQRT2;break;}v=Math.max(0,Math.min(1,v));pixels[y*256+x]=Math.round(v*v*(3-2*v)*255);}const out=join(pub,'masks',name+'.png');await sharp(pixels,{raw:{width:256,height:256,channels:1}}).png().toFile(out);manifest.assets.push({id:'ow-mask-'+name,name:'地表过渡 · '+name,kind:'mask',category:'mask',source:{mode:'code-native-sampling',path:'tools/build-open-world-art.mjs',...await file(join(root,'tools/build-open-world-art.mjs'))},files:[await file(out)],runtime:{kind:'mask',file:'/art/open-world/masks/'+name+'.png',width:256,height:256,anchor:[0,0],sampling:'clamp'},status:'imported-awaiting-visual-review',accepted:false});}
const nativePath=join(root,'assets/mini-hero/navy/runtime/Character.json'),native=JSON.parse(await readFile(nativePath,'utf8'));
const glowSource=join(root,'apps/web/public/art/telegraph-reuse/tip-glow.png'),glowOut=join(pub,'effects/glow.png');await mkdir(resolve(glowOut,'..'),{recursive:true});await copyFile(glowSource,glowOut);
for(const effect of travelEffects){const out=join(pub,'effects',effect.id+'.json'),runtime={kind:'procedural-effect',file:'/art/open-world/effects/'+effect.id+'.json',texture:'/art/open-world/effects/glow.png',mount:'ground-foot',duration:effect.duration,scale:effect.scale,alpha:effect.alpha,color:effect.color,pillar:effect.pillar,referenceOnly:true};await json(out,runtime);manifest.assets.push({id:'ow-fx-'+effect.id,name:effect.name,kind:'effect',category:'travel-effect',source:{mode:'registered-texture-plus-procedural-timeline',...await file(glowSource),nativeAnimationRestored:false,timeline:'assets/open-world/travel-effects.mjs'},files:[await file(glowSource),await file(glowOut),await file(out)],runtime,status:'imported-awaiting-dynamic-review',accepted:false});}
const tokens=JSON.parse(await readFile(join(root,'packages/ui-tokens/tokens.json'),'utf8'));
for(const symbol of symbols){const stroke=tokens.Color[symbol.tone]?.dark;if(!stroke)throw Error('Unknown map color token '+symbol.tone);const out=join(pub,'symbols',symbol.id+'.svg');await mkdir(resolve(out,'..'),{recursive:true});const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="${tokens.Color.Panel.dark}" stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${symbol.shape}</svg>`;await writeFile(out,svg);manifest.assets.push({id:'ow-symbol-'+symbol.id,name:symbol.name,kind:'symbol',category:'map-symbol',source:{mode:'code-native-svg',...await file(join(group,'map-symbols.mjs')),styleReference:'apps/web/public/art/starsea/props/ss-prop-sign.svg',colorToken:'Color.'+symbol.tone},files:[await file(out)],runtime:{kind:'symbol',file:'/art/open-world/symbols/'+symbol.id+'.svg',width:64,height:64,displayWidth:32,anchor:[.5,.5],states:[symbol.state??'default']},status:'imported-awaiting-visual-review',accepted:false});}
// Fog is a sampling mask for unexplored cells; exploration authority remains in M1.
const fog=join(pub,'masks','fog.png'),fogPixels=Buffer.alloc(256*256);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const edge=Math.min(x,y,255-x,255-y)/20,t=Math.max(0,Math.min(1,edge));fogPixels[y*256+x]=Math.round(255*t*t*(3-2*t));}await sharp(fogPixels,{raw:{width:256,height:256,channels:1}}).png().toFile(fog);manifest.assets.push({id:'ow-mask-fog',name:'全图迷雾遮罩',kind:'mask',category:'mask',source:{mode:'code-native-sampling',...await file(join(root,'tools/build-open-world-art.mjs'))},files:[await file(fog)],runtime:{kind:'mask',file:'/art/open-world/masks/fog.png',width:256,height:256,anchor:[0,0]},status:'imported-awaiting-visual-review',accepted:false});
const skinNames=new Set(native.skins.map(s=>s.name));
const template=JSON.parse(await readFile(join(root,'assets/starsea/npc/manifest.json'),'utf8')).assets.find(a=>a.id==='ss-npc-tongling');
for(const def of actors){
 for(const s of def.skins)if(!skinNames.has(s))throw Error('Native skin missing '+s);
 const base=JSON.parse(await readFile(join(root,'apps/web/public/art/starsea/npc/ss-npc-'+def.kit+'/profile.json'),'utf8'));
 const selectedSkins=[...def.skins,'STARSEA/'+def.kit];
 const profile={...base,id:def.id,skinNames:selectedSkins};delete profile.slotTints;
 const out=join(pub,'actors',def.id,'profile.json');await json(out,profile);
 const dependencyFiles=[base.runtime.json,base.runtime.atlas,'/art/starsea/npc/shared/Character.png','/art/starsea/npc/shared/Character_2.png','/art/starsea/npc/shared/NpcParts.png'];
 manifest.assets.push({...def,kind:'actor',category:'outpost-npc',source:{mode:'native-skin-combination',...await file(nativePath),nativeVersion:native.skeleton.spine,skins:selectedSkins,professionKit:'ss-npc-'+def.kit,adjustments:['Reuse verified native profession attachments on original hand/head/pelvis bones; new body/head/hair combination.']},files:[await file(nativePath),await file(out),...await Promise.all(dependencyFiles.map(p=>file(join(root,'apps/web/public'+p))))],runtime:{...template.runtime,profile:'/art/open-world/actors/'+def.id+'/profile.json',displayHeight:100,accessorySockets:base.accessorySockets},actions:template.actions,states:[],status:'imported-awaiting-dynamic-review',accepted:false});
}
manifest.counts={imported:manifest.assets.length,pending:manifest.pending.length,independentNewImages:manifest.assets.filter(a=>a.source.mode==='imagegen').length,nativeActors:actors.length,codeMasks:masks.length+1,mapSymbols:symbols.length,travelEffects:travelEffects.length};
await (await import('./build-wind-art-expansion.mjs')).extendWindArt(manifest);
await applyWorldArtIntegration(manifest,root);
await json(join(group,'manifest.json'),manifest);await json(join(pub,'manifest.json'),manifest);await json(join(root,'packages/asset-manifest/open-world.v1.json'),manifest);
if(manifest.pending.length&&!permissive)throw Error('Open-world art sources are pending: '+manifest.pending.map(a=>a.id).join(', '));
console.log(JSON.stringify({version,status:manifest.status,...manifest.counts,gameplayIntegrated:manifest.gameplayIntegrated,accepted:manifest.accepted}));
// The complete five-island package joins public builds only after its source gate.
const fiveGate=join(group,'five-islands/production.json');
try{const gate=JSON.parse(await readFile(fiveGate,'utf8'));if(gate.enabled===true)await import('./build-five-island-art.mjs');}catch(e){if(e.code!=='ENOENT')throw e;}
