/** Unit identity previews reuse the registered portrait or the unit's own atlas idle frame. */
import {art} from '../ui-assets.ts';
import {esc,iconHtml} from '../ui-components.ts';
import {loadJSON,loadStarsea} from '../starsea-assets.ts';
import type {TacticalUnitView} from './contract.ts';

type PortraitFrame={image:string;x:number;y:number;width:number;height:number;sheetWidth:number;sheetHeight:number};
type Atlas={
 frames:Record<string,{frame:{x:number;y:number;w:number;h:number};rotated?:boolean}>;
 meta?:{size?:{w:number;h:number}};
};
let manifest:ReturnType<typeof loadStarsea>|undefined;
const pendingFrames=new Map<string,Promise<PortraitFrame|null>>();
const resolvedFrames=new Map<string,PortraitFrame|null>();
const isDimension=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0;

function portraitFrame(assetId:string):Promise<PortraitFrame|null>{
 let pending=pendingFrames.get(assetId);
 if(!pending){
  pending=(manifest??=loadStarsea()).then(async pack=>{
   const asset=pack.assets.find(row=>row.id===assetId);
   const runtime=asset?.runtime;
   if(runtime?.kind!=='atlas'||!runtime.image?.startsWith('/art/')||!runtime.atlas?.startsWith('/art/'))return null;
   const atlas=await loadJSON<Atlas>(runtime.atlas);
   const idle=runtime.actions?.idle?.frames?.[0]??'idle_0',entry=atlas.frames[idle];
   const frame=entry?.frame,size=atlas.meta?.size;
   if(!frame||entry.rotated||!size||!isDimension(frame.w)||!isDimension(frame.h)||!isDimension(size.w)||!isDimension(size.h)
    ||!Number.isFinite(frame.x)||!Number.isFinite(frame.y)||frame.x<0||frame.y<0||frame.x+frame.w>size.w||frame.y+frame.h>size.h)return null;
   return {image:runtime.image,x:frame.x,y:frame.y,width:frame.w,height:frame.h,sheetWidth:size.w,sheetHeight:size.h};
  }).catch(()=>null).then(frame=>{resolvedFrames.set(assetId,frame);return frame;});
  pendingFrames.set(assetId,pending);
 }
 return pending;
}

export function unitPortraitHtml(unit:TacticalUnitView):string{
 const hero=unit.side==='hero'&&unit.art.kind==='hero-native';
 return `<span class="tb-unit-portrait" data-portrait-kind="${hero?'hero':'atlas'}" data-unit-art="${esc(unit.art.assetId)}" data-portrait-name="${esc(unit.name)}" data-portrait-state="loading" aria-hidden="true"><span class="tb-unit-portrait-fallback">${iconHtml(unit.side==='hero'?'people':'skull',{size:24})}</span>${hero?`<img class="tb-unit-portrait-image" src="${esc(art('portrait-bust'))}" alt="" draggable="false">`:''}</span>`;
}

/** Call after mounting the HUD. Failure retains an explicitly identified generic symbol. */
export function hydrateUnitPortraits(root:ParentNode):void{
 root.querySelectorAll<HTMLElement>('.tb-unit-portrait:not([data-portrait-hydrated])').forEach(el=>{
  el.dataset.portraitHydrated='true';
  const ready=()=>{if(el.isConnected){el.dataset.portraitState='ready';el.removeAttribute('title');}};
  const missing=()=>{if(el.isConnected){el.dataset.portraitState='missing';el.title=`${el.dataset.portraitName??'单位'}：暂无可用图像，显示身份标记`;}};
  if(el.dataset.portraitKind==='hero'){
   const image=el.querySelector<HTMLImageElement>('.tb-unit-portrait-image');
   if(!image){missing();return;}
   if(image.complete){image.naturalWidth>0?ready():missing();return;}
   image.addEventListener('load',ready,{once:true});image.addEventListener('error',missing,{once:true});
   return;
  }
  const mount=(frame:PortraitFrame|null)=>{
   if(!el.isConnected)return;
   if(!frame){missing();return;}
   // An SVG viewport crops the atlas at any CSS size; no new bitmap or guessed face crop.
   const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),image=document.createElementNS(ns,'image');
   svg.setAttribute('class','tb-unit-portrait-frame');svg.setAttribute('viewBox',`${frame.x} ${frame.y} ${frame.width} ${frame.height}`);
   svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.setAttribute('aria-hidden','true');
   svg.setAttribute('width','100%');svg.setAttribute('height','100%');svg.style.overflow='hidden';
   image.setAttribute('width',String(frame.sheetWidth));image.setAttribute('height',String(frame.sheetHeight));
   image.addEventListener('load',ready,{once:true});image.addEventListener('error',missing,{once:true});
   image.setAttribute('href',frame.image);svg.append(image);el.append(svg);
  };
  const id=el.dataset.unitArt??'';
  if(resolvedFrames.has(id))mount(resolvedFrames.get(id)!);else void portraitFrame(id).then(mount);
 });
}
