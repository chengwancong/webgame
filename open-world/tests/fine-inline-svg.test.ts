import {it,expect,vi} from 'vitest';
import {symbol,taskSymbolNames} from '../apps/web/src/task-symbols.ts';
import {travelIcon,travelIconNames,travelCompass} from '../apps/web/src/travel-browser.ts';
import {victory,defeat,pending} from '../apps/web/src/battle-result-emblems.ts';
import {formArtHtml} from '../apps/web/src/ui/form-art.ts';
import {graphicArtHtml} from '../apps/web/src/ui/graphic-art.ts';
import {ringHtml} from '../apps/web/src/ui/graphics.ts';
// @ts-expect-error build-time ESM tool owns the native SVG asset recipes.
import {inlineFileFor,inlineSvgRows} from '../tools/pixel/fine-inline-svg.mjs';

it('keeps distinct nested and hyphenated semantic keys in separate physical files',()=>{
 expect(inlineFileFor('inline:travel:compass')).not.toBe(inlineFileFor('inline:travel-compass'));
 const names=inlineSvgRows().flatMap((row:any)=>[row.key,...(row.lod?[row.key+':16']:[])]).map((key:string)=>inlineFileFor(key).toLowerCase());expect(new Set(names).size).toBe(names.length);
});

it('gives actual task/travel/result artwork semantic pixel identities while keeping original vector geometry',()=>{
 for(const id of taskSymbolNames)expect(symbol(id)).toContain(`data-pixel-icon="inline:task:${id}"`);
 for(const id of travelIconNames)expect(travelIcon(id)).toContain(`data-pixel-icon="inline:travel:${id}"`);
 expect(symbol('unknown')).toContain('data-pixel-icon="inline:task:diamond"');
 expect(travelCompass()).toContain('viewBox="0 0 100 100"');
 for(const[id,svg]of Object.entries({victory,defeat,pending})){expect(svg).toContain(`data-pixel-icon="inline:result:${id}"`);expect(svg).toContain('viewBox="0 0 120 120"');expect(svg).toContain('<path');}
});

it('leaves CSS-valued progress and checked controls functional instead of baking their state into static pictures',()=>{
 for(const id of ['field','toggle','range'] as const)expect(formArtHtml(id)).not.toContain('data-pixel-icon');
 for(const id of ['pip','diamond-pip','bar-pip','meter','page'] as const)expect(graphicArtHtml(id)).not.toContain('data-pixel-icon');
 const ring=ringHtml(.25,'进度');expect(ring).toContain('aria-valuenow="0.25"');expect(ring).toContain('stroke-dasharray="0.25 1"');expect(ring).not.toContain('data-pixel-icon');
});

it('substitutes and restores exact100/120 SVG art through the existing toggle without a browser',async()=>{
 vi.resetModules();const assets=Object.fromEntries([['inline:travel-compass',100],['inline:result:victory',120]].map(([key,size])=>[key,{file:'/art-pixel/test/'+key+'.png',original:[],frame:[size,size],kind:'image',scale:1,anchor:[0,0]}]));
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({schemaVersion:1,stage:[1280,720],canvas:[1280,720],assets})})));
 class FakeSvg{
  attrs:Map<string,string>;style={imageRendering:'auto'};innerHTML:string;clientWidth:number;clientHeight:number;
  constructor(key:string,size:number,body:string){this.attrs=new Map([['data-pixel-icon',key],['viewBox',`0 0 ${size} ${size}`],['style','opacity:.7']]);this.innerHTML=body;this.clientWidth=this.clientHeight=size;}
  get firstElementChild(){return {tagName:this.innerHTML.startsWith('<image')?'image':'path'};}
  getAttribute(key:string){return this.attrs.get(key)??null;}
  setAttribute(key:string,value:string){this.attrs.set(key,value);}
  removeAttribute(key:string){this.attrs.delete(key);}
  querySelectorAll(){return [];}
 }
 vi.stubGlobal('SVGElement',FakeSvg);vi.stubGlobal('HTMLImageElement',class{});vi.stubGlobal('HTMLElement',class{});
 try{
  const {loadPixelManifest}=await import('../apps/web/src/pixel-assets.ts'),{setPixelCell}=await import('../apps/web/src/pixel-texture.ts'),{refreshPixelImages}=await import('../apps/web/src/pixel-images.ts');await loadPixelManifest();
  for(const[key,size,markup]of [['inline:travel-compass',100,travelCompass()],['inline:result:victory',120,victory]] as const){
   const original=markup.slice(markup.indexOf('>')+1,markup.lastIndexOf('</svg>')),el=new FakeSvg(key,size,original);setPixelCell(1);refreshPixelImages(el as any);
   expect(el.innerHTML).toContain(`width="${size}" height="${size}"`);expect(el.getAttribute('viewBox')).toBe(`0 0 ${size} ${size}`);
   setPixelCell(0);refreshPixelImages(el as any);expect(el.innerHTML).toBe(original);expect(el.getAttribute('style')).toBe('opacity:.7');
  }
 }finally{vi.unstubAllGlobals();}
});
