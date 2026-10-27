/** Preserve mechanic meaning with native 32/16 pixel glyphs instead of unrelated stock spell pictures. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import sharp from 'sharp';
import {hexGlyphs,hexCategoryGlyphs,hexRuneIconSvg} from '../../apps/web/src/hex-rune-icon.ts';import {hudMenuIcon} from '../../apps/web/src/hud-icons.ts';
import {Pixels,root,publicRoot,candidateRoot} from './px0-art.mjs';import {checkAsset} from './check-pixel-art.mjs';
const palette=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/pixel-palette.json'),'utf8')),r=palette.ramps;
const paper=r.ui?.[0]??r.ink[5],gold=r.ui?.[1]??r.copper[4],ink=r.ink[1];
export const semanticUiKeys=['ui-icon:compass','hud-icon:bag',...hexGlyphs.map(n=>'hex:'+n),...hexCategoryGlyphs.map(n=>'hex:'+n),'hex:generic'];
const css={
 '--color-chrome-ink':ink,'--quality-glyph':gold,'--color-icon-paper':paper,'--color-rarity-common':gold,
 '--color-icon-leather':r.wood[3],'--color-icon-leather-light':r.wood[4],'--color-icon-leather-dark':r.wood[1],
 '--color-icon-steel':r.ink[3],'--color-icon-steel-light':r.ink[4],'--color-icon-steel-dark':r.ink[1],
 '--color-icon-blue':r.navy[3],'--color-icon-purple':r.arcane[3],'--color-icon-purple-dark':r.arcane[1],'--color-icon-orange':r.copper[3],
};
export function semanticSvg(key){
 let svg;
 if(key==='ui-icon:compass')svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="${ink}"/><circle cx="16" cy="16" r="12" fill="${r.copper[3]}"/><circle cx="16" cy="16" r="10" fill="${paper}"/><path d="M16 5V8M27 16H24M16 27V24M5 16H8" fill="none" stroke="${ink}" stroke-width="1"/><path d="M16 7 20 18 16 16 12 18Z" fill="${r.fire[2]}"/><path d="M16 25 12 14 16 16 20 14Z" fill="${r.navy[3]}"/><rect x="15" y="15" width="2" height="2" fill="${gold}"/></svg>`;
 else if(key==='hud-icon:bag')svg=hudMenuIcon('bag');
 else if(key.startsWith('hex:')){const name=key.slice(4);svg=hexRuneIconSvg(hexGlyphs.includes(name)?name:undefined,'common',undefined,hexCategoryGlyphs.includes(name)?name:undefined);}
 else throw Error('Unknown semantic glyph '+key);
 if(!svg.includes('xmlns='))svg=svg.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ');
 return svg.replace(/var\((--[^)]+)\)/g,(_,name)=>css[name]??ink).replace(/currentColor/g,ink).replace(/stroke-linecap="round"/g,'stroke-linecap="square"').replace(/stroke-linejoin="round"/g,'stroke-linejoin="miter"');
}
export async function semanticPixels(key,size){
 const bytes=Buffer.from(semanticSvg(key)),{data}=await sharp(bytes,{density:96}).resize(size,size,{fit:'contain'}).ensureAlpha().raw().toBuffer({resolveWithObject:true}),p=new Pixels(size,size),limited=key.startsWith('hex:')?[ink,paper,gold]:key==='ui-icon:compass'?[ink,paper,gold,r.copper[3],r.fire[2],r.navy[3]]:[ink,paper,r.wood[1],r.wood[3],r.wood[4]],colors=limited.map(c=>Buffer.from(c.slice(1),'hex'));
 for(let i=0;i<data.length;i+=4){if(data[i+3]<112)continue;let best=0,dist=Infinity;for(let j=0;j<colors.length;j++){const c=colors[j],d=2*(c[0]-data[i])**2+3*(c[1]-data[i+1])**2+(c[2]-data[i+2])**2;if(d<dist){best=j;dist=d;}}colors[best].copy(p.data,i);p.data[i+3]=255;}
 // Remove detached AA residue, while keeping all semantic interior dots on the opaque rune plate.
 const copy=Buffer.from(p.data);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;if(!copy[i+3])continue;let neighbor=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<size&&y+dy>=0&&y+dy<size&&copy[((y+dy)*size+x+dx)*4+3])neighbor=true;if(!neighbor)p.dot(x,y,null);}
 return p;
}
export async function buildSemanticUi(){
 const m=JSON.parse(fs.readFileSync(path.join(publicRoot,'art-pixel/manifest.json'),'utf8')),open=JSON.parse(fs.readFileSync(path.join(root,'packages/asset-manifest/pixel-open-art.json'),'utf8')).mapping,work=path.join(root,'.runtime/pixel-coherence/ui-icons');fs.mkdirSync(work,{recursive:true});
 const next={schemaVersion:1,stage:[1280,720],canvas:[1280,720],palette:'/art-pixel/palette.json',assets:{}},keys=[],replaced=[],contact=new Pixels(12*80,6*72),hashes={16:new Map(),32:new Map()},duplicates=[];let n=0;
 for(const baseKey of semanticUiKeys){for(const size of [32,16]){const key=baseKey+(size===16?':16':''),old=m.assets[key];if(!old)throw Error('Missing registered UI key '+key);const p=await semanticPixels(baseKey,size),file='/art-pixel/ui-code/semantic-v1/'+baseKey.replaceAll(':','-')+(size===16?'-16':'')+'.png';await p.save(path.join(candidateRoot,file));const sha=createHash('sha256').update(fs.readFileSync(path.join(candidateRoot,file))).digest('hex');
   const a={...old,file,frame:[size,size],anchor:[size/2,size/2],scale:1,provenance:{method:'authored-pixels',reviewed:true,recipe:'tools/pixel/fine-ui-semantic.mjs; project mechanic SVG geometry rasterized and cleaned on the native icon grid'},sha256:sha};if(size===32)a.small=baseKey+':16';const issues=await checkAsset(a,{publicRoot:candidateRoot});if(issues.length)throw Error(key+': '+JSON.stringify(issues));next.assets[key]=a;keys.push(key);if(open[key])replaced.push(key);if(hashes[size].has(sha))duplicates.push({size,a:hashes[size].get(sha),b:key});else hashes[size].set(sha,key);contact.stamp(p,n%12*80+(size===32?6:48),Math.floor(n/12)*72+(size===32?4:12));}
  n++;
 }
 fs.writeFileSync(path.join(work,'candidates.json'),JSON.stringify(next,null,2)+'\n');fs.writeFileSync(path.join(work,'keys.json'),JSON.stringify(keys,null,2)+'\n');fs.writeFileSync(path.join(work,'replaced-cc0-keys.json'),JSON.stringify(replaced,null,2)+'\n');fs.writeFileSync(path.join(work,'glyph-order.json'),JSON.stringify(semanticUiKeys,null,2)+'\n');fs.writeFileSync(path.join(work,'duplicates.json'),JSON.stringify(duplicates,null,2)+'\n');await contact.save(path.join(work,'contact.png'));console.log(JSON.stringify({glyphs:semanticUiKeys.length,candidates:keys.length,replaceCC0:replaced.length,duplicates}));return next;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildSemanticUi();
