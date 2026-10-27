import {loadPixelManifest,loadPixelImage,pixelAsset,pixelFrameIndex,pixelSocket,pixelOutfit,type PixelAsset,type PixelAction} from './pixel-assets.ts';
import type {WardrobeRenderState} from './wardrobe-renderer.ts';
import type {ResolvedAppearance} from '../../../packages/contracts/appearance.ts';
import palette from '../../../packages/asset-manifest/pixel-palette.json';
import {dyeShibaGarment} from './pixel-shiba-style.ts';
const familyWeapon:Record<string,string>={sword:'sword',axe:'axe',bow:'bow',gun:'hidden',fist:'hidden',spear:'staff',magic:'staff'};
export function pixelHeroKey(appearance:ResolvedAppearance,mode:'native'|'wardrobe'){
 if(!appearance.kit&&mode==='wardrobe')return `hero:${appearance.family}:wardrobe`;
 if(!appearance.kit&&mode==='native'&&appearance.parts.weapon.setId==='300601')return 'hero:sword-twohand:native';
 return `hero:${appearance.kit?.weapon?.type??familyWeapon[appearance.family]??'sword'}:${mode}`;
}
/** Apply a set's ramps within semantic body regions, once per committed outfit. */
function dyeBody(image:HTMLImageElement,appearance:ResolvedAppearance,native=false,style?:PixelAsset['appearanceStyle']){
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),source=palette.ramps;
 const maps=Object.fromEntries(Object.entries(appearance.parts).map(([slot,p])=>[slot,pixelOutfit(p.setId)]));
 const armor=appearance.kit?.armor,rampByFamily={sword:'navy',hammer:'copper',axe:'earth',bow:'leaf',staff:'arcane',hidden:'fire',wand:'water'} as const;
 if(style==='shiba'){const outfit=maps.body,target=armor?palette.ramps[rampByFamily[armor.family]]:native?palette.ramps.navy:outfit?.cloth??palette.ramps.navy;dyeShibaGarment(pixels.data,target);ctx.putImageData(pixels,0,0);return canvas;}
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
  const i=(y*canvas.width+x)*4;if(!pixels.data[i+3])continue;
  const lx=x%64,ly=y%64,slot=ly<27?'head':ly>=54?'feet':ly>=44?'legs':lx<24?'back':lx>=35?'hands':'body',outfit=maps[slot];if(!outfit)continue;
  const hex='#'+[pixels.data[i],pixels.data[i+1],pixels.data[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');
  const ramp=slot==='head'?source.navy:ly>=44||slot==='hands'?source.wood:source.navy,index=ramp.indexOf(hex);if(index<0)continue;
  const target=slot!=='head'&&armor?palette.ramps[rampByFamily[armor.family]]:slot==='head'?outfit.hair:native?palette.ramps.navy:outfit.cloth;
  const color=target[Math.min(target.length-1,index+(armor&&slot!=='head'?armor.tier-1:0))];if(!color)continue;
  const rgb=color.slice(1).match(/../g)!.map(v=>parseInt(v,16));pixels.data[i]=rgb[0];pixels.data[i+1]=rgb[1];pixels.data[i+2]=rgb[2];
 }
 ctx.putImageData(pixels,0,0);return canvas;
}
/** A whole authored frame is copied with integer coordinates; no bone transforms. */
export class PixelActorPainter{
 private asset?:PixelAsset;private image?:HTMLImageElement;private requested='';private key='';private clip?:PixelAction;private index=0;private mirror=false;
 private scale=2;private foot:[number,number]=[0,0];private dead=false;private generation=0;
 private layers:CanvasImageSource[]=[];private overlay?:HTMLImageElement;private appearance?:ResolvedAppearance;private requestIdentity='';
 private actionName='idle';
 constructor(private canvas:HTMLCanvasElement,private options={height:96,footX:.5,footY:.75}){}
 request(key:string,appearance?:ResolvedAppearance){
  const identity=key+JSON.stringify([appearance?.parts,appearance?.kit]);if(this.requestIdentity===identity)return;this.requestIdentity=identity;this.requested=key;this.asset=undefined;this.image=undefined;this.layers=[];this.overlay=undefined;this.key='';this.appearance=appearance?structuredClone(appearance):undefined;const generation=++this.generation;
  void loadPixelManifest().then(async()=>{
   const asset=pixelAsset(key);if(!asset)return;
   const image=await loadPixelImage(asset),layers=await Promise.all((asset.layers??[]).map(async k=>{const a=pixelAsset(k);if(!a)throw Error('Pixel body layer missing: '+k);return loadPixelImage(a);}));
   const overlayKey=asset.appearanceStyle!=='shiba'&&appearance&&pixelOutfit(appearance.parts.head.setId)?.overlay,overlayAsset=overlayKey&&pixelAsset(overlayKey),overlay=overlayAsset?await loadPixelImage(overlayAsset):undefined;
   return{asset,image,layers,overlay};
  }).then(result=>{if(result&&!this.dead&&this.generation===generation){this.asset=result.asset;this.image=result.image;this.layers=result.layers.map((image,i)=>i===0&&appearance?dyeBody(image,appearance,key.endsWith(':native'),result.asset.appearanceStyle):image);this.overlay=result.overlay;}}).catch(()=>{if(this.generation===generation)this.requestIdentity='';});
 }
 get ready(){return Boolean(this.asset&&this.image);}
 supports(action:string,phase?:string){const name=phase==='phase-enter'||phase==='phase-end'?'idle':action;return Boolean(this.image&&(this.asset?.actions?.[phase+':'+name]??this.asset?.actions?.[action]));}
 render(state:WardrobeRenderState):boolean{
  const asset=this.asset,image=this.image,phaseAction=state.pixelPhase==='phase-enter'||state.pixelPhase==='phase-end'?'idle':state.action,phase=state.pixelPhase+':'+phaseAction,name=asset?.actions?.[phase]?phase:state.motionFamily&&asset?.actions?.[state.motionFamily+':'+state.action]?state.motionFamily+':'+state.action:state.action,clip=asset?.actions?.[name];if(!asset||!image||!clip)return false;this.actionName=name;
  this.clip=clip;this.index=pixelFrameIndex(clip,state.clock,clip.loop??(state.action==='idle'||state.action==='move'),state.cast);this.mirror=state.facing<0;
  this.scale=Math.max(1,Math.floor(this.options.height/48));this.foot=[Math.round(this.canvas.width*this.options.footX),Math.round(this.canvas.height*this.options.footY)];
  const key=[this.requestIdentity,name,this.index,this.mirror,this.canvas.width,this.canvas.height,this.scale].join(':');if(this.key===key)return false;this.key=key;
  const ctx=this.canvas.getContext('2d')!;ctx.clearRect(0,0,this.canvas.width,this.canvas.height);ctx.save();ctx.imageSmoothingEnabled=false;
  ctx.translate(this.foot[0],this.foot[1]);ctx.scale(this.mirror?-this.scale:this.scale,this.scale);
  const layers=this.layers.length?this.layers:[image];for(let i=0;i<layers.length;i++){if(i===1&&this.appearance?.kit&&!this.appearance.kit.weapon)continue;ctx.drawImage(layers[i],this.index*asset.frame[0],clip.row*asset.frame[1],...asset.frame,-asset.anchor[0],-asset.anchor[1],...asset.frame);}
  if(this.overlay)ctx.drawImage(this.overlay,(clip.poses?.[this.index]??this.index)*64,(clip.overlayRow??clip.row)*64,64,64,-asset.anchor[0],-asset.anchor[1],64,64);
  ctx.restore();return true;
 }
 socket(name:string,frameName?:string){const match=frameName&&/#([^#]+)_(\d+)$/.exec(frameName),clip=match?this.asset?.actions?.[match[1]]:this.clip,index=match?Number(match[2]):this.index,p=clip?.sockets[index]?.[name],a=this.asset;if(!p||!a)return;const [x,y]=pixelSocket(p,a.anchor,this.foot,this.scale,this.mirror);return{x,y};}
 get frameName(){return `pixel-${this.requested}#${this.actionName}_${this.index}`;}
 get releasePoseFrame(){return this.clip?`pixel-${this.requested}#${this.actionName}_${this.clip.impactFrame}`:undefined;}
 releaseFrame(action:string){const resolved=action===this.actionName.split(':').at(-1)?this.actionName:action,clip=this.asset?.actions?.[resolved];return clip?`pixel-${this.requested}#${resolved}_${clip.impactFrame}`:undefined;}
 get mirrored(){return this.mirror;}
 reset(){this.key='';}
 destroy(){this.dead=true;this.generation++;this.asset=undefined;this.image=undefined;}
}
