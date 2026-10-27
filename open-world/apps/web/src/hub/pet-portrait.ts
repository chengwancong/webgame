/**
 * U3 宠物头像：从宠物图集（与 pet-follower 同一份 manifest）裁出待机第一帧，按容器大小等比缩放。
 * 先输出占位 span，挂到 DOM 后调用 hydratePetPortraits；资源缺失时保持空占位，不报错。
 */
import {esc} from '../ui-components.ts';
import {loadPixelManifest,pixelAsset} from '../pixel-assets.ts';
import {pixelRuntime,onPixelChange} from '../pixel-texture.ts';

type PetArt = {image: string; atlas: string};
type Frame = {image: string; x: number; y: number; w: number; h: number};
type AtlasJson = {frames: Record<string, {frame: {x: number; y: number; w: number; h: number}}>};

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
      if(pixelRuntime.cellStage>0){await loadPixelManifest();const a=pixelAsset(runtime);if(a){const row=a.actions?.idle?.row??0;f={image:a.file,x:0,y:row*a.frame[1],w:a.frame[0],h:a.frame[1]};}}
      if(version!==pixelRuntime.version)return;
      if (!f || !el.isConnected) return;
      const fit=Math.min((el.clientWidth || f.w) / f.w, (el.clientHeight || f.h) / f.h);
      const k=pixelRuntime.cellStage>0?Math.max(1,Math.floor(fit)):fit;
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
