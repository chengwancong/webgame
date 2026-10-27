/**
 * U3 宠物头像：从宠物图集（与 pet-follower 同一份 manifest）裁出待机第一帧，按容器大小等比缩放。
 * 先输出占位 span，挂到 DOM 后调用 hydratePetPortraits；资源缺失时保持空占位，不报错。
 */
import {esc} from '../ui-components.ts';
import {loadPixelManifest,pixelAsset,type PixelAsset} from '../pixel-assets.ts';
import {pixelRuntime,onPixelChange} from '../pixel-texture.ts';

type PetArt = {image: string; atlas: string};
type Frame = {image: string; x: number; y: number; w: number; h: number};
type AtlasJson = {frames: Record<string, {frame: {x: number; y: number; w: number; h: number}}>};
type PixelPortraitAsset=Pick<PixelAsset,'file'|'frame'|'actions'>&{portraitFrame?:{x:number;y:number;w:number;h:number}};
/** Crop the visible creature, not the mostly empty authoring cell, into the unchanged avatar box. */
export function pixelPetPortraitFrame(asset:PixelPortraitAsset):Frame{const row=asset.actions?.idle?.row??0,f=asset.portraitFrame;return f?{image:asset.file,x:f.x,y:row*asset.frame[1]+f.y,w:f.w,h:f.h}:{image:asset.file,x:0,y:row*asset.frame[1],w:asset.frame[0],h:asset.frame[1]};}
export function petPortraitScale(frame:Pick<Frame,'w'|'h'>,width:number,height:number,pixel:boolean){const fit=Math.min((width||frame.w)/frame.w,(height||frame.h)/frame.h);return pixel&&fit>1?Math.floor(fit):fit;}

let manifest: Promise<Map<string, PetArt>> | undefined;
const frames = new Map<string, Promise<Frame | null>>();
/** 已加载完成的帧：面板重绘时同步挂上，避免头像闪一下。 */
const ready = new Map<string, Frame | null>();

function petManifest() {
  manifest ??= fetch('/art/starsea/pets/v3/manifest.json').then(r => r.json())
    .then((m: {assets: {id: string; runtime: PetArt}[]}) => new Map(m.assets.map(a => [a.id, a.runtime])))
    .catch(() => new Map<string, PetArt>());
  return manifest;
}

function portraitFrame(runtime: string): Promise<Frame | null> {
  let hit = frames.get(runtime);
  if (!hit) {
    hit = petManifest().then(async map => {
      const art = map.get(runtime);
      if (!art) return null;
      const atlas: AtlasJson = await fetch(art.atlas).then(r => r.json());
      const key = atlas.frames.idle_0 ? 'idle_0' : Object.keys(atlas.frames).sort()[0];
      const f = key ? atlas.frames[key]?.frame : undefined;
      return f ? {image: art.image, ...f} : null;
    }).catch(() => null).then(f => { ready.set(runtime, f); return f; });
    frames.set(runtime, hit);
  }
  return hit;
}

/** runtime 如 ss-pet-wind-free-young；图鉴里只有 family 时用 `ss-pet-${family}-young`。 */
export function petPortraitHtml(runtime: string, extraClass = ''): string {
  return `<span class="pet-portrait${extraClass ? ` ${extraClass}` : ''}" data-pet-runtime="${esc(runtime)}" aria-hidden="true"></span>`;
}

export function hydratePetPortraits(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.pet-portrait[data-pet-runtime]:not([data-ready])').forEach(el => {
    el.dataset.ready = '1';
    const runtime = el.dataset.petRuntime!;
    const mount = async (original: Frame | null) => {
      let f=original;const version=pixelRuntime.version;
      if(pixelRuntime.cellStage>0){await loadPixelManifest();const a=pixelAsset(runtime);if(a)f=pixelPetPortraitFrame(a.small?pixelAsset(a.small)??a:a);}
      if(version!==pixelRuntime.version)return;
      if (!f || !el.isConnected) return;
      const k=petPortraitScale(f,el.clientWidth,el.clientHeight,pixelRuntime.cellStage>0);
      el.replaceChildren();
      const sprite = document.createElement('i');
      sprite.className = 'pet-portrait__frame';
      sprite.style.cssText = `width:${f.w}px;height:${f.h}px;background-image:url("${f.image}");background-position:${-f.x}px ${-f.y}px;scale:${k.toFixed(3)};image-rendering:${pixelRuntime.cellStage>0?'pixelated':'auto'}`;
      el.append(sprite);
    };
    if (ready.has(runtime)) mount(ready.get(runtime)!);
    else void portraitFrame(runtime).then(mount);
  });
}

if(typeof document!=='undefined')onPixelChange(()=>{for(const el of document.querySelectorAll<HTMLElement>('.pet-portrait[data-pet-runtime]'))delete el.dataset.ready;hydratePetPortraits(document);});
