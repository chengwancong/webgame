/** Reversible DOM image and inline-glyph substitution using approved pixel assets. */
import {loadPixelManifest,pixelAsset,type PixelAsset} from './pixel-assets.ts';
import {pixelRuntime,onPixelChange} from './pixel-texture.ts';
const known=new Map<string,{original:string;key:string;small:boolean}>(),reverse=new Map<string,string>();
const originalImages=new WeakMap<HTMLImageElement,{src:string;width:string;height:string;imageRendering:string;objectFit:string}>(),originalSvg=new WeakMap<SVGElement,{body:string;viewBox:string|null;style:string|null}>();
const atlasStyles=new WeakMap<HTMLElement,string|null>();
const sourcePath=(value:string)=>{try{return new URL(value,location.href).pathname;}catch{return value;}};
export function resolvePixelImage(original:string,key=original,small=false){
 known.set(original,{original,key,small});const asset=small?pixelAsset(key+':16')??pixelAsset(key):pixelAsset(key);if(asset)reverse.set(asset.file,original);return pixelRuntime.cellStage>0&&asset?asset.file:original;
}
export function pixelDomAsset(original:string,small?:boolean):PixelAsset|undefined{const entry=known.get(original),key=entry?.key??sourcePath(original);const a=pixelAsset(key);return (small??entry?.small)?(a?.small?pixelAsset(a.small):pixelAsset(key+':16'))??a:a;}
function image(el:HTMLImageElement){
 const raw=el.getAttribute('src')??'',saved=originalImages.get(el),original=reverse.get(raw)??(!raw.startsWith('/art-pixel/')?raw:saved?.src);if(!original)return;
 if(!pixelRuntime.cellStage){if(saved){el.setAttribute('src',saved.src);el.style.width=saved.width;el.style.height=saved.height;el.style.imageRendering=saved.imageRendering;el.style.objectFit=saved.objectFit;originalImages.delete(el);}else if(reverse.has(raw))el.setAttribute('src',original);return;}
 // NPC dialogue portraits stay original; the hero HUD has its own reversible fine image.
 const heroKey=el.matches?.('.who img')?'pixel-ui:hero-portrait':el.matches?.('.doll-hero')?'pixel-ui:hero-figure':undefined;
 const base=heroKey?pixelAsset(heroKey):pixelDomAsset(original);if(!base||base.kind==='actor'||base.kind==='tiles'||Object.keys(base.frames??{}).length>1)return;
 const box=Math.max(el.clientWidth,el.clientHeight)||32,small=box<24,asset=heroKey?base:pixelDomAsset(original,small)??base;if(!asset)return;
 if(!saved||raw!==base.file&&raw!==asset.file&&!raw.startsWith('/art-pixel/'))originalImages.set(el,{src:original,width:el.style.width,height:el.style.height,imageRendering:saved?.imageRendering??el.style.imageRendering,objectFit:saved?.objectFit??el.style.objectFit});
 // The control owns its layout box. Forcing every 32px source to 64px enlarges whole UI rows.
 reverse.set(asset.file,original);if(raw!==asset.file)el.setAttribute('src',asset.file);el.style.imageRendering='pixelated';el.style.objectFit='contain';
}
function glyph(el:SVGElement){const key=el.getAttribute('data-pixel-icon');if(!key)return;const old=originalSvg.get(el);
 if(!pixelRuntime.cellStage){if(old){el.innerHTML=old.body;if(old.viewBox===null)el.removeAttribute('viewBox');else el.setAttribute('viewBox',old.viewBox);if(old.style===null)el.removeAttribute('style');else el.setAttribute('style',old.style);originalSvg.delete(el);}return;}
 const compact=Math.max(el.clientWidth,el.clientHeight)<24,asset=compact?pixelAsset(key+':16')??pixelAsset(key):pixelAsset(key)??pixelAsset(key+':16');if(!asset)return;if(!old)originalSvg.set(el,{body:el.innerHTML,viewBox:el.getAttribute('viewBox'),style:el.getAttribute('style')});
 if(el.getAttribute('data-pixel-file')===asset.file&&el.firstElementChild?.tagName==='image')return;
 const [width,height]=asset.frame;el.setAttribute('viewBox',`0 0 ${width} ${height}`);el.style.imageRendering='pixelated';el.setAttribute('data-pixel-file',asset.file);el.innerHTML=`<image href="${asset.file}" x="0" y="0" width="${width}" height="${height}" style="image-rendering:pixelated"/>`;
}
function atlas(el:HTMLElement){const file=el.dataset.pixelAtlas,rect=el.dataset.pixelRect?.split(',').map(Number);if(!file||!rect)return;const saved=atlasStyles.get(el);
 if(!pixelRuntime.cellStage){if(saved!==undefined){if(saved===null)el.removeAttribute('style');else el.setAttribute('style',saved);atlasStyles.delete(el);}return;}
 const asset=pixelAsset(file),name=Object.entries(asset?.sourceFrames??{}).find(([,f])=>[f.x,f.y,f.w,f.h].every((v,i)=>v===rect[i]))?.[0];if(!asset||!name)return;let f=asset.frames?.[name];if(!f)return;
 const scale=asset.scale;if(f.w*scale>el.clientWidth&&asset.frames?.[name+':small'])f=asset.frames[name+':small'];if(saved===undefined)atlasStyles.set(el,el.getAttribute('style'));
 const size=asset.imageSize??asset.frame;el.style.backgroundImage=`url("${asset.file}")`;el.style.backgroundSize=`${size[0]*scale}px ${size[1]*scale}px`;el.style.backgroundPosition=`${Math.floor((el.clientWidth-f.w*scale)/scale)*scale-f.x*scale}px ${Math.floor((el.clientHeight-f.h*scale)/scale)*scale-f.y*scale}px`;el.style.imageRendering='pixelated';
}
let installed=false,queued=false,ready=false;const roots=new Set<Element>();
export function refreshPixelImages(root:Element){if(root instanceof HTMLImageElement)image(root);if(root instanceof SVGElement)glyph(root);if(root instanceof HTMLElement)atlas(root);root.querySelectorAll<HTMLElement>('[data-pixel-atlas]').forEach(atlas);root.querySelectorAll<HTMLImageElement>('img[src]').forEach(image);root.querySelectorAll<SVGElement>('svg[data-pixel-icon]').forEach(glyph);}
function flush(){queued=false;if(!ready&&pixelRuntime.cellStage)return;for(const r of roots)if(r.isConnected)refreshPixelImages(r);roots.clear();}
function queue(root:Element){roots.add(root);if(!queued){queued=true;queueMicrotask(flush);}}
export function installPixelImages(){if(installed||typeof document==='undefined')return;installed=true;
 const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='attributes')queue(r.target as Element);else for(const child of r.addedNodes)if(child instanceof Element)queue(child);}});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','data-pixel-icon']});
 onPixelChange(()=>{queue(document.body);if(pixelRuntime.cellStage)void loadPixelManifest().then(()=>{ready=true;queue(document.body);});});if(pixelRuntime.cellStage)void loadPixelManifest().then(()=>{ready=true;queue(document.body);}).catch(()=>{});
}
